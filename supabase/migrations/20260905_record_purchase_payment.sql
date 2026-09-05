-- Ghi nhận khoản chi trả nhà cung cấp và phân bổ vào phiếu nhập.
-- Chạy file này một lần trong Supabase SQL Editor trước khi trả tiền NCC từ ứng dụng.

create or replace function public.record_purchase_payment(
  p_business_id uuid,
  p_purchase_order_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text default 'cash',
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_paid numeric := 0;
  v_due numeric;
  v_transaction public.finance_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để ghi nhận thanh toán.';
  end if;

  if not exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and active = true
  ) then
    raise exception 'Bạn không có quyền ghi nhận thanh toán cho doanh nghiệp này.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền thanh toán phải lớn hơn 0.';
  end if;

  select * into v_order
  from public.purchase_orders
  where id = p_purchase_order_id
    and business_id = p_business_id
  for update;

  if not found or v_order.status in ('cancelled', 'draft') then
    raise exception 'Phiếu nhập không hợp lệ để ghi nhận thanh toán.';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payment_allocations
  where business_id = p_business_id
    and document_type = 'purchase_order'
    and document_id = p_purchase_order_id;

  v_due := greatest(0, v_order.total - v_paid);
  if p_amount > v_due then
    raise exception 'Số tiền trả vượt quá số còn nợ của phiếu nhập.';
  end if;

  if not exists (
    select 1
    from public.finance_accounts
    where id = p_account_id
      and business_id = p_business_id
      and active = true
  ) then
    raise exception 'Tài khoản tiền không hợp lệ.';
  end if;

  insert into public.finance_transactions (
    business_id, transaction_date, direction, category, account_id, amount,
    payment_method, reference_type, reference_id, note, status, created_by
  ) values (
    p_business_id, current_date, 'out', 'Thanh toán nhập hàng', p_account_id, p_amount,
    coalesce(nullif(p_payment_method, ''), 'cash'), 'purchase_order', p_purchase_order_id,
    nullif(p_note, ''), 'posted', auth.uid()
  ) returning * into v_transaction;

  insert into public.payment_allocations (
    business_id, transaction_id, document_type, document_id, amount
  ) values (
    p_business_id, v_transaction.id, 'purchase_order', p_purchase_order_id, p_amount
  );

  return to_jsonb(v_transaction);
end;
$$;

grant execute on function public.record_purchase_payment(uuid, uuid, numeric, uuid, text, text) to authenticated;
