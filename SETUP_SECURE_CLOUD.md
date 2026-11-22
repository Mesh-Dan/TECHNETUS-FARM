# Technestus Farm ERP — secure team deployment

This is the next-stage **deployment package**, not an already-hosted service. It requires your own Supabase project and HTTPS hosting. Do not enter real investor or accounting data until setup and security tests are complete.

## 1. Create the cloud database
1. Create a new Supabase project at https://supabase.com. Choose a strong database password and enable MFA on your Supabase account.
2. In the SQL Editor, run `supabase/schema.sql` once. It creates employee profiles, protected ERP records, row-level security policies, an audit log and an atomic record-change function.
3. In Supabase Authentication > Users, manually create your **first Super Admin** with an email and strong password. Confirm the user is created.
4. In SQL Editor, run this statement, replacing the email with your actual administrator email:

```sql
insert into public.profiles (id,email,full_name,role,active,permissions)
select id,email,'Technestus Super Administrator','super_admin',true,'{}'::jsonb
from auth.users where email='onokad418@gmail.com';
```

5. Under Authentication settings, disable public email signups. The initial admin is created through the Supabase dashboard, and subsequent staff accounts through the protected Admin screen.

## 2. Deploy the admin-only employee provisioning function
Install the Supabase CLI and log in to your project, then from this extracted folder run:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy manage-users
```

The Edge Function uses the Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Verify these are available in your function environment. **Never** place the service role key in browser code or `cloud-config.js`.

## 3. Configure browser connection
Open `cloud-config.js` and set:

```javascript
window.TECHNESTUS_CLOUD = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY'
};
```

The publishable/anon key is meant to be public. Security depends on authenticated users, RLS and server-side authorization. Do not put secret/service-role keys here.

## 4. Deploy your website
Upload the contents of this folder to an HTTPS static hosting provider (for example Netlify). It includes a PWA manifest, service worker and HTTPS security headers. The new web address is assigned by your host; a custom domain must be registered and connected separately.

**Note:** Open via HTTPS for the service worker to work. Opening `index.html` as a local file is not a configured cloud deployment.

## 5. Create employees and set permissions
1. Sign in with the first Super Admin's email/password.
2. Open **Users & permissions** and select **Add employee**.
3. Enter name, email, a temporary password of at least 12 characters, and choose Admin or Employee.
4. Grant view/edit permissions independently for **Farm**, **Sales**, **Accounting**, and **Investors**.
5. Tell employees to change their temporary password after first login.
6. Disable departed employees in Users & permissions. Their next online request will be denied by RLS. Already-open offline tabs may retain cached data until cleared.

## 6. Synchronization and offline limitations
- When online, records are written to the cloud through an authenticated RPC that checks permissions and prevents overwriting a changed record with a stale version.
- When offline **in an already authenticated, open tab**, changes are stored on the device and queued for sync. They upload when the connection returns.
- **Offline sign-in from a fresh or reloaded tab is not supported.** Authentication must be checked online. PWA assets may load offline, but that does not guarantee an authenticated offline session after reload.
- Conflicting edits are blocked, not automatically merged. Back up and reconcile them manually before discarding pending changes.
- Local offline caches use browser localStorage and are **not encrypted**. Use trusted devices with OS screen locks and disk encryption; do not use public computers for sensitive investor records.
- A disabled employee may still possess a previously downloaded local copy or exported backup. Use managed devices and secure data-handling procedures.
- Cloud sync uses a capped record fetch of 10,000 rows. Implement pagination and load testing before high-volume production use.
- This release is not independently penetration-tested. Consider professional security review, backups, disaster recovery, audit monitoring and production accounting verification before live use.

## 7. Migrating data from the older local ERP
The previous offline ERP and this secure app use different browser data scopes. Export a JSON backup from the old ERP, then sign in as Admin on the new ERP and use Data & settings > Restore JSON backup. Confirm the records appear and synchronize successfully. Keep a separate backup of the old data.

## 8. Validation checklist
- Employee without Investors permission cannot retrieve investor rows or create investor records.
- Disabled user cannot access data online.
- Employee cannot create another employee.
- Two simultaneous edits to the same record cause a conflict, not silent overwrite.
- Offline entry in an already-open tab remains pending and syncs on reconnect.
- Monthly reports reflect posted records; verify all financial figures against actual source documents.

## Important
The earlier ERP's accounting calculations are preliminary. This upgrade adds account protection and shared storage, but does not make the books automatically audited, fully reconciled, or compliant with all financial reporting requirements. The original approved Technestus logo is not included in this package.

## Owner-specific first login
Your sole Super Admin email is **onokad418@gmail.com**. This package does not contain a password. In Supabase Authentication > Users, create/invite this email and use Supabase's secure password setup or recovery process to choose a NEW strong password. Do not reuse a password previously shared in chat.

**IMPORTANT:** If you have already run an older database schema, do not rerun the full CREATE POLICY script. Apply the role migration in the SQL editor instead:
```sql
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('super_admin','admin','employee'));
update public.profiles set role='super_admin' where email='onokad418@gmail.com';
create unique index if not exists one_super_admin on public.profiles ((role)) where role='super_admin';
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
```
Redeploy `manage-users` Edge Function after replacing it with this package's version. Review any existing Super Admin accounts before migration; the unique index prevents multiple Super Admin profiles.
