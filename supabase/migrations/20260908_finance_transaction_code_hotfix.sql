begin;

-- Finance transactions are created by several RPCs. Keep code generation at the
-- table boundary so every current and future insert satisfies the required field.
create or replace function public.assign_finance_transaction_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
begin
  if nullif(btrim(new.code), '') is null then
    v_prefix := case lower(coalesce(new.direction, ''))
      when 'in' then 'PT-'
      when 'out' then 'PC-'
      else 'GD-'
    end;
    new.code := public.take_document_code(new.business_id, 'finance_transaction', v_prefix);
  else
    new.code := upper(btrim(new.code));
  end if;

  return new;
end;
$$;

drop trigger if exists smarterp_finance_transaction_code on public.finance_transactions;
create trigger smarterp_finance_transaction_code
before insert on public.finance_transactions
for each row execute function public.assign_finance_transaction_code();

revoke all on function public.assign_finance_transaction_code() from public, anon, authenticated;

commit;
