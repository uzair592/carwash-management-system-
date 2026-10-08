# PUREPACK UI refresh

Clean light workspace with persistent sidebar, short navigation labels, an intake form with searchable services and a running job summary, physical bay cards, compact billing, and consistent finance/settings screens. Uses local system fonts and preserves existing REST endpoints.

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

## Existing deployment limitation

The repository still uses a localStorage role selector and trusted role headers; the management screen is initially unlocked. This UI change does not add secure authentication. Implement server-verified identity/authorization before exposing this application beyond the trusted shop environment.
