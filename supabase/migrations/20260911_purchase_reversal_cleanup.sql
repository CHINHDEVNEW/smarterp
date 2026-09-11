begin;

create or replace function public.app_delete_cancelled_purchase_order(
  p_business_id uuid,
  p_purchase_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'purchases');

  select * into v_order
  from public.purchase_orders
  where id = p_purchase_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu nhập.';
  end if;
  if exists (
    select 1 from public.purchase_returns
    where business_id = p_business_id and purchase_order_id = p_purchase_order_id
  ) then
    raise exception 'Phiếu nhập đã có phiếu trả hàng. Hãy xóa phiếu trả hàng trước.';
  end if;

  if lower(coalesce(v_order.status, '')) = 'draft' then
    update public.purchase_orders
    set status = 'cancelled'
    where id = p_purchase_order_id and business_id = p_business_id;
  elsif lower(coalesce(v_order.status, '')) not in ('cancelled', 'canceled') then
    perform public.app_cancel_purchase_order(
      p_business_id,
      p_purchase_order_id,
      'Xóa phiếu nhập theo yêu cầu người dùng'
    );
  end if;

  delete from public.payment_allocations pa
  using public.finance_transactions ft
  where pa.business_id = p_business_id
    and pa.transaction_id = ft.id
    and ft.business_id = p_business_id
    and ft.reference_type in ('purchase_order', 'purchase_order_reversal', 'purchase_order_cancel')
    and ft.reference_id = p_purchase_order_id;

  delete from public.finance_transactions
  where business_id = p_business_id
    and reference_type in ('purchase_order', 'purchase_order_reversal', 'purchase_order_cancel')
    and reference_id = p_purchase_order_id;

  delete from public.stock_movements
  where business_id = p_business_id
    and reference_type = 'purchase_order_cancel'
    and reference_id = p_purchase_order_id;
  delete from public.stock_movements
  where business_id = p_business_id
    and reference_type = 'purchase_order'
    and reference_id = p_purchase_order_id;

  delete from public.purchase_order_items
  where business_id = p_business_id and purchase_order_id = p_purchase_order_id;
  delete from public.purchase_orders
  where business_id = p_business_id and id = p_purchase_order_id;

  return jsonb_build_object('id', p_purchase_order_id, 'deleted', true);
end;
$$;

revoke execute on function public.app_delete_cancelled_purchase_order(uuid, uuid) from public, anon;
grant execute on function public.app_delete_cancelled_purchase_order(uuid, uuid) to authenticated;

-- Chỉ dọn giao dịch đảo chi đã mất phiếu nhập nguồn. Giao dịch đảo của phiếu
-- nhập vẫn còn ở trạng thái đã hủy được giữ lại làm lịch sử hợp lệ.
delete from public.payment_allocations pa
using public.finance_transactions ft
where pa.transaction_id = ft.id
  and pa.business_id = ft.business_id
  and ft.reference_type in ('purchase_order_reversal', 'purchase_order_cancel')
  and not exists (
    select 1
    from public.purchase_orders po
    where po.id = ft.reference_id and po.business_id = ft.business_id
  );

delete from public.finance_transactions ft
where ft.reference_type in ('purchase_order_reversal', 'purchase_order_cancel')
  and not exists (
    select 1
    from public.purchase_orders po
    where po.id = ft.reference_id and po.business_id = ft.business_id
  );

commit;
