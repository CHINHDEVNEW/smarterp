begin;

create or replace function public.app_delete_return(
  p_business_id uuid,
  p_return_type text,
  p_return_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text := lower(coalesce(p_return_type, ''));
  v_code text;
  v_status text;
begin
  if v_type = 'sales' then
    perform public.assert_business_permission(p_business_id, 'sales_return');
    select code, status into v_code, v_status
    from public.sales_returns
    where id = p_return_id and business_id = p_business_id
    for update;
  elsif v_type = 'purchase' then
    perform public.assert_business_permission(p_business_id, 'purchase_return');
    select code, status into v_code, v_status
    from public.purchase_returns
    where id = p_return_id and business_id = p_business_id
    for update;
  else
    raise exception 'Loại phiếu trả hàng không hợp lệ.';
  end if;

  if v_code is null then
    raise exception 'Không tìm thấy phiếu trả hàng.';
  end if;

  -- First create the normal reversal entries. If any inventory safety rule fails,
  -- the whole transaction is rolled back and the return remains untouched.
  if lower(coalesce(v_status, '')) not in ('cancelled', 'canceled') then
    perform public.app_cancel_return(
      p_business_id,
      v_type,
      p_return_id,
      'Xóa phiếu trả hàng theo yêu cầu người dùng'
    );
  end if;

  delete from public.payment_allocations pa
  using public.finance_transactions ft
  where pa.business_id = p_business_id
    and pa.transaction_id = ft.id
    and ft.business_id = p_business_id
    and ft.reference_type = v_type || '_return'
    and ft.reference_id = p_return_id;

  delete from public.finance_transactions
  where business_id = p_business_id
    and reference_type = v_type || '_return'
    and reference_id = p_return_id;

  -- Delete paired stock entries in an order that avoids a temporary negative
  -- balance on databases that also maintain stock_on_hand on DELETE.
  if v_type = 'sales' then
    delete from public.stock_movements
    where business_id = p_business_id
      and reference_type = 'sales_return_cancel'
      and reference_id = p_return_id;
    delete from public.stock_movements
    where business_id = p_business_id
      and reference_type = 'sales_return'
      and reference_id = p_return_id;

    delete from public.sales_return_items
    where business_id = p_business_id and sales_return_id = p_return_id;
    delete from public.sales_returns
    where business_id = p_business_id and id = p_return_id;
  else
    delete from public.stock_movements
    where business_id = p_business_id
      and reference_type = 'purchase_return'
      and reference_id = p_return_id;
    delete from public.stock_movements
    where business_id = p_business_id
      and reference_type = 'purchase_return_cancel'
      and reference_id = p_return_id;

    delete from public.purchase_return_items
    where business_id = p_business_id and purchase_return_id = p_return_id;
    delete from public.purchase_returns
    where business_id = p_business_id and id = p_return_id;
  end if;

  return jsonb_build_object('id', p_return_id, 'code', v_code, 'deleted', true);
end;
$$;

revoke execute on function public.app_delete_return(uuid, text, uuid) from public, anon;
grant execute on function public.app_delete_return(uuid, text, uuid) to authenticated;

commit;
