# StepSafe — Haptic Navigation for Safer, More Accessible Walking

**Technica 2026 · Sensors for Good**  

## Project overview

StepSafe is a mobile-friendly web app concept for making walking navigation more accessible and helping people learn about sidewalk barriers. It combines tactile turn cues with a community map of reported hazards. The prototype is intended for a campus or small demonstration area, not as a replacement for established navigation or accessibility services.

## The problem

Walking directions commonly depend on looking at a screen or listening to spoken prompts. Those methods do not work equally well for everyone or in every setting. Sidewalk closures, potholes, uneven pavement, standing water, and other barriers can also make a route difficult or inaccessible. Information about these conditions may be missing or out of date.

## The solution

StepSafe aims to give a walker simple vibration cues for upcoming turns and warnings, show community-submitted sidewalk hazard reports on a map, and let users add reports with a category and location. Where feasible, the prototype can compare reports with a walking route and surface relevant warnings. Sensor readings may be collected in an explicitly labeled experiment to explore whether motion patterns merit further investigation; they must not be presented as verified hazard detections.

## Core features

| Priority | Feature | Prototype behavior |
|---|---|---|
| Must-have | Haptic navigation | Trigger distinct, tested vibration patterns for left, right, and caution cues when supported. Provide visible/text alternatives. |
| Must-have | Hazard map | Show the user's location when permission is granted and display hazard reports with clear categories and timestamps. |
| Must-have | Community reporting | Let a user choose a hazard type, add an optional note, and submit a location-based report. Make location reviewable before submission. |
| Should-have | Route context | Show a simple walking route if a suitable routing service or prepared demo route is available. Highlight nearby reports. |
| Exploratory | Motion sensing | With explicit permission and a clear explanation, collect short accelerometer/gyroscope samples for a demo. Label any output as experimental, not a confirmed hazard. |

Suggested report categories: blocked sidewalk, pothole, uneven surface, standing water, construction/closure, missing curb ramp, and other. Keep the initial form short; do not ask for personal or medical information.

## Technology stack

| Layer | Suggested technology | Use |
|---|---|---|
| Frontend | React | Mobile-friendly screens and interactions |
| Styling | CSS or Tailwind CSS | Responsive, high-contrast interface |
| Map | Leaflet with OpenStreetMap tiles | Map, location, and report markers |
| Location | Browser Geolocation API | User-approved location and report coordinates |
| Haptics | Browser Vibration API | Turn and caution patterns where the browser/device supports them |
| Motion | DeviceMotion API | Optional accelerometer/gyroscope experiment |
| Shared storage | Supabase, or a small local/demo data store | Store and retrieve community reports |
| Optional analysis | Python, pandas, scikit-learn | Offline exploration of collected motion samples, if time allows |

Choose the simplest stack the team can get running quickly. Confirm API and service availability, terms, and any keys or network access before depending on them. A local in-memory or seeded dataset is an acceptable fallback for a reliable demo.

## Architecture

```text
┌──────────────────────────── Mobile browser ───────────────────────────┐
│ React interface                                                       │
│  ├─ Map and hazard markers ───── Leaflet / OpenStreetMap tiles        │
│  ├─ Location ─────────────────── Browser Geolocation API              │
│  ├─ Turn/warning cues ────────── Browser Vibration API                │
│  └─ Optional sensor capture ──── DeviceMotion API                     │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ report read/write (if configured)
                                ▼
                       Supabase or demo store
                                │
                                ▼
                  Hazard reports: type, coordinates,
                    note (optional), time, status

Optional offline analysis: consented sensor samples → exploratory review
```

Keep the first version small: the client handles the interface and browser capabilities; the data store holds hazard reports. Avoid adding a separate machine-learning service unless the must-have flow is already working.

## User flow

1. The user opens StepSafe and sees a short explanation of location, haptics, and any optional sensor use.
2. The user chooses whether to share location. The app remains usable with manual map navigation or a demo location if permission is declined.
3. The user views the map and available hazard reports. Each marker identifies its category and report time; stale or unverified reports are clearly labeled.
4. The user can submit a report by choosing a category, confirming the mapped location, optionally adding a note, and submitting.
5. For a navigation demo, the user selects a destination or prepared route. The app displays route context and gives turn/caution cues when available.
6. The user can try a haptic test and choose visual/text cues if vibration is unavailable or unwanted.
7. If the sensor experiment is included, the user separately opts in, sees what is sampled and why, and can stop collection at any time.

