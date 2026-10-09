# DF PRO integrity repair release

This branch repairs existing workshop, accounting, authentication and deployment flows. It preserves the compact UI and adds actual sign-in, sign-out, remaining-balance collection, vehicle-linked advances and notification delivery status. It does not certify the shop as a complete double-entry ERP.

## Changes

- Authenticate every protected API request using an expiring signed session and the current active user record. Ignore caller-supplied role/user headers. Password, PIN, role and activation changes revoke sessions. Only Admin and Accountant logins are accepted; workshop staff are personnel records.
- Use installation-specific signing material, stored approval PINs, login/approval rate limiting and protected vehicle evidence. Remove hardcoded login/PIN fallback paths. Preserve damage evidence instead of deleting it through the UI.
- Make checkout, additional collections, reversals, refunds, expenses, advances, transfers, material issues and partner cash movements transactional. Use serializable transactions with bounded conflict retries and advisory locks. Freeze invoice line descriptions/prices. Generate daily document numbers with transactional counters.
- Validate currency precision, tender/change, overpayment, named bank accounts and available balances. Persist request keys for mutation retries. Checkout additionally has one-invoice-per-job protection. Refund the actual available tender allocation, cap cumulative refunds and never return consumed chemicals merely because money was refunded.
- Keep unused advances as a remaining liability. Reject another vehicle's advance. Separate sales, collections, advances, receivables, refunds and net cash flow in reports. Split payment summaries now use individual payment records.
- Enforce workshop state transitions and one active vehicle per physical bay. Preserve start/completion timestamps. Count completed visits for loyalty. Freeze commission policy at completion and allocate percentage commissions across all assigned workers.
- Reject material shortages and duplicate issues; capture actual unit cost at issuance. Service mapping edits and audit writes are transactional. Standard yield mappings describe expected usage; workers still record actual materials during work.
- Retry failed alert deliveries with backoff and claim leases. Do not mark unconfigured/failed notifications as delivered. Queue checkout SMS receipts. Persist camera arrivals, normalize plate matching and audit unmatched arrivals after the grace period. Repair camera stream reconnect handling.
- Use Karachi reporting/scheduling dates. Serve the production UI and API together; the legacy UI port redirects to the API server. Back up database, uploaded evidence and private signing material to both configured destinations with checksums and 14-day retention. Provide a guarded restore command.

## Compact two-account UI update

Settings now contains Accounts (Admin/Accountant only) and Accountant access. Workshop staff have a separate compact list and create/edit form with no password or role fields. Removed the oversized credential-security banner, record IDs, mixed-role controls, duplicated finance header and multicolour finance tabs. Print templates and existing operational controls remain available.

Apply `20261009000000_two_operator_accounts` with the existing backup/migration procedure. Existing Cashier/Manager records become Accountant accounts; Worker records retain assignments/pay/activation but their obsolete login credentials are cleared; Investor records remain for history with logins disabled. Existing Admin credentials remain intact. Sessions for converted accounts are revoked. Historical enum values remain in PostgreSQL to preserve old records, but they cannot be selected or used to log in.

## Operator workflow update

- Settings now includes the service catalog: create, edit price/material mappings and archive/reactivate services. Active tickets also support adding/removing services before billing; price snapshots and recorded material issues are retained. Adding work to a ready ticket returns it to the queue. Version checks reject conflicting edits; committed invoices remain locked.
- The shop uses only Admin and Accountant operator accounts. Workshop staff are personnel records without login credentials. Settings → Accounts manages operator names/passwords and the Admin approval PIN; Inventory & finance → Workshop staff manages names, pay and activation. No role selector is shown. Admin permissions are fixed; an Admin can change the Accountant's individual permissions in Settings → Accountant access. Server checks use the current saved grants on every request and the UI refreshes them every 30 seconds. Authorized sessions approve their own permitted operations without repeated PIN entry; a restricted discount may still request an authorized approval PIN. Admin-only account/permission management cannot be granted to the Accountant.
- Workshop dispatch uses bay buttons only, with both detailing bays and multiple workers. Checkout is compact, with editable collection, named banks and optional discount/advance details. All print actions use blue buttons.
- Settings offers six bold invoice designs and five ticket designs, business/logo controls and optional ticket prices. Reports retain currency precision; staff performance includes all assigned workers and frozen commissions; Business overview labels net cash flow accurately. Finance screens fetch only the selected permitted data.
- Apply the additional `20261008020000_operator_workflows` migration with `npm run prisma:deploy` after the backup/baseline procedure below, then regenerate Prisma and rebuild the UI. Existing users are not silently renamed or re-roled: the Admin can create an Accountant login or change an existing operator's role.

### CRUD actions

