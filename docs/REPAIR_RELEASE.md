# DF PRO integrity repair release

This branch repairs existing workshop, accounting, authentication and deployment flows. It preserves the compact UI and adds actual sign-in, sign-out, remaining-balance collection, vehicle-linked advances and notification delivery status. It does not certify the shop as a complete double-entry ERP.

## Changes

- Authenticate every protected API request using an expiring signed session and the current active user record. Ignore caller-supplied role/user headers. Password, PIN, role and activation changes revoke sessions. Worker and Investor accounts have restricted server-side access; Investors are read-only.
- Use installation-specific signing material, stored approval PINs, login/approval rate limiting and protected vehicle evidence. Remove hardcoded login/PIN fallback paths. Preserve damage evidence instead of deleting it through the UI.
- Make checkout, additional collections, reversals, refunds, expenses, advances, transfers, material issues and partner cash movements transactional. Use serializable transactions with bounded conflict retries and advisory locks. Freeze invoice line descriptions/prices. Generate daily document numbers with transactional counters.
- Validate currency precision, tender/change, overpayment, named bank accounts and available balances. Persist request keys for mutation retries. Checkout additionally has one-invoice-per-job protection. Refund the actual available tender allocation, cap cumulative refunds and never return consumed chemicals merely because money was refunded.
- Keep unused advances as a remaining liability. Reject another vehicle's advance. Separate sales, collections, advances, receivables, refunds and net cash flow in reports. Split payment summaries now use individual payment records.
- Enforce workshop state transitions and one active vehicle per physical bay. Preserve start/completion timestamps. Count completed visits for loyalty. Freeze commission policy at completion and allocate percentage commissions across all assigned workers.
- Reject material shortages and duplicate issues; capture actual unit cost at issuance. Service mapping edits and audit writes are transactional. Standard yield mappings describe expected usage; workers still record actual materials during work.
- Retry failed alert deliveries with backoff and claim leases. Do not mark unconfigured/failed notifications as delivered. Queue checkout SMS receipts. Persist camera arrivals, normalize plate matching and audit unmatched arrivals after the grace period. Repair camera stream reconnect handling.
- Use Karachi reporting/scheduling dates. Serve the production UI and API together; the legacy UI port redirects to the API server. Back up database, uploaded evidence and private signing material to both configured destinations with checksums and 14-day retention. Provide a guarded restore command.

## Operator workflow update

- Settings now includes the service catalog: create, edit price/material mappings and archive/reactivate services. Active tickets also support adding/removing services before billing; price snapshots and recorded material issues are retained. Adding work to a ready ticket returns it to the queue. Version checks reject conflicting edits; committed invoices remain locked.
- The shop uses Admin and Accountant operator accounts. Workers can be roster-only records without passwords. Admin permissions are fixed; an Admin can change the Accountant's individual permissions in Settings → Permissions. Server checks use the current saved grants on every request and the UI refreshes them every 30 seconds. Authorized sessions approve their own permitted operations without repeated PIN entry; a restricted discount may still request an authorized approval PIN. Admin-only account/permission management cannot be granted to the Accountant.
- Workshop dispatch uses bay buttons only, with both detailing bays and multiple workers. Checkout is compact, with editable collection, named banks and optional discount/advance details. All print actions use blue buttons.
- Settings offers six bold invoice designs and five ticket designs, business/logo controls and optional ticket prices. Reports retain currency precision; staff performance includes all assigned workers and frozen commissions; Business overview labels net cash flow accurately. Finance screens fetch only the selected permitted data.
- Apply the additional `20261008020000_operator_workflows` migration with `npm run prisma:deploy` after the backup/baseline procedure below, then regenerate Prisma and rebuild the UI. Existing users are not silently renamed or re-roled: the Admin can create an Accountant login or change an existing operator's role.

### Thermal printing and cutting

The default Browser mode opens a normal 58mm/80mm print dialog; auto-cut must be configured in that printer's driver. For application-controlled cutting, choose Network ESC/POS with the local printer IPv4/port, or Windows RAW with the exact installed thermal printer name. Enable Auto-cut only on a printer that supports the ESC/POS cutter command. Print previews always use the browser.

Direct printing renders the saved invoice/ticket server-side, feeds the configured lines and sends one optional cut command. A persisted request key prevents an automatic repeat of a confirmed send. An uncertain/failed send is blocked from automatic replay: inspect the printer before deliberately starting a new print. This cannot guarantee exactly-once physical output after a connection failure. Windows RAW and the physical cutter require testing on the shop PC/printer; local TCP packet tests verify command generation and replay handling only.

## Validation completed

- `npm run test:integrity`: 27 regression scenarios using real controllers and rollback-capable isolated database fixtures. Covers authentication, revoked sessions, stored PINs, unauthorized password reset, repeat expenses, transaction rollback, advance ownership/excess, checkout replay/overpayment, split accounts, stock shortage/replay, alert retry, serialization retry, Karachi dates, shared commissions, backup corruption, balance collection, payment reversal, refund tender allocation and drawer reconciliation.
- `npm run test:ui`: 13 Playwright scenarios with API fixtures, including intake, dispatch/completion, split checkout, receipt themes, reporting/loyalty, desktop/tablet/mobile layouts, Worker navigation and visible server failures. No browser runtime exceptions.
- Prisma schema validation and client generation; production frontend build; changed backend/script syntax and whitespace checks.

