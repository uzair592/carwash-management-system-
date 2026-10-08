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