## Data source caveats

- **OpenStreetMap:** Map coverage and sidewalk detail vary by location. A map is not proof that a path is accessible or safe. Follow tile-provider usage policies and configure attribution as required.
- **Community reports:** Reports may be inaccurate, duplicated, incomplete, or outdated. Show when a report was submitted and avoid describing unverified reports as confirmed facts. Provide a way to flag or dismiss bad reports if time allows.
- **Routing:** A general walking route may not account for curb ramps, surface condition, closures, or individual accessibility needs. If routing data is unavailable, use a clearly labeled prepared route for the demo rather than implying live guidance.
- **Smartphone sensors:** Accelerometer and gyroscope readings differ across devices, mounting positions, operating systems, and walking styles. A bump or unusual signal does not establish that a hazard exists. Any sensor findings should be treated as hypotheses for human review, not automatic public reports.
- **Network and permissions:** Geolocation, map tiles, and cloud storage can fail because of denied permissions, unavailable connectivity, or service limits. Include a seeded/demo mode and clear status messages.

## Testing checklist

- [ ] App is readable and usable on a phone-sized screen.
- [ ] Map loads with required attribution, or a clear fallback appears.
- [ ] Location permission is requested only when needed; denial does not block the rest of the demo.
- [ ] User can review and correct a report location before submitting.
- [ ] A submitted report appears on the map with category and time.
- [ ] Missing fields, network errors, and storage failures produce understandable feedback.
- [ ] Haptic patterns are distinct enough to test and have a visual/text alternative.
- [ ] The app does not claim vibration is supported unless tested on that device/browser.
- [ ] Reports are clearly identified as community-submitted and potentially stale/unverified.
- [ ] Sensor collection is optional, explained, stoppable, and separate from reporting.
- [ ] No sensor reading automatically creates a public hazard report.
- [ ] Demo works with seeded data if location, network, backend, or routing is unavailable.
- [ ] Team has tested the exact demo path on the device(s) used for presentation.

## Privacy and safety

- Ask for location only when the user chooses a location-based feature, explain why, and allow the user to continue without it where possible.
- Collect the minimum data needed. Avoid collecting names, contact details, health information, or continuous location history for the prototype.
- Explain report storage and any sensor sampling before collection. Keep sensor capture opt-in, limited to the experiment, and easy to stop.
- Do not publish raw motion data or precise personal movement histories. Use synthetic or short-lived sample data for a hackathon demo when practical, and delete experimental data after the event unless participants have agreed to another use.
- Make clear that routes and reports are informational, may be incomplete, and are not a guarantee of accessibility or safety. Encourage users to rely on their own judgment and established accessibility tools.
- Provide non-haptic cues and do not require someone to look at a screen while walking. Keep the app from suggesting that the user interact with the phone while crossing streets or navigating hazards.
- Protect any backend credentials; never place privileged service keys in client-side code.

## Stretch goals

- Report freshness indicators, duplicate detection, and community confirmation or correction.
- Filtering by hazard category and distance along the route.
- Accessible route preferences, if a reliable routing data source is available.
- Offline map/report caching for a small demo area.
- A moderation or expiration workflow for old reports.
- Carefully evaluated sensor anomaly visualization using labeled, consented data, with human review and no automatic claims.
- Usability feedback from people with relevant lived experience, conducted respectfully and without treating a hackathon prototype as a validated accessibility tool.

## Recommended scope

Deliver these first:

1. **Haptic navigation** with a simple test control and usable alternatives.
2. **Community hazard reporting** that places a category-labeled report on the map.
3. **A dependable demo path** with seeded reports if live services fail.

Add sensor analysis only after those work. In a 24-hour build, sensor data is best presented as an exploratory experiment: it can motivate further study, but cannot reliably identify or confirm hazards on its own.

## Demo story

Show a walker opening the map, seeing a clearly labeled community report, adding a new sidewalk barrier, and receiving a distinct haptic cue on a prepared route. Explain which parts are live and which use demo data. Close by describing sensor analysis as future exploration and naming the limits of unverified reports and general-purpose route data.
