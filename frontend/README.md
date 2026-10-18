# StepSafe frontend

React 19 + TypeScript + Vite app for StepSafe. See the [main README](../README.md) for what the project does, setup for the whole app, the API and known limitations.

## Run

```sh
npm install
npm run dev      # http://localhost:5173, proxies /api to the backend on :3001
npm run build    # type-check and build to dist/
npm run lint     # oxlint
```

Start the backend first (`cd ../backend && npm run dev`). Without it the app runs in **Demo Mode** with built-in sample data.

## Where things are

| File | What it holds |
|---|---|
| `src/App.tsx` | App state: reports, routes, location, modals, tabs; first-tap audio unlock |
| `src/config.ts` | Categories, demo-area bounds, fallback haptic patterns and sample data, `SHOW_SENSOR_LAB` switch |
| `src/types.ts` | Shared types (`Report`, `Route`, `RouteWarning`, …) |
| `src/components/OnboardingScreen.tsx` | Intro and safety disclaimer (acceptance stored as `stepsafe_onboarding_v2`; bump the version when the text changes) |
| `src/components/MapContainer.tsx` | Leaflet map: hazard pins, route line, walker dot, report and destination pins, campus bounds |
| `src/components/NavigationHUD.tsx` | Route guidance: live and prepared routes, cue timing and queue, walk simulation, live GPS, compact phone bar |
| `src/components/ReportModal.tsx` / `ReportDetailModal.tsx` | Submit a report / view, confirm or flag one |
| `src/components/HapticTestModal.tsx` | Plays each cue and shows its timing |
| `src/components/SensorLabModal.tsx` | Experimental accelerometer demo (hidden by `SHOW_SENSOR_LAB`) |
| `src/services/api.ts` | Backend calls with Demo Mode fallbacks; client-side route warnings |
| `src/services/routing.ts` | Campus landmarks, place search (Nominatim), live walking routes (OSRM foot), turn simplification |
| `src/services/haptics.ts` | Vibration patterns, synthesized cue sounds, iOS audio unlock |
| `src/services/geo.ts` | Distances, projecting points onto a route, bounds checks |

## Notes

- Cue timing constants (turn and hazard lead distances, queue gap, simulation speed) are at the top of `NavigationHUD.tsx`; turn-merging distances are in `routing.ts`.
- Online place search runs only on Enter: Nominatim's usage policy forbids search-as-you-type.
- `vite.config.ts` allows `.trycloudflare.com` hosts so phones can use a Cloudflare quick tunnel (see the main README).
