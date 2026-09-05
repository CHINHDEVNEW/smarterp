-- Keep product creation safe even when a client omits the optional code field.
alter table public.products
  alter column code set default (
    'SP-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  );