Customer directory includes Add customer and Edit customer for optional name/phone/make/model. Plates are fixed after creation so editing contact details cannot reassign another vehicle's tickets. Delete unused record requires an explicit confirmation and rejects vehicles with tickets or advances.

Inventory includes Add Consumable, Edit item and Restock. Editing a counted quantity requires a reason and records the before/after counts. Units cannot change once stock, service mappings or material history exists. Only empty, unused inventory items can be deleted; linked or used items retain their history. Server permission checks cover all create/update/delete endpoints and all changes are audited.

Services use add/edit/archive/reactivate; staff use add/edit/deactivate/reactivate; bank accounts use add/edit and protected removal. Invoices, financial movements, customer advances and inspection evidence are retained. Their correction flows use additional collections, credits, refunds or reversals. Reports, staff performance and Business overview are derived views, rather than independently editable records.

### Thermal printing and cutting

The default Browser mode opens a normal 58mm/80mm print dialog; auto-cut must be configured in that printer's driver. For application-controlled cutting, choose Network ESC/POS with the local printer IPv4/port, or Windows RAW with the exact installed thermal printer name. Enable Auto-cut only on a printer that supports the ESC/POS cutter command. Print previews always use the browser.

Direct printing renders the saved invoice/ticket server-side, feeds the configured lines and sends one optional cut command. A persisted request key prevents an automatic repeat of a confirmed send. An uncertain/failed send is blocked from automatic replay: inspect the printer before deliberately starting a new print. This cannot guarantee exactly-once physical output after a connection failure. Windows RAW and the physical cutter require testing on the shop PC/printer; local TCP packet tests verify command generation and replay handling only.

## Validation completed

- `npm run test:integrity`: 30 regression scenarios using real controllers and rollback-capable isolated database fixtures. Covers authentication, revoked sessions, stored PINs, unauthorized password reset, repeat expenses, transaction rollback, advance ownership/excess, checkout replay/overpayment, split accounts, stock shortage/replay, alert retry, serialization retry, Karachi dates, shared commissions, backup corruption, balance collection, payment reversal, refund tender allocation and drawer reconciliation.
- `npm run test:ui`: 16 Playwright scenarios with API fixtures, including intake, dispatch/completion, split checkout, receipt themes, reporting/loyalty, desktop/tablet/mobile layouts, restricted Accountant navigation and visible server failures. No browser runtime exceptions.
- `npm run test:migrations`: all migration SQL files applied to fresh and legacy-fixture disposable PostgreSQL WASM engines; verified preserved invoice totals, remaining advances, completion timestamps, PIN-secret removal, permission JSON, new roles, unique print keys and active bay alias constraints. This is not a Prisma deployment to the shop server or a multi-process concurrency test.
- `node --test scripts/test-printer-self-test.cjs`: test CLI requires explicit paper confirmation and sends one labelled test job with exactly one cut command to a local TCP sink.
- Prisma schema validation and client generation; production frontend build; changed backend/script syntax and whitespace checks.

These tests do not prove PostgreSQL concurrency, migrations applied through Prisma on the shop server, successful real `pg_dump`/restore, NVR accuracy, Telegram/SMS delivery, physical printer output or Windows startup. Those must be tested on a disposable copy of the shop deployment before using real money. No live shop records were altered during this work.

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


## Shop-side printer acceptance

The physical printer is outside the remote development environment. No physical print or cutter result was observed here. After updating dependencies, choose one command on the shop PC:

```sh
# Local network ESC/POS printer: replace the address with the real printer IP.
npm run printer:self-test -- --mode NETWORK --host 192.168.1.50 --width 80 --cut --send --confirm-paper

# Windows-installed ESC/POS printer: replace the name with the exact installed name.
npm run printer:self-test -- --mode WINDOWS --printer "Your Thermal Printer" --width 80 --cut --send --confirm-paper
```

Use `--width 58` for 58mm paper. Omit `--cut` for printers without a cutter. Without `--send`, the command only generates a `.bin` sample and does not send paper. A success response means the transport/spooler accepted the job, not that the paper physically printed.

Confirm bold readable text, aligned amounts, no excessive top gap, and exactly one cut. If a send fails or the outcome is unclear, inspect the device before running it again. Then print one saved bill and one work ticket from the app, checking each configured template and the logo on the actual paper. Browser mode cutter behaviour belongs to the driver and must be tested separately.

`npm run test:migrations` requires the development dependencies. It uses disposable in-memory PostgreSQL and does not open or modify DATABASE_URL. The real installation still needs the backup and `npm run prisma:deploy` procedure above.


## Username/password login and downloadable backups

Login now requires **Username and Password** for Admin or Accountant. The Username field in Settings → Accounts is the login identifier. Passwords are set/reset by Admin there; existing saved passwords remain unchanged. A correct approval PIN cannot bypass an incorrect password. Approval PINs continue to protect restricted actions, and workshop staff have no login credentials. Duplicate usernames are rejected when editing accounts.

