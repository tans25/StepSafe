# StepSafe — Haptic Navigation for Safer, More Accessible Walking

**Technica 2026 · Sensors for Good**

## Project overview

StepSafe is a mobile-friendly web app that makes walking navigation more accessible and helps people learn about sidewalk barriers. It combines distinct vibration and sound cues for turns and hazards with a community map of reported sidewalk barriers.

It is a hackathon prototype limited to the **University of Maryland, College Park** campus. It is not a replacement for established navigation or accessibility services.

## The problem

Walking directions usually depend on looking at a screen or listening to spoken prompts. Those methods do not work equally well for everyone or in every setting. Sidewalk closures, potholes, uneven pavement, standing water and other barriers can also make a route difficult or inaccessible, and information about them is often missing or out of date.

## What StepSafe does

| Feature | What it does today |
|---|---|
| **Intro and safety disclaimer** | First-time visitors see a short intro and must acknowledge a disclaimer before using the app. It can be reopened from the ⓘ **About** button. Location is requested only after the disclaimer, which explains how it is used. |
| **Hazard map** | Leaflet map of the UMD campus showing community reports by category, with age, a "may be outdated" label for stale reports, and a filter by category. The map is limited to the campus area. |
| **Community reporting** | Choose a category, review or pick the location on the map, add an optional note (max 280 characters) and submit. Others can **confirm** a report or **flag** it as inaccurate; a report flagged 3 times is hidden. Likely duplicates (same category within 15 m in 24 h) are detected. |
| **Route guidance: live** | Search a campus place, tap a landmark chip or tap anywhere on the map. A real walking route is fetched from OpenStreetMap data, starting from your location (or McKeldin Library if your location is unavailable or off campus). |
| **Route guidance: prepared** | Five hand-drawn campus demo routes stored in the backend. |
| **Turn and hazard cues** | Distinct vibration patterns plus sounds and on-screen text for left, right, hazard ("caution") and arrival. Hazards within 25 m of the route are listed and announced by category. |
| **Walk simulation and live GPS** | **Play** walks a simulated dot along the route (about 1 km per minute) so cues can be demoed indoors. **GPS** mode follows your real position outdoors. |
| **Haptic test** | The vibrate icon in the navbar opens a tester that plays each cue and shows its exact timing. |
| **Mobile layout** | On phones, once a route is chosen the panel shrinks to a compact bar (current cue, progress, Play/GPS/Reset) so the map uses most of the screen. |
| **Demo mode** | If the backend is unreachable, the app keeps working with built-in sample data. Reports made then are saved only on that device, and the app says so. |
| **Sensor Lab** (hidden) | An experimental accelerometer demo. It is switched off for the demo (`SHOW_SENSOR_LAB` in `frontend/src/config.ts`) and kept for future work. It never creates reports. |

Report categories: blocked sidewalk, pothole, uneven surface, standing water, construction/closure, missing curb ramp, and other. The form asks for no personal or medical information.

### Haptic cues

Patterns are defined in `backend/src/config.ts` and served to the app by `/api/meta`.

| Cue | Vibration (ms on / off) | Feels like | Sound |
|---|---|---|---|
| Left turn | 200 on · 100 off · 200 on | two medium pulses | two short rising beeps |
| Right turn | 500 on | one long buzz | one long falling tone |
| Hazard (caution) | 100 on · 50 off, four times | four rapid bursts | rapid staccato beeps |
| Arrived | 100 on · 100 off · 500 on | short tap, then a long buzz | rising chime |

All hazard categories use the same caution pattern; the category is shown and announced in the cue text.

**iPhones cannot vibrate from a website** (this applies to every iPhone browser, including Chrome). On iPhone the cues play as sounds only. The app unlocks audio on the first tap and asks iOS 17+ to play cue sounds even when the Silent switch is on. Android Chrome supports real vibration.

### How route cues are timed

- Cues fire by **distance along the route**, in route order: turns about 15 m before the turn, hazards about 25 m before, arrival about 8 m before the end. A cue that has already been passed never fires.
- Live routes are simplified: right-then-left jogs shorter than 12 m are dropped, two turns the same way within 12 m become one, and turns in the last 15 m before the destination are skipped. "Continue straight" never buzzes, because the caution pattern is reserved for hazards.
- Cues that trigger together are queued and played 0.9 s apart, so each one can be felt. A turn cue that is still waiting after the walker has passed it is dropped rather than played late.
- In GPS mode, being more than 35 m from the route shows "You are off the route" and pauses cues.

Tuning values are at the top of `frontend/src/components/NavigationHUD.tsx` and `frontend/src/services/routing.ts`.

## Technology stack

