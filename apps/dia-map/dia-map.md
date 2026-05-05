# dia-map

## Overview

The Map tab is an interactive Leaflet map showing street-sweeping schedules for Daly City and San Francisco. Users can search for a street, view sweeping days and times for each block side, and send a sweeping schedule directly to the Calendar tab to create recurring reminder events. The map can also receive a pin request from the Calendar tab to highlight a specific street.

## Architecture

`dia-map` is a React 19 library package (`@dia/map`) consumed by the `dia-website` shell. The shell passes callbacks and a pin request as props; the map calls back when the user wants to add a sweeping event to the calendar.

```
DP_Projects/
└── apps/
    ├── dia-map/                        ← this package
    │   └── src/
    │       ├── MapPage.tsx             ← entire feature in one component
    │       ├── MapPage.css             ← scoped styles
    │       ├── index.ts                ← re-exports MapPage as default
    │       └── main.tsx                ← standalone dev entry
    └── dia-website/
        ├── src/App.tsx                 ← owns mapPinRequest, passes onAddToCalendar
        └── public/
            └── StreetSweeping_Normalized.json   ← street-sweeping dataset
```

Package alias: `@dia/map` → `apps/dia-map/src` (resolved via `dia-website/vite.config.js`).

## Key files

| File | Purpose |
|---|---|
| `src/MapPage.tsx` | The entire feature. Initializes a Leaflet map, fetches and parses the GeoJSON dataset, renders street geometry, handles search, and manages the sweeping info panel. |
| `src/index.ts` | `export { default } from './MapPage'` — the package boundary. |
| `src/MapPage.css` | Sidebar and map layout, search input, sweeping info panel styles. |
| `dia-website/public/StreetSweeping_Normalized.json` | Static JSON dataset of normalized street-sweeping entries. Fetched at runtime by `MapPage`. Not committed to `dia-map` — lives in `dia-website/public/` so it's served as a static asset in both dev and production. |

## Data flow

```
dia-website App.tsx
  ├── onAddToCalendar(SweepingCalendarRequest) ← MapPage (user clicks "Add to Calendar")
  ├── pinRequest: string | null                → MapPage (street name to highlight)
  └── onPinHandled()                           ← MapPage (signal pin request consumed)
```

### Add-to-Calendar cross-tab flow

1. User finds a street on the map and clicks "Add to Calendar"
2. `MapPage` calls `onAddToCalendar({ street, sides })` with the sweeping schedule
3. Shell sets `sweepingRequest` and switches to the `'calendar'` tab
4. Calendar tab auto-populates an event modal from the request

### Pin-request cross-tab flow (Calendar → Map)

1. User clicks "View on Map" on a calendar event
2. Shell sets `mapPinRequest` (the street name) and switches to `'map'`
3. `MapPage` detects non-null `pinRequest` via `useEffect`, geocodes or fuzzy-matches the street name in the dataset, and centers the map + places a marker
4. `MapPage` calls `onPinHandled()` to clear the request

## State shape

### Props (received from shell)

```ts
interface MapPageProps {
  onAddToCalendar: (request: SweepingCalendarRequest) => void;
  pinRequest: string | null;
  onPinHandled: () => void;
}
```

### Shared types (from `@dia/shared`)

```ts
interface SweepingCalendarRequest {
  street: string;
  sides: Array<{ label: string; day: string; time: string }>;
}
```

### Dataset types (internal to component)

```ts
interface NormalizedEntry {
  city: 'Daly City' | 'San Francisco';
  street_name: string;
  block_limits: string | null;
  block_side: string | null;
  weekdays: string[];
  week_pattern: number[];   // e.g. [1, 3] = 1st and 3rd occurrence of weekday in month
  start_hour: number | null;  // 24-hr float, e.g. 8.5 = 8:30 AM
  end_hour: number | null;
  observes_holidays: boolean;
  geometry: number[][] | null;  // array of [lng, lat] pairs
  source_id: string | null;
}

interface NormalizedData {
  schema_version: string;
  generated_at: string;
  total_entries: number;
  entries: NormalizedEntry[];
}
```

## External services / dependencies

| Dependency | Use |
|---|---|
| `leaflet` | Interactive map rendering, markers, polylines, popups |
| `@types/leaflet` | TypeScript types |
| `StreetSweeping_Normalized.json` | Static dataset fetched via `fetch('/StreetSweeping_Normalized.json')` at component mount |
| Leaflet CDN (marker images) | Default marker icons are loaded from `unpkg.com/leaflet@1.9.4/dist/images/` to fix the bundler path-breaking issue |

No Google Maps, no geolocation API calls, no authentication required.

### Leaflet marker icon fix

Vite bundlers break Leaflet's default marker icon paths. `MapPage.tsx` works around this by explicitly constructing a custom `L.icon` with absolute CDN URLs:

```ts
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41] });
```

### Street name fuzzy matching

`normStreet()` strips common street type suffixes (`street`, `avenue`, `blvd`, etc.) before comparing names. `matchStreetName()` uses this normalized form to look up entries in a `Map<string, NormalizedEntry[]>` built from the dataset — allowing "Main Street" and "Main St" to match the same entries.

### Schedule formatting

- `formatHour(n: number)` — converts a 24-hr float (`8.5`) to a 12-hr string (`8:30 AM`)
- `formatScheduleDescription(weekdays, week_pattern)` — produces human-readable recurrence text, e.g. `"Tuesday (1st, 3rd)"`
- Map default center: `[37.6879, -122.4702]` (Daly City)

## Running locally

```bash
cd apps/dia-website
npm run dev
# Map tab available at http://localhost:5173
# Dataset served from dia-website/public/StreetSweeping_Normalized.json
```

No `.env` file required for the Map tab.

Standalone dev (within `dia-map` itself) requires a local copy of the dataset. The `src/main.tsx` entry exists only for Vite compatibility.

## Deployment notes

- No feature flag — Map is always included in the build.
- `StreetSweeping_Normalized.json` must be present in `apps/dia-website/public/` — it is committed to the repo and served as a static file by GitHub Pages.
- Leaflet is listed in `dia-website/vite.config.js` under `resolve.dedupe` to prevent duplicate instances when bundled alongside other packages.
- The `leaflet/dist/leaflet.css` import in `MapPage.tsx` requires `@types/leaflet` to be installed in `dia-website/package.json`.
