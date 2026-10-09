# DF PRO architecture

## Runtime

The shop PC runs one Node/Express API on port 5000, PostgreSQL and the built React UI. PM2 also runs the port-3000 entry redirect to port 5000. Tablet requests stay on the LAN. There is no paid cloud dependency for normal shop operation. Telegram delivery requires internet; Android SMS depends on the configured local phone.

Hardware listeners currently run within the backend process and use bounded asynchronous work. This is not full process isolation. Camera failures must be tested separately from billing before enabling the device.

## Data and money

Prisma migrations define users, vehicles, service/job lines, invoices/payments, advances/applications, refunds, banks, register sessions, inventory/material issuance, partner records, overtime, audit and alert outbox records. Admin and Accountant are the supported login types; Worker records retain work/pay assignments without credentials.

Financial operations use serializable transactions, advisory locks, retry handling and request keys. The mutable cash/bank balance tables are separate from the financial movement log. This provides recorded asset movements, not a complete double-entry general ledger or database-administrator tamper protection. Posted financial changes use correction/reversal workflows instead of destructive invoice editing.

Overtime stores work date, minutes, hourly rate, calculated pay and reason. Rate changes affect new entries; removals retain history. Monthly payroll includes overtime and feeds monthly partner calculations. Actual wages still need a separate settlement workflow.

## Notifications

Transactionally queued alerts are delivered by the outbox worker with backoff. Delivery is at-least-once: a crash after provider acceptance can cause a duplicate. The active sender uses plain text. Group pacing/digests and delayed-delivery labels remain open improvements. EOD uses Asia/Karachi, but missed-day catch-up is not implemented.

## Deployment and recovery

`start-shop.bat`/`.sh` only start PM2. `install.bat` handles empty databases. `update-shop.bat` stops the app and requires verified pre-migration backup for existing databases; it does not reseed them. The schema is changed using `prisma migrate deploy`, never daily `db push`. Windows unattended startup must be configured/tested with the shop service account.

Nightly backups use PostgreSQL custom dumps and copied media/private files on two configured drives. Admin UI backups use a validated `.dfpro` archive. Restore pauses shop work, saves a safety copy, checks schema compatibility, restores database/media and revokes sessions. Failure/interruption recovery uses the safety copy. Only one backend instance is supported during backup/restore; external database writers are not covered by its maintenance lock.

## Configuration and acceptance

Hardware IPs in examples are placeholders, not reserved addresses. `HIKVISION_NVR_IP`, camera credentials, `SMS_GATEWAY_URL`, printer settings and backup paths must match the physical shop. The SMS default endpoint is `http://192.168.1.150:8080/v1/sms/send`. Camera credentials supplied in the RTSP URL can still be visible in the FFmpeg process arguments; this remains unresolved.

Use [README.md](README.md) for current workflows and [docs/REPAIR_RELEASE.md](docs/REPAIR_RELEASE.md) for migration, restore and printer acceptance. Before go-live, validate native database restore/concurrency, power loss, internet outages, printer failures, reboot autostart, hardware failure isolation and credential rotation on a disposable shop copy.