Admin can use Settings → Backup & restore to download a verified `.dfpro` file or upload/check one before restoring. The file contains the PostgreSQL custom dump, uploaded photos/logo, and the local session signing key when present. It does not contain `.env` or external hardware credentials. Keep the file private. Restoration replaces database and uploaded files, invalidates sessions, and requires signing in with credentials saved in that backup.

Backup/restore briefly pauses new shop requests and drains existing HTTP/background work. Restore first creates a verified safety copy under `backups/safety`, visible for download in Settings. Failed restore attempts recover that copy; an interrupted restore leaves a durable marker that triggers recovery before the server accepts requests on restart. Run only the supported single backend instance during these operations. External database clients or standalone maintenance scripts must not mutate the shop while a backup or restore runs.

UI backups require the configured `DATABASE_URL` and working `pg_dump`/`pg_restore` binaries on the shop PC (`PG_DUMP_BIN`/`PG_RESTORE_BIN` can specify Windows paths). Use matching PostgreSQL tools. Restore accepts backups with the same latest migration version as the installed software, limits expanded data to 2 GiB, and validates archive paths/checksums before changing shop data. Nightly dual-drive backups remain a separate existing schedule; a UI download does not require its drive configuration. No new migration is introduced by this update.

Validation: 30 integrity tests (including password-only authentication and backup access restrictions), 5 archive/restore tests, 17 browser scenarios, and production frontend build passed. Restore tests exercise real archives/files/maintenance with mocked PostgreSQL tool calls. A native PostgreSQL backup/restore acceptance test on the Windows shop installation remains required; these checks do not claim that the live shop database was restored.


## Staff overtime

Inventory & finance → Monthly Payroll now includes Staff overtime. Set a worker's default overtime rate through Workshop staff → Edit worker. Add actual overtime by work date, hours, hourly rate and reason. The rate and calculated amount are stored per entry; later default-rate changes do not change previous entries. Payroll adds overtime to salary and commissions, and monthly partner calculations that use payroll include this cost. Entries can be edited with conflict detection or removed with a reason; removed entries retain their history and are excluded from payroll.

Existing payroll.read/payroll.manage permissions control overtime viewing and changes for Admin/Accountant. Workers do not receive logins. Future dates, invalid amounts and totals exceeding 24 overtime hours per worker/day are rejected. Retries reuse a request key. This records payroll owed; it does not automatically withdraw cash/bank funds or settle wages. No shift system or automatic statutory overtime multiplier is assumed; enter the shop's agreed rate.

Before enabling on the shop PC: back up first, then run `npm run prisma:deploy`, `npm run prisma:generate`, rebuild the UI and restart the backend. Migration `20261009010000_staff_overtime` adds a default-zero hourly rate and overtime records without changing existing balances or salaries. UI backups created before this migration require the matching prior software version for restore.

Overtime validation: 31 controller/integrity scenarios, 18 browser scenarios, production frontend build and fresh/legacy migration checks passed. Database locking concurrency and deployment on the shop PC remain acceptance checks.


## Daily-use improvements and safe startup

Staff performance and Workshop staff provide an Overtime & pay shortcut. Payroll uses shorter headings/readable tab labels. Balance collections focus the amount field, show the balance remaining, and allow Escape to close while idle.

Windows: use install.bat only for an empty database; update-shop.bat for a reviewed existing installation; start-shop.bat for daily startup. Existing updates require verified dual-drive backups before migration and skip seed. Database setup fails closed on migration/backup errors. Daily startup only starts/saves PM2. Linux daily startup is also schema-neutral; follow the documented manual backup/migration procedure for installation/update. Windows Task Scheduler and power settings remain shop-PC configuration, not changes executed by this release.

Validation for this update: 31 integrity scenarios, 19 browser scenarios, 5 setup/launcher control-flow tests (mocked system commands), production frontend build and whitespace checks. Real Windows installation, scheduled startup and hardware remain unverified here.

## Installable app / offline viewing

Production builds now include a manifest, app icons and an offline app shell. Account-scoped IndexedDB supports saved GET viewing, with offline mutations blocked. Authentication/server errors never fall back to cached success; sign-out/session rejection clears saved data. Saved profiles expire after seven days without online validation. Save latest for offline stores supported summaries and up to 250 recent invoices, not a full database/photos backup. See docs/MOBILE_APP.md for HTTPS install, tunnel/access setup and acceptance.

PWA checks: production service-worker offline reload/reconnection/rejected-session purge passed; 31 integrity scenarios, 19 browser scenarios and frontend build passed. Live HTTPS/domain provisioning and installation on the shop phone remain pending.
