# Technestus Farm ERP — website deployment package

## What is included
The existing browser ERP, accounting reports, investor agreements and repayments, monthly graphical analytics, and PWA install/offline assets.

## Publish at a new web address (Netlify)
1. Create an account with a static hosting provider such as Netlify.
2. Extract this ZIP and upload the **contents of the Technestus_ERP_Web_Deployment folder** as a new site (or connect the folder to a Git repository).
3. Open the HTTPS address provided by the host and confirm the dashboard loads.
4. To use a custom domain, register a domain you control, add it to the hosting site's domain settings, and follow the host's DNS records exactly. Example: `erp.technestus.co.ke` is an illustration, not an owned or registered domain.
5. After loading once on a supported browser, the app can be installed from the browser menu and can reopen offline. Verify offline behavior on your actual device before relying on it.

## Important security and synchronization limitations
- **This is NOT a production multi-user online ERP.** Hosting this package only serves the app's static files over HTTPS.
- Records are stored in each browser's localStorage, not on a central server. Data entered on one phone/computer is NOT available on another. Clearing site data, changing the web address, or switching browsers can make local records inaccessible. Back up JSON frequently.
- Admin/Employee access is NOT secured with server-side authentication. Do not publish real investor identity details, sensitive financial records or passwords into a shared/public deployment.
- Offline means the interface can be loaded after initial online caching; there is no synchronization queue or cloud database yet.
- A full deployment requires secure accounts, role-based access controls, a hosted database (e.g. Supabase/PostgreSQL), an offline write queue, conflict handling, audit logs and backups.
- Accounting statements are provisional until opening balances and transactions are correctly entered and reconciled. No automatic independent verification of accounting accuracy.
- The original Technestus logo was not provided; a temporary gold T icon is used.

## Updating
Keep backups of your data and of previous website releases. Deploy new builds to the same origin to preserve browser-local records; changing domains changes the storage origin.
