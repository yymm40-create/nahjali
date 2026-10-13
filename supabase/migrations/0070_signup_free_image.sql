-- One complimentary image for accounts created after this feature is installed.
-- The claim is written in the same transaction as the image job, so concurrent requests cannot reuse it.
create table if not exists public.jawad_free_image_trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  job_id uuid not null unique references public.jawad_jobs (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.jawad_free_image_trials enable row level security;
revoke all on public.jawad_free_image_trials from public, anon, authenticated;

-- A failed or cancelled attempt did not give the person an image; let them use the welcome generation again.
create or replace function public.release_failed_welcome_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('failed', 'cancelled') and old.status not in ('failed', 'cancelled') then
    delete from jawad_free_image_trials where job_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists jawad_free_image_release_failure on public.jawad_jobs;
create trigger jawad_free_image_release_failure
after update of status on public.jawad_jobs
for each row execute function public.release_failed_welcome_image();

-- The campaign starts when this migration is first run; existing accounts do not receive the new-user image.
insert into public.jawad_settings (key, value, updated_by)
values ('signup-free-image', jsonb_build_object('started_at', now()), 'migration:0070')
on conflict (key) do nothing;

create or replace function public.jawad_create_job(p_job jsonb, p_charge boolean, p_max_active integer default 3, p_label text default '')
returns table (job_id uuid, created boolean, job_status text, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (p_job ->> 'user_id')::uuid;
  v_key text := p_job ->> 'idempotency_key';
  v_price integer := coalesce((p_job ->> 'price_coins')::integer, 0);
  v_free_image boolean := coalesce((p_job -> 'inputs' ->> 'signupFreeImage')::boolean, false);
  v_id uuid;
  v_status text;
  v_active integer;
  v_balance integer;
begin
  if v_user is null or v_key is null then
    raise exception 'JAWAD_BAD_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('jawad:' || v_user::text, 0));

  select j.id, j.status into v_id, v_status from jawad_jobs j where j.user_id = v_user and j.idempotency_key = v_key;
  if v_id is not null then
    return query select v_id, false, v_status, null::integer;
    return;
  end if;

  if v_free_image and (p_charge or v_price <> 0 or p_job ->> 'output_kind' <> 'image') then
    raise exception 'JAWAD_FREE_IMAGE_BAD_INPUT';
  end if;

  select count(*) into v_active from jawad_jobs j
   where j.user_id = v_user and j.status in ('queued', 'submitting', 'running', 'saving');
  if v_active >= p_max_active then
    raise exception 'JAWAD_BUSY';
  end if;

  insert into jawad_jobs (user_id, idempotency_key, section_id, generator_id, provider, model_id, mode, output_kind,
                          prompt, inputs, refs, price_coins, price_breakdown, pricing_version, charged, charge_state,
                          cost_usd_estimate)
  values (v_user, v_key, p_job ->> 'section_id', p_job ->> 'generator_id', p_job ->> 'provider', p_job ->> 'model_id',
          p_job ->> 'mode', p_job ->> 'output_kind', coalesce(p_job ->> 'prompt', ''),
          coalesce(p_job -> 'inputs', '{}'::jsonb), coalesce(p_job -> 'refs', '[]'::jsonb), v_price,
          coalesce(p_job -> 'price_breakdown', '[]'::jsonb), coalesce(p_job ->> 'pricing_version', ''),
          p_charge, case when p_charge and v_price > 0 then 'held' else 'none' end,
          nullif(p_job ->> 'cost_usd_estimate', '')::numeric)
  returning id into v_id;

  if v_free_image then
    insert into jawad_free_image_trials (user_id, job_id) values (v_user, v_id) on conflict (user_id) do nothing;
    if not found then
      raise exception 'JAWAD_FREE_IMAGE_USED';
    end if;
  end if;

  if p_charge and v_price > 0 then
    v_balance := adjust_smart_coins(v_user, -v_price, 'reserve', v_id::text, p_label, false);
    if v_balance is null then
      raise exception 'JAWAD_INSUFFICIENT';
    end if;
  end if;

  insert into jawad_job_events (job_id, type, detail) values (v_id, 'created', jsonb_build_object('price', v_price, 'charged', p_charge, 'signupFreeImage', v_free_image));
  return query select v_id, true, 'queued'::text, v_balance;
end;
$$;

revoke all on function public.jawad_create_job(jsonb, boolean, integer, text) from public, anon, authenticated;
