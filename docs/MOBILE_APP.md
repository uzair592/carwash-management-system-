# DF PRO mobile access

DF PRO is an installable web app (PWA), not an Android APK or an iPhone App Store package. PostgreSQL, uploaded vehicle photos, printers and the live API remain on the Windows shop PC.

The PWA can show current information only while the phone can reach that PC. Its offline mode is a selected, read-only snapshot for one signed-in account; it is not a copy or backup of the entire database.

## One-time Windows setup

Complete the normal DF PRO installation or update first (`install.bat` for an empty first-time database, or the documented `update-shop.bat` flow for an existing shop). For an already installed copy, open **Command Prompt** on the shop PC and run:

```bat
cd /d "C:\Users\HP\Desktop\service management system"
npm run build:client
node scripts\shop-launch.js
```

Confirm that `http://localhost:5000/api/health` opens on the shop PC. The mobile launcher probes the configured ports and selects the endpoint whose health response identifies the DF PRO API. In the current production configuration this is port 5000; port 3000 is only a local redirect.

Install Cloudflare's connector:

```bat
winget install --id Cloudflare.cloudflared --exact
```

Close and reopen Command Prompt, then verify it:

```bat
cloudflared --version
```

No PostgreSQL, router, printer, camera or other inbound port should be opened. The tunnel must point only to the DF PRO web origin. Never put database or login credentials in the launcher, Git, or a Cloudflare command.

## Start a free Quick Tunnel

Start DF PRO first, then double-click `start-mobile-tunnel.bat`, or run:

```bat
cd /d "C:\Users\HP\Desktop\service management system"
start-mobile-tunnel.bat
```

The launcher:

1. checks that DF PRO is responding and detects its actual production port;
2. checks that `cloudflared` is installed and on `PATH`;
3. runs `cloudflared tunnel --url http://127.0.0.1:DETECTED_PORT --no-autoupdate`;
4. prints the generated `https://...trycloudflare.com` address.

The hostname is read from `cloudflared` output; it is never hardcoded. Keep the tunnel window open while phones use the app. Press `Ctrl+C` to stop it.

Quick Tunnel addresses are temporary and normally change after `cloudflared` restarts. Browser storage is isolated by origin, so snapshots saved under an old hostname do **not** automatically appear under a new hostname. Open the new URL, sign in again, and use **Save latest for offline** again.

Quick Tunnels are suitable for setup and temporary access. Anyone who learns the random URL can reach the DF PRO login screen, although Admin/Accountant credentials are still required. Use a named Cloudflare Tunnel with a stable hostname and Cloudflare Access for long-term production use.

Cloudflare reference: [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

If automatic detection must be overridden for diagnosis, the explicit port is still health-checked:

```bat
node scripts\quick-tunnel.js --port=5000
```

## Install on Android

1. Keep the shop PC, PostgreSQL, DF PRO, the tunnel window and internet connection running.
2. Open the generated HTTPS URL in Chrome.
3. Sign in with the normal Admin or Accountant username and password.
4. Open Chrome's menu and choose **Install app** or **Add to Home screen**. If DF PRO shows an **Install app** menu action, that can also be used.
5. In DF PRO's sidebar, choose **Save latest for offline** while online.

## Install on iPhone or iPad

1. Open the generated HTTPS URL in Safari.
2. Sign in online.
3. Tap **Share** and then **Add to Home Screen**.
4. Open the new DF PRO icon once while online and choose **Save latest for offline** in the sidebar.

Safari does not use Chromium's install prompt, so the Share menu is the expected installation method.

## Exactly what offline saving stores

**Save latest for offline** stores authorised JSON snapshots for the current account:

- current workshop queue, ready-for-billing list and bay state;
- current cash/bank ledger summaries, register state and configured bank accounts when permitted;
- the live business overview;
- service catalogue, customer directory, inventory and staff lists when permitted;
- today's and this month's staff leaderboard and report summaries when permitted;
- current-month payroll and overtime views when permitted;
- business branding; and
- up to 250 recent invoices in five pages of 50 when billing access is permitted.

Other supported pages, searches and date ranges are saved only after that account views them online. The service worker caches only the public application shell. API responses are stored separately in account-keyed IndexedDB.

The offline snapshot does **not** include the complete PostgreSQL database, uploaded vehicle photos/media, backup archives, unvisited queries, arbitrary historical ranges, passwords, PIN hashes or a database restore capability.

Saved profiles expire seven days after the last successful online validation. Signing out, switching accounts, permission changes, or a rejected session clears saved data before another account can use it. Browser storage can also be cleared or evicted by the phone and must never be treated as a backup.

## Offline behavior and safety

When the shop PC or tunnel cannot be reached, the sidebar shows **Offline — saved data** and the last successful sync time.

Offline access is read-only. Payments, refunds, new tickets, service/stock/staff/payroll edits and every other POST, PUT, PATCH or DELETE operation are blocked before network transport. Mutations are not queued for later. HTTP authentication, permission, validation and server failures remain failures and are never converted into cached success responses.

On reconnection, DF PRO returns to live API data and validates the session. A rejected or revoked session signs the user out and deletes its saved data.

## Acceptance checks on the real shop PC and phone

Automated tests cannot replace these checks:

1. Open the printed HTTPS URL using phone mobile data, not shop Wi-Fi.
2. Sign in as Admin, confirm live queue/balances, and save the offline snapshot.
3. Stop the tunnel or disconnect the PC internet, fully close the installed PWA, and reopen it.
4. Confirm **Offline — saved data**, the correct last-sync time, and disabled payment/refund/edit controls.
5. Restart the tunnel, note that its URL changed, and confirm the new origin requires sign-in and a new offline save.
6. Repeat with an Accountant and verify only permitted data is visible.
7. Sign out and confirm the device no longer opens that account's saved pages.

Do not claim remote hardware, printers, power-loss recovery or physical-phone installation are verified until these checks are completed on the actual devices.