| Layer | Technology | Use |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | Mobile-friendly interface |
| Styling | Plain CSS (`App.css`, `index.css`) | Responsive, high-contrast dark theme |
| Map | Leaflet with OpenStreetMap tiles | Map, location, report and route markers |
| Walking routes | OSRM foot profile on `routing.openstreetmap.de` (FOSSGIS) | Live campus walking routes |
| Place search | OpenStreetMap Nominatim, limited to the campus box | Search on Enter only, as its usage policy requires |
| Location | Browser Geolocation API | Map position, report location, live GPS guidance |
| Haptics and sound | Browser Vibration API, Web Audio API | Cue patterns, and sounds where vibration is unavailable |
| Backend | Node.js, Express 5, Zod validation, express-rate-limit | REST API |
| Storage | SQLite (`better-sqlite3`), file at `backend/data/stepsafe.db` | Reports and prepared routes |
| Tests | Vitest and Supertest (backend), oxlint (frontend) | API tests and linting |

## Architecture

```text
┌──────────────────────────── Mobile browser ─────────────────────────────┐
│ React app (Vite)                                                        │
│  ├─ Map, reports, routes ──── Leaflet + OpenStreetMap tiles             │
│  ├─ Location ──────────────── Geolocation API                           │
│  ├─ Cues ──────────────────── Vibration API + Web Audio                 │
│  ├─ Live routes ───────────── routing.openstreetmap.de (foot)           │
│  └─ Place search ──────────── nominatim.openstreetmap.org               │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ /api/*  (Vite dev server proxies to the backend)
                ▼
     Express API on :3001 ── rate limit, validation, campus bounds check
                │
                ▼
     SQLite: reports (category, lat/lng, note, time, status,
             confirm/flag counts, source) and prepared routes
```

For phones, a Cloudflare quick tunnel exposes the Vite dev server over HTTPS (needed for location access on mobile). The phone's API calls go through the same tunnel and proxy.

## Running it locally

**Requirements:** Node.js 22 or newer (developed on Node 26) and npm. On macOS: `brew install node`.

### 1. Backend

```sh
cd backend
cp .env.example .env
npm install
npm run seed     # load sample reports and prepared routes
npm run dev      # API on http://localhost:3001 (restarts on file changes)
```

### 2. Frontend (in a second terminal)

```sh
cd frontend
npm install
npm run dev      # app on http://localhost:5173
```

Open http://localhost:5173. The navbar badge shows **Live API** when the backend is reachable and **Demo Mode** when it is not.

### 3. Phone access (optional, third terminal)

```sh
brew install cloudflared            # one-time
cloudflared tunnel --url http://localhost:5173
```

Open the `https://….trycloudflare.com` link it prints on your phone (it can take up to a minute to start working). The link changes each time the tunnel restarts, and anyone with it can open the app while it runs. The Vite config already allows `.trycloudflare.com` hosts.

### Useful commands

| Command | Where | What it does |
|---|---|---|
| `npm run seed` | backend | Refreshes sample reports and prepared routes; **keeps** reports people submitted |
| `npm run seed -- --reset-all` | backend | Also deletes all user-submitted reports |
| `npm test` | backend | Runs the API tests |
| `npm run typecheck` | backend | TypeScript check |
| `npm run build` | frontend | Type-checks and builds to `frontend/dist` |
| `npm run lint` | frontend | Runs oxlint |

## Configuration

