-- Run in a NEW Supabase project. Do not expose service_role credentials to browsers.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 full_name text not null default '',
 role text not null default 'employee' check (role in ('super_admin','admin','employee')),
 active boolean not null default true,
 permissions jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.app_records (
 module text not null,
 record_id text not null,
 payload jsonb,
 deleted boolean not null default false,
 version integer not null default 1,
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key (module,record_id),
 constraint module_valid check(module in ('incubators','eggs','hatches','brooding','birds','mortality','customers','sales','expenses','investors','investments','repayments','invoices','receipts','journals','payables'))
);
create table if not exists public.audit_log (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id),
 module text not null,
 record_id text not null,
 action text not null,
 old_value jsonb,
 new_value jsonb,
 occurred_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('super_admin','admin'));
$$;
create or replace function public.can_module(p_module text,p_write boolean default false) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles%rowtype; grp text;
begin
 select * into p from public.profiles where id=auth.uid();
 if not found or not p.active then return false; end if;
 if p.role in ('super_admin','admin') then return true; end if;
 grp:=case when p_module in ('investors','investments','repayments') then 'investors'
 when p_module in ('journals','payables','expenses') then 'accounting'
 when p_module in ('sales','customers','invoices','receipts') then 'sales' else 'farm' end;
 if p_write then return coalesce((p.permissions->grp->>'write')::boolean,false);
 else return coalesce((p.permissions->grp->>'read')::boolean,false); end if;
end; $$;
alter table public.profiles enable row level security;
alter table public.app_records enable row level security;
alter table public.audit_log enable row level security;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy record_read on public.app_records for select to authenticated using(public.can_module(module,false));
create policy audit_read on public.audit_log for select to authenticated using(public.is_admin());
-- No direct browser INSERT/UPDATE/DELETE on records or profiles. All writes go through controlled RPC.
revoke all on public.profiles from anon;
revoke all on public.app_records from anon;
revoke all on public.audit_log from anon,authenticated;
grant select on public.profiles to authenticated;
grant select on public.app_records to authenticated;
grant select on public.audit_log to authenticated;
create or replace function public.apply_record_change(
 p_module text,p_record_id text,p_payload jsonb,p_deleted boolean,p_expected_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.app_records%rowtype; next_version integer;
begin
 if auth.uid() is null or not public.can_module(p_module,true) then raise exception 'Not authorized'; end if;
 if p_module not in ('incubators','eggs','hatches','brooding','birds','mortality','customers','sales','expenses','investors','investments','repayments','invoices','receipts','journals','payables') then raise exception 'Invalid module'; end if;
 if length(p_record_id)>120 then raise exception 'Invalid record ID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_module||':'||p_record_id,0));
 select * into previous from public.app_records where module=p_module and record_id=p_record_id for update;
 if found then
   if p_expected_version is distinct from previous.version then return jsonb_build_object('status','conflict','serverVersion',previous.version); end if;
   next_version:=previous.version+1;
   update public.app_records set payload=p_payload,deleted=p_deleted,version=next_version,updated_at=now(),updated_by=auth.uid() where module=p_module and record_id=p_record_id;
 else
   if p_expected_version is not null then return jsonb_build_object('status','conflict','serverVersion',null); end if;
   next_version:=1;
   insert into public.app_records(module,record_id,payload,deleted,version,updated_by) values(p_module,p_record_id,p_payload,p_deleted,1,auth.uid());
 end if;
 insert into public.audit_log(actor,module,record_id,action,old_value,new_value) values(auth.uid(),p_module,p_record_id,case when p_deleted then 'delete' when found then 'update' else 'create' end,previous.payload,p_payload);
 return jsonb_build_object('status','ok','version',next_version);
end; $$;
revoke all on function public.apply_record_change(text,text,jsonb,boolean,integer) from public;
grant execute on function public.apply_record_change(text,text,jsonb,boolean,integer) to authenticated;
-- Initial admin bootstrap (after creating the first auth user in Supabase dashboard):
-- insert into public.profiles(id,email,full_name,role,active,permissions)
-- select id,email,'Technestus Super Administrator','super_admin',true,'{}'::jsonb from auth.users where email='YOUR_ADMIN_EMAIL';

-- Enforce one and only one possible Super Admin (initial bootstrap must be run by project owner).
create unique index if not exists one_super_admin on public.profiles ((role)) where role='super_admin';
-- Employee and Admin accounts cannot manage other users; only super_admin may do so.
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='super_admin');
$$;
