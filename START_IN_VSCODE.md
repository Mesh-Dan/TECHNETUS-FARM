# Technestus Investment Farm ERP — VS Code project

This project is based on your previously uploaded **Technestus_Farm_ERP_Super_Admin_Login (1).zip**. It includes the existing farm, sales, accounting, investor, analytics, authentication and cloud-sync code. It is **not a deployed or already connected cloud service**.

## Run it in Visual Studio Code

1. Extract the ZIP and in VS Code choose **File → Open Folder**, selecting `Technestus_Farm_ERP_VSCode`.
2. Install Node.js LTS if not already installed.
3. In VS Code choose **Terminal → New Terminal**.
4. Run `npm install` and then `npm run dev`.
5. Open the local address shown in the terminal (normally `http://127.0.0.1:5173`).

The ERP requires a configured Supabase project before the login will work. **Do not expect the sign-in screen to accept an email/password until you complete the steps below.**

## Connect Supabase

1. In Supabase dashboard find the **Project URL** and the **publishable key** (or legacy anon key). Never use a service-role or secret key in the browser.
2. Edit `cloud-config.js` to set `url` and `anonKey` (the property is called `anonKey` even when using a publishable key). Example:

```js
window.TECHNESTUS_CLOUD = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_PUBLIC_PUBLISHABLE_KEY'
};
```

3. In Supabase SQL Editor run the contents of `supabase/schema.sql` **only after reviewing it**. This creates tables, policies, and functions. Back up any existing database before applying changes.
4. In Supabase Authentication → Users, create your own authentication user and set a new private password. Assign the `super_admin` role following `SETUP_SECURE_CLOUD.md`. **Do not paste passwords into SQL or this project.**
5. Deploy `supabase/functions/manage-users/index.ts` as an Edge Function named `manage-users`, with server-side Supabase credentials configured in Supabase secrets. Follow `SETUP_SECURE_CLOUD.md`. Employee creation will not work until this function is deployed.
6. Restart the dev server and sign in.

## Important limitations

- The existing app caches data locally and contains a cloud synchronization implementation; it needs actual end-to-end testing before being trusted with live financial data or multiple staff.
- Offline support requires initial online loading and a compatible secure origin; `localhost` is supported for local testing.
- Do not upload real financial or investor information until access policies, backups, and synchronization are verified.
- Existing browser-local data is origin-specific; changing to localhost or a new domain does **not** automatically migrate old data. Export a backup from the old ERP before moving.
- This package does not create a Supabase account or deploy anything automatically.
