# DF PRO Car Wash & Detailing Center

Local-first shop software for Admin and Accountant, with workshop staff records that need no login. The Node/Express server, PostgreSQL database, vehicle photos and print settings run on the shop PC. Telegram needs internet; its database outbox retries failed delivery.

## Daily use

Open `start-shop.bat` on Windows (or `./start-shop.sh` on Linux), then browse to `http://localhost:5000`. Tablets use `http://SHOP-PC-IP:5000`. Daily startup only starts PM2 and saves its process list: it never installs dependencies, changes the schema or seeds data.

- **New vehicle:** enter the plate, select service tiles and create a ticket. Customer name/phone are optional.
- **Workshop:** assign Jack 1, Jack 2 or one of two detailing bays; mark work complete.
- **Billing & invoices:** collect cash, bank/card or split payments and print/reprint receipts. Partial payments and vehicle advances are supported.
- **Staff performance:** review work and use **Overtime & pay** to open monthly payroll.
- **Inventory & finance:** edit services/prices, workers, bank accounts, stock, overtime and payroll.
- **Settings:** configure printers/devices, Admin/Accountant accounts, Accountant permissions and backup download/restore. Backup controls are Admin-only.

Login uses the Username and Password saved in Settings → Accounts. There are no published default passwords. Admin approval PINs are separate from login passwords.

## First installation

Install Node.js and PostgreSQL on the shop PC, create an empty shop database and configure `.env`. Set `DATABASE_URL`, `SHOP_ADMIN_NAME`, `SHOP_ADMIN_PASSWORD` (12+ characters) and `SHOP_ADMIN_PIN` (4–8 digits). Double-click `install.bat`. It installs locked dependencies, checks that the database is empty, deploys migrations, seeds the initial owner/empty balances, builds the UI and starts PM2. Remove setup secrets from `.env` afterwards.

`install.bat` refuses databases that already have tables. It does not reset them.

## Existing shop update

Close shop activity first. Configure `BACKUP_PRIMARY_DIR` and `BACKUP_SECONDARY_DIR` on independent drives, plus `PG_DUMP_BIN` and `PG_RESTORE_BIN` if PostgreSQL tools are not on PATH. Use `update-shop.bat`: it stops the configured shop processes, installs locked dependencies, verifies a backup before migration, deploys migrations, regenerates Prisma, builds the UI and starts the shop. A failure stops the update; the shop stays closed until resolved. Existing databases are not seeded.

If the original database was created with `db push`, follow the baseline reconciliation instructions in [docs/REPAIR_RELEASE.md](docs/REPAIR_RELEASE.md) before using the update script. Never reset a working database to fix a migration error.

## Hardware and Windows

All hardware addresses are installation-specific `.env` values. Reserve DHCP addresses on the router. Configure the SMS gateway's actual endpoint through `SMS_GATEWAY_URL`; its default is `http://192.168.1.150:8080/v1/sms/send`. Configure NVR address/user/password explicitly. Hardware features should stay disabled until tested.

For unattended restart, configure Windows Task Scheduler to run `node scripts/shop-launch.js` at computer startup, with the project folder as **Start in**, under the same dedicated Windows account used for installation. Use the absolute Node.js path; select **Run whether user is logged on or not** and appropriate permissions. PM2 state and `.env` must be accessible to that account. Test a reboot without signing in. Configure Windows power settings to prevent sleep/hibernate; use a UPS. These scripts do not automatically change Windows policies or save account passwords.

Test thermal printer readability, cutting and failure handling on the physical device. See [repair/release instructions](docs/REPAIR_RELEASE.md) for printer commands and backup recovery.

## Accounting and verification

The software records a **financial movement log** with separate cash/bank balances; it is not a complete double-entry general journal. Payroll/overtime totals calculate pay owed and do not automatically settle wages. History protection, complete wage settlement, EOD catch-up and real hardware/deployment acceptance remain separate work.

Run `npm run test:integrity`, `npm run test:ui`, `npm run test:migrations`, `npm run test:backup-restore` and `npm run test:startup`. Automated tests do not replace real PostgreSQL concurrency, restore, power-loss, offline messaging, reboot or physical printer tests.

## Mobile app

DF PRO builds as an installable PWA with account-scoped, read-only offline snapshots. For temporary phone access, install `cloudflared` and run `start-mobile-tunnel.bat`; it detects the live production port and prints the generated Quick Tunnel HTTPS URL. See [mobile app setup](docs/MOBILE_APP.md) for Windows commands, Android/iPhone installation, the exact saved-data scope and Quick Tunnel limitations.
