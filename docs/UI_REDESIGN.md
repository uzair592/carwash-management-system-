# DF PRO UI refresh

Business-style workspace with navy navigation, red primary actions, a compact balance strip, searchable service tiles and a fixed ticket summary. Four physical bays fit across the desktop workshop, with responsive tablet and phone layouts. Billing uses consistent cards and tables. Uses local system fonts and preserves existing REST endpoints.

## Run

```sh
npm --prefix client ci
npm --prefix client run dev
npm --prefix client run build
```

## Browser checks

Start the Vite server on port 3000 in a separate terminal, then:

```sh
cd client
npx playwright install chromium
npm run test:ui
```

`UI_TEST_URL` changes the server URL; `CHROMIUM_EXECUTABLE` selects an installed Chromium binary. Tests intercept API requests with isolated fixtures and exercise intake, thermal print preview, bay dispatch, checkout with split payments/deposits, overview, settings, role-specific navigation and network failure states at desktop/tablet/mobile sizes. These checks do not validate live accounting transactions or physical printer/camera/SMS integrations.

Screenshots under `docs/ui` use test data.

## Business UI refresh validation

Production build and all nine mocked browser scenarios passed. Workshop checks now use both detailing bays and assert four physical cards. The mobile workshop overflow reported in the prior audit is fixed. Preview screenshots are regenerated with isolated test data. This change covers frontend presentation; backend readiness requires separate verification.

## Compact workspace and bold receipts

Duplicate headings, location/status text and the sidebar role card are removed. The four balance/queue metrics appear only on New Vehicle. Cash drawer reconciliation lives in Settings and represents a shop cash drawer rather than staff shift scheduling.

The layout is checked at 1366×768 and 1920×1080, plus tablet and phone widths. Reports includes date filters and a print layout. Loyal Customers can open an intake form with the selected vehicle and customer details populated. Both pages show API failures with a retry action.

Settings offers Bold Table, Bold Boxed and Bold Compact invoice designs alongside the existing template choices. Receipts use local Arial/Helvetica with bold black text, item tables and prominent totals. A separate 80mm popup preserves receipt styles without the app layout. Actual paper output, printer driver margins and cutters still need testing at the shop.

Validation: production build, diff whitespace check and eleven isolated browser scenarios pass. Theme selection is saved through the existing branding API; print popup styling, Reports filters, customer reuse, mobile layout and role-specific navigation are checked with fixtures.
