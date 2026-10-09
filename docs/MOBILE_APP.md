# DF PRO installable app

This is a PWA, not a compiled Android APK. PostgreSQL stays on the shop PC. Remote live data requires that PC, database, PM2, tunnel and internet to be available.

## Install and use

Build the client and restart the shop. Open a permanent HTTPS hostname on your phone, sign in online and install through Chrome/Edge's menu (or the Install app button when offered). iPhone: Safari → Share → Add to Home Screen. Ordinary HTTP LAN addresses do not support service workers; HTTPS is required on mobile. Localhost works for host-PC testing.

Enable Save data on this device on a trusted device. Save latest for offline downloads authorised summaries, balances, catalog, customer list, current reports/payroll and up to 250 recent invoices. Other pages/searches/date ranges are saved when viewed online. This is a selected snapshot, not a full database backup. Photos, backup archives and credential/audit administration are excluded. Unvisited queries cannot be reconstructed offline.

When unreachable, the installed shell shows Offline · view only and the saved-data time. Payments, refunds, stock/pay edits and other mutations are blocked; no mutations are queued. A saved account can view its local copy for seven days after last successful online validation. Reconnecting checks the session again; rejection clears saved data. Permission changes refresh the profile and purge old caches. Offline devices cannot learn of a revocation until reconnection.

Sign out clears saved data. Turning saving off deletes snapshots. Browser storage may be cleared, evicted or fill up; it is not a backup. Protect the phone with the OS screen lock and avoid incognito browsing for offline use. Close/reopen all DF PRO windows to activate a waiting app-shell update.

## Remote setup still required

Configure a permanent HTTPS Cloudflare Tunnel hostname protected by Cloudflare Access and the app's Admin/Accountant login. Point its published HTTP service at http://localhost:5000. Restrict Access to authorised identities before sharing the URL. Keep database, NVR, SMS and printer ports private. Run the tunnel connector on the Windows shop PC as a startup service alongside PM2. Keep its credentials out of git.

A domain/Cloudflare account and local connector configuration are still needed; this code does not provision a public URL or configure your router. Temporary tunnel URLs change and create separate device storage, so use one stable hostname.

Test on mobile data: install, save latest, turn off the shop server, reopen and verify the saved timestamp; restart and verify refresh. Test sign-out, revoked login, Accountant permissions and a second phone separately. Each device/origin has its own cache.

The service worker caches only the public app shell; API/media are never service-worker cached. Authorised JSON snapshots use account-scoped IndexedDB. Real phone installation, live tunnel, Windows autostart, native database restore and physical printer tests remain shop-side acceptance steps.