These tests do not prove PostgreSQL concurrency, applied migrations, successful real `pg_dump`/restore, NVR accuracy, Telegram/SMS delivery, physical printer output or Windows startup. Those must be tested on a disposable copy of the shop deployment before using real money. No live shop records were altered during this work.

## Existing shop update

1. Stop PM2 and copy the existing database plus `public/uploads` and private configuration to independent storage. Verify that a copy can be restored to a disposable PostgreSQL database. Preserve the current `.env`; do not overwrite it with example values.
2. Install root/client dependencies and generate Prisma: `npm install`, `npm --prefix client install`, `npm run prisma:generate`.
3. Compare the existing database with the baseline migration. If the installation was created using `prisma db push` and matches the baseline, record **only the baseline** as applied:

   ```sh
   npx prisma migrate resolve --applied 20261008000000_baseline
   npm run prisma:deploy
   ```

   A fresh empty database uses `npm run prisma:deploy` without the resolve command. If the old database has additional/different tables or columns, reconcile that difference first. Do not reset the database or mark the corrections migration applied without executing it.
4. The new unique bay index rejects existing duplicate active assignments. Inspect and reconcile those jobs before applying the migration; do not delete financial records to bypass it. Legacy completion dates are inferred from the existing `updated_at`; review historical payroll where that date was edited after completion.
5. Existing aggregate bank balances are not automatically reassigned to named banks. Reconcile those balances and legacy payment allocations. Old bank advances without verified account IDs cannot safely be refunded until allocation is reviewed. The migration preserves original advance amounts and initializes remaining values from their existing status; review previously partially applied legacy advances.
6. Rotate any credentials originally created from published/demo defaults. The local operator can set `SHOP_ADMIN_NAME`, `SHOP_ADMIN_PASSWORD` (12+ characters) and `SHOP_ADMIN_PIN` (4–8 digits) and run `node scripts/set-owner-password.js --confirm-reset`. It requires exactly one matching active Admin, records an audit and revokes sessions. Remove setup passwords/PINs from the environment afterwards. For a new shop only, `npm run prisma:seed` initializes an owner and empty ledgers without overwriting existing data.
7. Leave `JWT_SECRET` blank to generate an installation key, or supply a private random value of 32+ characters. The old example signing key is ignored. Keep `private/session-secret` private and include it in backups. Configure `BACKUP_PRIMARY_DIR` and `BACKUP_SECONDARY_DIR` on separate physical drives and PostgreSQL binary paths if needed. Run `npm run backup:shop`; verify both results. Hardware features remain disabled for fresh installations until configured.
8. Build with `npm run build:client`, then start PM2. Open the shop at `http://SHOP-PC-IP:5000`. Port 3000 redirects to the same server. Sign in using the actual account credentials. Test tablet photo upload, split-bank payment, partial collection, authorized reversal/refund, drawer reconciliation, network-failure alert retry and both detailing bays on a disposable database first.
9. Test concurrent checkout/material/transfer requests against PostgreSQL and confirm one durable result per request key, correct balances and no negative stock. Verify the migration on a restored copy, the new bay index, crash recovery, file permissions, Windows restart and physical print readability. Browser fixtures are not substitutes for these deployment gates.

## Restore

Stop the app. Point `RESTORE_DATABASE_URL` at the intended replacement database. Run:

```sh
npm run restore:shop -- BACKUP_DIRECTORY --confirm-replace
```

The command verifies checksums before replacing database content and copying shop files. Use a clean destination installation; copying files does not remove unrelated existing files. The primary and secondary paths must be configured explicitly; software cannot prove they are separate physical devices.

## Remaining product work and limits

- Booking calendar/reminders, fleet credit statements, purchase/supplier accounts and approved payroll/dividend settlement periods remain separate product milestones. Monthly payroll/dividends are calculations, not immutable approved payouts; historical base salaries and legacy unsnapshotted costs still need review.
- FinancialMovement is an append-only application record of asset changes, not a full balanced general journal. Database administrators can still modify records. Do not claim absolute theft prevention, tamper-proof accounting, guaranteed liability protection or automatic dividend payment.
- Stock accuracy depends on recorded material issues, verified restocks and physical counts. Camera detection provides an arrival audit; reliable offline OCR installation/model assets and a live POS autofill experience still need hardware validation.
- Notifications provide at-least-once delivery: a crash after a provider accepts a message can cause a retry/duplicate. Explicit request keys prevent repeat financial mutations while retries reuse the same key; starting a new action with a new key intentionally represents a new operation.
- Reports distinguish cash flow from profit. Review accounting treatment of wages, costs, refunds and opening balances with the shop's accountant before distributing profit. The 23:59 report is a snapshot; activity after that snapshot belongs in the next reconciliation.
- Remote access must use HTTPS and appropriate access controls. An approval PIN confirms knowledge of a secret; it cannot prove an Admin is physically present.
