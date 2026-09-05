-- SmartERP finance and document permission hardening.
-- Run after 20260906_core_hardening.sql.

create or replace function public.app_create_finance_transaction(
  p_business_id uuid,
  p_transaction jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_direction text := lower(coalesce(p_transaction->>'direction', ''));
  v_amount numeric := coalesce(nullif(p_transaction->>'amount', '')::numeric, 0);
  v_account_id uuid := nullif(p_transaction->>'account_id', '')::uuid;
  v_category text := nullif(trim(coalesce(p_transaction->>'category', '')), '');
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'finance');
  if v_direction not in ('in', 'out') then raise exception 'Loại giao dịch không hợp lệ.'; end if;
  if v_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0.'; end if;
  if v_category is null then raise exception 'Cần nhập khoản mục thu chi.'; end if;
  if not exists (
    select 1 from public.finance_accounts
    where id = v_account_id and business_id = p_business_id and active = true
  ) then raise exception 'Tài khoản tiền không hợp lệ.'; end if;

  insert into public.finance_transactions (
    business_id, transaction_date, direction, category, account_id, amount,
    payment_method, reference_type, note, status, created_by
  ) values (
    p_business_id,
    coalesce(nullif(p_transaction->>'transaction_date', '')::date, current_date),
    v_direction,
    v_category,
    v_account_id,
    v_amount,
    coalesce(nullif(p_transaction->>'payment_method', ''), 'cash'),
    'manual',
    nullif(trim(coalesce(p_transaction->>'note', '')), ''),
    'posted',
    auth.uid()
  ) returning * into v_transaction;
  return to_jsonb(v_transaction);
end;
$$;

create or replace function public.app_create_finance_account(
  p_business_id uuid,
  p_account jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.business_role(p_business_id);
  v_code text := upper(nullif(trim(coalesce(p_account->>'code', '')), ''));
  v_name text := nullif(trim(coalesce(p_account->>'name', '')), '');
  v_opening numeric := coalesce(nullif(p_account->>'opening_balance', '')::numeric, 0);
  v_account public.finance_accounts%rowtype;
begin
  if v_role is null or v_role not in ('owner', 'admin') then raise exception 'Bạn không có quyền quản lý tài khoản tiền.'; end if;
  if v_code is null or v_name is null then raise exception 'Cần nhập mã và tên tài khoản.'; end if;
  if v_opening < 0 then raise exception 'Số dư đầu kỳ không được âm.'; end if;

  insert into public.finance_accounts (
    business_id, code, name, account_type, opening_balance, active
  ) values (
    p_business_id, v_code, v_name,
    coalesce(nullif(p_account->>'account_type', ''), 'cash'), v_opening, true
  ) returning * into v_account;
  return to_jsonb(v_account);
end;
$$;

create or replace function public.app_update_finance_account(
  p_business_id uuid,
  p_account_id uuid,
  p_account jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.business_role(p_business_id);
  v_account public.finance_accounts%rowtype;
  v_active boolean := coalesce((p_account->>'active')::boolean, true);
  v_balance numeric;
begin
  if v_role is null or v_role not in ('owner', 'admin') then raise exception 'Bạn không có quyền quản lý tài khoản tiền.'; end if;
  select * into v_account from public.finance_accounts
  where id = p_account_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy tài khoản tiền.'; end if;

  select coalesce(v_account.opening_balance, 0) + coalesce(sum(
    case when status = 'posted' and direction = 'in' then amount
         when status = 'posted' and direction = 'out' then -amount else 0 end
  ), 0)
  into v_balance
  from public.finance_transactions
  where business_id = p_business_id and account_id = p_account_id;

  if not v_active and abs(v_balance) > 0.0001 then
    raise exception 'Chỉ có thể ngừng dùng tài khoản khi số dư bằng 0.';
  end if;

  update public.finance_accounts
  set code = upper(coalesce(nullif(trim(p_account->>'code'), ''), code)),
      name = coalesce(nullif(trim(p_account->>'name'), ''), name),
      account_type = coalesce(nullif(p_account->>'account_type', ''), account_type),
      active = v_active
  where id = p_account_id and business_id = p_business_id
  returning * into v_account;
  return to_jsonb(v_account) || jsonb_build_object('balance', v_balance);
end;
$$;

-- Document mutations must go through the checked transactional functions.
revoke insert, update, delete on table
  public.sales_orders, public.sales_order_items,
  public.purchase_orders, public.purchase_order_items,
  public.quotes, public.quote_items,
  public.sales_returns, public.sales_return_items,
  public.purchase_returns, public.purchase_return_items,
  public.stock_movements, public.stocktakes, public.stocktake_items,
  public.finance_transactions, public.payment_allocations
from anon, authenticated;

revoke insert, update, delete on table public.finance_accounts from anon, authenticated;

revoke execute on function public.app_create_finance_transaction(uuid, jsonb) from public, anon;
revoke execute on function public.app_create_finance_account(uuid, jsonb) from public, anon;
revoke execute on function public.app_update_finance_account(uuid, uuid, jsonb) from public, anon;

grant execute on function public.app_create_finance_transaction(uuid, jsonb) to authenticated;
grant execute on function public.app_create_finance_account(uuid, jsonb) to authenticated;
grant execute on function public.app_update_finance_account(uuid, uuid, jsonb) to authenticated;
