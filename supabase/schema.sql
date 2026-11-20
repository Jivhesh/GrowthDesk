-- ============================================================================
-- GrowthDesk - Database Schema, Row Level Security (RLS), and Triggers
-- Runnable as a single idempotent script in the Supabase SQL Editor.
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Ensure public schema usage
grant usage on schema public to postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- Businesses (1:1 with auth.users)
create table if not exists public.businesses (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  type text,
  phone text,
  default_country_code text default '+91',
  created_at timestamptz not null default now()
);

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  tags text[] default array[]::text[],
  notes text,
  last_visit_date date,
  visit_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Follow-ups
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  due_date date not null,
  note text,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  message_template text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------------------
create index if not exists idx_customers_business_id on public.customers(business_id);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_follow_ups_business_id on public.follow_ups(business_id);
create index if not exists idx_follow_ups_due_date on public.follow_ups(due_date);
create index if not exists idx_follow_ups_customer_id on public.follow_ups(customer_id);
create index if not exists idx_campaigns_business_id on public.campaigns(business_id);

-- ----------------------------------------------------------------------------
-- 3. PERMISSIONS & ROLES
-- ----------------------------------------------------------------------------
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.follow_ups enable row level security;
alter table public.campaigns enable row level security;

-- Businesses policies
drop policy if exists "businesses_select_own" on public.businesses;
create policy "businesses_select_own" on public.businesses
  for select to authenticated using (id = auth.uid());

drop policy if exists "businesses_insert_own" on public.businesses;
create policy "businesses_insert_own" on public.businesses
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "businesses_update_own" on public.businesses;
create policy "businesses_update_own" on public.businesses
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "businesses_delete_own" on public.businesses;
create policy "businesses_delete_own" on public.businesses
  for delete to authenticated using (id = auth.uid());

-- Customers policies
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select to authenticated using (business_id = auth.uid());

drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own" on public.customers
  for insert to authenticated with check (business_id = auth.uid());

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers
  for update to authenticated using (business_id = auth.uid()) with check (business_id = auth.uid());

drop policy if exists "customers_delete_own" on public.customers;
create policy "customers_delete_own" on public.customers
  for delete to authenticated using (business_id = auth.uid());

-- Follow-ups policies
drop policy if exists "follow_ups_select_own" on public.follow_ups;
create policy "follow_ups_select_own" on public.follow_ups
  for select to authenticated using (business_id = auth.uid());

drop policy if exists "follow_ups_insert_own" on public.follow_ups;
create policy "follow_ups_insert_own" on public.follow_ups
  for insert to authenticated with check (business_id = auth.uid());

drop policy if exists "follow_ups_update_own" on public.follow_ups;
create policy "follow_ups_update_own" on public.follow_ups
  for update to authenticated using (business_id = auth.uid()) with check (business_id = auth.uid());

drop policy if exists "follow_ups_delete_own" on public.follow_ups;
create policy "follow_ups_delete_own" on public.follow_ups
  for delete to authenticated using (business_id = auth.uid());

-- Campaigns policies
drop policy if exists "campaigns_select_own" on public.campaigns;
create policy "campaigns_select_own" on public.campaigns
  for select to authenticated using (business_id = auth.uid());

drop policy if exists "campaigns_insert_own" on public.campaigns;
create policy "campaigns_insert_own" on public.campaigns
  for insert to authenticated with check (business_id = auth.uid());

drop policy if exists "campaigns_update_own" on public.campaigns;
create policy "campaigns_update_own" on public.campaigns
  for update to authenticated using (business_id = auth.uid()) with check (business_id = auth.uid());

drop policy if exists "campaigns_delete_own" on public.campaigns;
create policy "campaigns_delete_own" on public.campaigns
  for delete to authenticated using (business_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. SIGNUP TRIGGER
-- Auto-creates business profile row from auth.users metadata on signup.
-- Security definer with search_path = public avoids RLS & email confirmation timing traps.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.businesses (id, name, type, phone, default_country_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 'My Business'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'business_type'), ''), 'General'),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'default_country_code'), ''), '+91')
  )
  on conflict (id) do update set
    name = excluded.name,
    type = coalesce(excluded.type, public.businesses.type),
    phone = coalesce(excluded.phone, public.businesses.phone),
    default_country_code = coalesce(excluded.default_country_code, public.businesses.default_country_code);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- Forces Supabase API to immediately recognize the new tables without restart.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