`backend/.env` (see `backend/.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3001` | API port (the frontend proxy expects 3001) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin |
| `DB_PATH` | `data/stepsafe.db` | SQLite file (ignored by git) |
| `ADMIN_TOKEN` | empty | Required for `POST /api/admin/reset`; empty disables it |
| `INCLUDE_DRAFT_ROUTES` | `true` in the example | Serve prepared routes still marked `draft: true` |

Frontend switches live in `frontend/src/config.ts` (for example `SHOW_SENSOR_LAB`).

## API

Full spec: `backend/openapi.yaml`.

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Status; `mode` is `live` once any user report exists, otherwise `seeded` |
| `GET /api/meta` | Categories, demo-area bounds, haptic patterns, limits |
| `GET /api/reports` | List reports (filters: `bbox`, `category`, `status`, `near` + `radius_m`, `include_stale`, `include_hidden`, `limit`) |
| `POST /api/reports` | Create a report; rejected with `out_of_bounds` outside the campus box |
| `GET /api/reports/{id}` | One report |
| `POST /api/reports/{id}/confirm` | Confirm a report |
| `POST /api/reports/{id}/flag` | Flag a report; hidden after 3 flags |
| `GET /api/routes` | Prepared route summaries |
| `GET /api/routes/{id}` | Prepared route with geometry and cues |
| `GET /api/routes/{id}/warnings` | Reports within `buffer_m` (default 25 m) of a prepared route |
| `POST /api/admin/reset` | Re-seed everything (header `X-Admin-Token`) |

Write endpoints are rate-limited to 20 requests per minute per client. Reports are marked stale after 30 days. The demo area is lat 38.975–39.000, lng −76.960 to −76.925.

## Data

- **Sample reports** (`backend/src/seedData.ts`): 10 placeholder reports at approximate campus locations. They **do not describe real sidewalk conditions** and are labelled "Sample Demo Data" in the app. Replace them with real observations if you have them, then run `npm run seed`.
- **Prepared routes** (`backend/src/seedRoutes.ts`): 5 routes traced from OpenStreetMap footways. All are still `draft: true` (unverified on foot), so they are served only when `INCLUDE_DRAFT_ROUTES=true` and show an "UNVERIFIED DRAFT" disclaimer. Walk a route and set `draft: false` once it is checked. Instructions for adding routes are at the top of that file.
- **User reports** are stored in `backend/data/stepsafe.db`, which is not committed.

## Testing checklist

Automated: `npm test` in `backend` (18 API tests); `npm run build` and `npm run lint` in `frontend`.

Before a demo, check on the actual device(s):

- [ ] App is readable on a phone; the route panel collapses to the compact bar and the map stays usable.
- [ ] Map tiles load with OpenStreetMap attribution.
- [ ] Location is requested only after the disclaimer; denying it still leaves the app usable.
- [ ] A report location can be reviewed or picked on the map before submitting.
- [ ] A submitted report appears on the map with category and time (badge shows **Live API**, not Demo Mode).
- [ ] Each cue (left, right, caution, arrived) is distinct in **Test Haptics**; on iPhone, the sounds play.
- [ ] A live route and a prepared route both simulate with turns cued in order and hazards announced.
- [ ] Reports are labelled as community-submitted, sample, or possibly outdated where relevant.
- [ ] Demo still works in Demo Mode (backend stopped).
- [ ] The exact demo path has been run end to end on the presentation device.

## Data source caveats

- **OpenStreetMap:** Map and footpath detail varies. A drawn path is not proof that it is accessible or safe. Tile, routing and search services are free community services with usage policies and no uptime guarantee.
- **Live walking routes:** Computed from OpenStreetMap footway data. They do not account for curb ramps, surface condition, closures or individual accessibility needs. If the routing service is unreachable, the app shows a clearly labelled straight line instead.
- **Community reports:** May be inaccurate, duplicated, incomplete or outdated. The app shows report age, flags stale reports and lets people confirm or flag them.
- **Smartphone sensors:** Motion readings vary by device, mounting and walking style. A bump in the signal does not establish that a hazard exists, which is why Sensor Lab is hidden and never creates reports.
- **Network and permissions:** Location, tiles and the backend can fail. Demo Mode and clear status messages keep the demo usable.

## Privacy and safety

- Location is requested only after the disclaimer, and the app works without it (no fake position is shown).
- The location is used on the device to center the map and suggest a report position. It is sent to the StepSafe backend only as a report's hazard location. When you request a live route, your start point and destination go to the OpenStreetMap routing service; search text goes to Nominatim.
- No names, accounts, contact details, health information or location history are collected.
- The app states that routes and reports are informational, may be incomplete, and are not a guarantee of accessibility or safety, and tells users not to interact with the phone while crossing streets or moving around hazards.
- Every cue has a sound and on-screen text alternative to vibration.
- No privileged keys are used in client code. The admin reset endpoint requires a token.

## Known limitations

- iPhones cannot vibrate from the web; cues are sounds only there.
- Prepared routes are unverified drafts, and the sample reports are not real conditions.
- Live routes depend on free public OpenStreetMap services.
- Reports made in Demo Mode stay on that device and are never uploaded.
- The Cloudflare quick tunnel link is temporary and public while it runs.
- Coverage is limited to the UMD College Park campus.

## Future work

- Verify prepared routes on foot and replace sample reports with real observations.
- A moderation or expiry workflow for old reports.
- Accessible route preferences (for example avoiding stairs or missing curb ramps) if reliable data is available.
- Offline map and report caching for the campus.
- Bring back Sensor Lab as a clearly labelled experiment with consented, labelled data and human review, never automatic reports.
- Usability feedback from people with relevant lived experience, without presenting the prototype as a validated accessibility tool.

## Demo story

Open the app and accept the disclaimer. Show the hazard map and a labelled report, then add a new sidewalk barrier. In **Route Guidance**, pick a campus destination and press **Play**: the dot walks the route and each turn and hazard produces a distinct cue (vibration on Android, sound on iPhone). Point out which parts are live (reports, routing) and which are demo data (sample reports, draft routes), and close with the limits of community reports and general-purpose route data, and sensor analysis as future work.
