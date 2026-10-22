-- «اشحن رصيدك»: where the buyer came from, kept on the order — the ad's utm_* fields and click ids (fbclid, ttclid, sccid),
-- a `ref`, the first page, Meta's browser cookies (_fbp/_fbc) and the buyer's address and browser — for the ads' reports and
-- the Meta Conversions API when the owner confirms (src/lib/credits/orders.ts). The code works without the column too (the
-- insert is retried without `source`). Safe to run more than once.

alter table public.credit_orders add column if not exists source jsonb;
