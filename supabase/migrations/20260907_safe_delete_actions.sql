-- Safe deletion endpoints for records that have not produced business history.
-- Posted documents remain append-only and must use their cancellation workflows.

alter table public.stocktakes
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

create or replace function public.app_delete_quote(
  p_business_id uuid,
  p_quote_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'quotes');

  select * into v_quote
  from public.quotes
  where id = p_quote_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy báo giá.';
  end if;
  if v_quote.converted_sales_order_id is not null then
    raise exception 'Báo giá đã chuyển thành đơn bán nên không thể xóa.';
  end if;

  delete from public.quote_items
  where quote_id = p_quote_id and business_id = p_business_id;

  delete from public.quotes
  where id = p_quote_id and business_id = p_business_id;

  return jsonb_build_object('id', p_quote_id, 'deleted', true);
end;
$$;

create or replace function public.app_delete_finance_account(
  p_business_id uuid,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.business_role(p_business_id);
  v_account public.finance_accounts%rowtype;
begin
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Bạn không có quyền quản lý tài khoản tiền.';
  end if;

  select * into v_account
  from public.finance_accounts
  where id = p_account_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy tài khoản tiền.';
  end if;
  if coalesce(v_account.opening_balance, 0) <> 0 then
    raise exception 'Chỉ tài khoản có số dư đầu kỳ bằng 0 mới có thể xóa.';
  end if;
  if exists (
    select 1 from public.finance_transactions
    where business_id = p_business_id and account_id = p_account_id
  ) then
    raise exception 'Tài khoản đã phát sinh giao dịch. Hãy ngừng sử dụng thay vì xóa.';
  end if;

  delete from public.finance_accounts
  where id = p_account_id and business_id = p_business_id;

  return jsonb_build_object('id', p_account_id, 'deleted', true);
end;
$$;

create or replace function public.app_delete_manual_finance_transaction(
  p_business_id uuid,
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'finance');

  select * into v_transaction
  from public.finance_transactions
  where id = p_transaction_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy giao dịch thu chi.';
  end if;
  if coalesce(v_transaction.reference_type, 'manual') <> 'manual' then
    raise exception 'Giao dịch phát sinh từ chứng từ phải được hủy tại chứng từ gốc.';
  end if;

  delete from public.payment_allocations
  where business_id = p_business_id and transaction_id = p_transaction_id;

  delete from public.finance_transactions
  where id = p_transaction_id and business_id = p_business_id;

  return jsonb_build_object('id', p_transaction_id, 'deleted', true);
end;
$$;

create or replace function public.app_delete_production_bom(
  p_business_id uuid,
  p_bom_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bom public.production_boms%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');

  select * into v_bom
  from public.production_boms
  where id = p_bom_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy định mức.';
  end if;
  if exists (
    select 1 from public.production_orders
    where business_id = p_business_id and bom_id = p_bom_id
  ) then
    raise exception 'Định mức đã được dùng trong lệnh sản xuất. Hãy lưu trữ thay vì xóa.';
  end if;

  delete from public.production_boms
  where id = p_bom_id and business_id = p_business_id;

  return jsonb_build_object('id', p_bom_id, 'deleted', true);
end;
$$;

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
    raise exception 'Phiếu nhập đã có phiếu trả hàng nên không thể xóa lịch sử.';
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
    and ft.reference_type in ('purchase_order', 'purchase_order_cancel')
    and ft.reference_id = p_purchase_order_id;

  delete from public.finance_transactions
  where business_id = p_business_id
    and reference_type in ('purchase_order', 'purchase_order_cancel')
    and reference_id = p_purchase_order_id;

  -- Delete the cancelling entry first. If a deployment maintains stock on
  -- DELETE as well as INSERT, this ordering avoids a temporary negative stock.
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

create or replace function public.app_delete_production_order(
  p_business_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');

  select * into v_order
  from public.production_orders
  where id = p_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy lệnh sản xuất.';
  end if;
  if v_order.status not in ('planned', 'in_progress', 'cancelled') then
    raise exception 'Chỉ lệnh chưa hoàn tất mới có thể xóa.';
  end if;
  if exists (
    select 1 from public.production_order_materials
    where business_id = p_business_id and production_order_id = p_order_id
      and (issued_quantity > 0 or returned_quantity > 0)
  ) or exists (
    select 1 from public.production_order_outputs
    where business_id = p_business_id and production_order_id = p_order_id
  ) or exists (
    select 1 from public.production_order_wastes
    where business_id = p_business_id and production_order_id = p_order_id
  ) then
    raise exception 'Lệnh đã phát sinh kho hoặc sản lượng nên không thể xóa.';
  end if;

  delete from public.production_order_costs
  where business_id = p_business_id and production_order_id = p_order_id;
  delete from public.production_order_materials
  where business_id = p_business_id and production_order_id = p_order_id;
  delete from public.production_orders
  where business_id = p_business_id and id = p_order_id;

  return jsonb_build_object('id', p_order_id, 'deleted', true);
end;
$$;

create or replace function public.app_cancel_return(
  p_business_id uuid,
  p_return_type text,
  p_return_id uuid,
  p_reason text
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
  v_allow_negative boolean := false;
  v_item record;
  v_product public.products%rowtype;
begin
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cần nhập lý do hủy phiếu trả hàng.';
  end if;

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
  if lower(coalesce(v_status, '')) in ('cancelled', 'canceled') then
    raise exception 'Phiếu trả hàng đã được hủy trước đó.';
  end if;

  select coalesce((
    select allow_negative_stock from public.app_settings where business_id = p_business_id
  ), false) into v_allow_negative;

  if v_type = 'sales' then
    for v_item in
      select product_id, sum(quantity) as quantity, max(unit_cost) as unit_cost
      from public.sales_return_items
      where business_id = p_business_id and sales_return_id = p_return_id
      group by product_id
    loop
      select * into v_product from public.products
      where id = v_item.product_id and business_id = p_business_id
      for update;
      if found and v_product.product_type <> 'service' then
        if not v_allow_negative and coalesce(v_product.stock_on_hand, 0) < v_item.quantity then
          raise exception 'Không đủ tồn kho để hủy phiếu trả hàng. Hàng đã nhập lại có thể đã được xuất tiếp.';
        end if;
        insert into public.stock_movements (
          business_id, product_id, movement_type, quantity, unit_cost,
          reference_type, reference_id, note, created_by
        ) values (
          p_business_id, v_item.product_id, 'adjustment', -v_item.quantity,
          coalesce(v_item.unit_cost, v_product.cost_price, 0), 'sales_return_cancel', p_return_id,
          'Đảo kho do hủy phiếu ' || v_code || ': ' || trim(p_reason), auth.uid()
        );
      end if;
    end loop;
    update public.sales_returns
    set status = 'cancelled', note = concat_ws(E'\n', note, 'Hủy: ' || trim(p_reason))
    where id = p_return_id and business_id = p_business_id;
  else
    for v_item in
      select product_id, sum(quantity) as quantity, max(unit_cost) as unit_cost
      from public.purchase_return_items
      where business_id = p_business_id and purchase_return_id = p_return_id
      group by product_id
    loop
      select * into v_product from public.products
      where id = v_item.product_id and business_id = p_business_id
      for update;
      if found and v_product.product_type <> 'service' then
        insert into public.stock_movements (
          business_id, product_id, movement_type, quantity, unit_cost,
          reference_type, reference_id, note, created_by
        ) values (
          p_business_id, v_item.product_id, 'adjustment', v_item.quantity,
          coalesce(v_item.unit_cost, v_product.cost_price, 0), 'purchase_return_cancel', p_return_id,
          'Đảo kho do hủy phiếu ' || v_code || ': ' || trim(p_reason), auth.uid()
        );
      end if;
    end loop;
    update public.purchase_returns
    set status = 'cancelled', note = concat_ws(E'\n', note, 'Hủy: ' || trim(p_reason))
    where id = p_return_id and business_id = p_business_id;
  end if;

  update public.finance_transactions
  set status = 'cancelled', note = concat_ws(E'\n', note, 'Hủy cùng phiếu ' || v_code)
  where business_id = p_business_id
    and reference_type = v_type || '_return'
    and reference_id = p_return_id
    and status = 'posted';

  return jsonb_build_object('id', p_return_id, 'status', 'cancelled');
end;
$$;

create or replace function public.app_cancel_stocktake(
  p_business_id uuid,
  p_stocktake_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stocktake public.stocktakes%rowtype;
  v_allow_negative boolean := false;
  v_item record;
  v_product public.products%rowtype;
  v_code text;
begin
  perform public.assert_business_permission(p_business_id, 'inventory');
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cần nhập lý do hủy phiếu kiểm kê.';
  end if;

  select * into v_stocktake
  from public.stocktakes
  where id = p_stocktake_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu kiểm kê.';
  end if;
  if v_stocktake.cancelled_at is not null then
    raise exception 'Phiếu kiểm kê đã được hủy trước đó.';
  end if;

  v_code := coalesce(to_jsonb(v_stocktake)->>'code', to_jsonb(v_stocktake)->>'stocktake_code', 'phiếu kiểm kê');
  select coalesce((
    select allow_negative_stock from public.app_settings where business_id = p_business_id
  ), false) into v_allow_negative;

  for v_item in
    select product_id, sum(quantity) as quantity, max(unit_cost) as unit_cost
    from public.stock_movements
    where business_id = p_business_id
      and reference_type = 'stocktake'
      and reference_id = p_stocktake_id
    group by product_id
  loop
    select * into v_product from public.products
    where id = v_item.product_id and business_id = p_business_id
    for update;
    if found and v_product.product_type <> 'service' then
      if not v_allow_negative and coalesce(v_product.stock_on_hand, 0) - v_item.quantity < 0 then
        raise exception 'Không đủ tồn kho để hủy phiếu kiểm kê. Hàng sau kiểm kê có thể đã được xuất tiếp.';
      end if;
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_item.product_id, 'adjustment', -v_item.quantity,
        coalesce(v_item.unit_cost, v_product.cost_price, 0), 'stocktake_cancel', p_stocktake_id,
        'Đảo kho do hủy ' || v_code || ': ' || trim(p_reason), auth.uid()
      );
    end if;
  end loop;

  update public.stocktakes
  set cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_stocktake_id and business_id = p_business_id;

  return jsonb_build_object('id', p_stocktake_id, 'status', 'cancelled');
end;
$$;

revoke execute on function public.app_delete_quote(uuid, uuid) from public, anon;
revoke execute on function public.app_delete_finance_account(uuid, uuid) from public, anon;
revoke execute on function public.app_delete_manual_finance_transaction(uuid, uuid) from public, anon;
revoke execute on function public.app_delete_production_bom(uuid, uuid) from public, anon;
revoke execute on function public.app_delete_cancelled_purchase_order(uuid, uuid) from public, anon;
revoke execute on function public.app_delete_production_order(uuid, uuid) from public, anon;
revoke execute on function public.app_cancel_return(uuid, text, uuid, text) from public, anon;
revoke execute on function public.app_cancel_stocktake(uuid, uuid, text) from public, anon;

grant execute on function public.app_delete_quote(uuid, uuid) to authenticated;
grant execute on function public.app_delete_finance_account(uuid, uuid) to authenticated;
grant execute on function public.app_delete_manual_finance_transaction(uuid, uuid) to authenticated;
grant execute on function public.app_delete_production_bom(uuid, uuid) to authenticated;
grant execute on function public.app_delete_cancelled_purchase_order(uuid, uuid) to authenticated;
grant execute on function public.app_delete_production_order(uuid, uuid) to authenticated;
grant execute on function public.app_cancel_return(uuid, text, uuid, text) to authenticated;
grant execute on function public.app_cancel_stocktake(uuid, uuid, text) to authenticated;
