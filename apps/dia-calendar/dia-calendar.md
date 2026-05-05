# dia-calendar

## Overview

The Calendar tab is a day-planner and event scheduler with Google Calendar integration. Users can create, edit, and delete events on a visual weekly/daily planner grid. Events support recurrence (daily, weekly, biweekly, monthly) and can be exported to Google Calendar. The tab also receives street-sweeping schedule requests from the Map tab and auto-populates them as recurring calendar events.

## Architecture

`dia-calendar` is a React 19 library package (`@dia/calendar`) consumed by the `dia-website` shell. The shell owns the event list (`ScheduledEvent[]`) and Google OAuth state; the Calendar tab receives them as props and calls back when they change.

```
DP_Projects/
└── apps/
    ├── dia-calendar/                   ← this package
    │   └── src/
    │       ├── CalendarPage.tsx        ← entire feature in one component
    │       ├── CalendarPage.css        ← scoped styles
    │       ├── index.ts                ← re-exports CalendarPage as default
    │       └── main.tsx                ← standalone dev entry
    └── dia-website/
        └── src/App.tsx                 ← owns events[], gcalToken, sweepingRequest
```

Package alias: `@dia/calendar` → `apps/dia-calendar/src` (resolved via `dia-website/vite.config.js`).

## Key files

| File | Purpose |
|---|---|
| `src/CalendarPage.tsx` | The entire feature. Implements the planner grid, event modal, recurrence expansion, Google Calendar URL builder, and OAuth sign-in/out via `@react-oauth/google`. |
| `src/index.ts` | `export { default } from './CalendarPage'` — the package boundary. |
| `src/CalendarPage.css` | Planner grid layout, event block positioning, modal styles. Uses `--planner-row-height: 56px` CSS variable to sync with the `ROW_HEIGHT = 56` constant in the component. |

## Data flow

```
dia-website App.tsx
  ├── events[]             → CalendarPage (display)
  ├── onEventsChange()     ← CalendarPage (create / edit / delete)
  ├── sweepingRequest      → CalendarPage (auto-populate from Map)
  ├── onSweepingHandled()  ← CalendarPage (signal request consumed)
  ├── onViewOnMap(street)  ← CalendarPage (navigate to Map tab + pin)
  ├── gcalToken            → CalendarPage (enables GCal export button)
  ├── gcalUser             → CalendarPage (display signed-in user)
  ├── onGcalSignIn()       ← CalendarPage (token + user on auth success)
  └── onGcalSignOut()      ← CalendarPage (clears token, user, events in shell)
```

### Street-sweeping cross-tab flow

1. User clicks a street on the Map tab → Map calls `onAddToCalendar(SweepingCalendarRequest)`
2. Shell sets `sweepingRequest` state and switches active tab to `'calendar'`
3. `CalendarPage` detects non-null `sweepingRequest` via `useEffect` and opens an event modal pre-filled with the sweeping schedule
4. After creating the event(s), CalendarPage calls `onSweepingHandled()` → shell clears `sweepingRequest`

### View-on-Map cross-tab flow

1. User clicks "View on Map" on a calendar event
2. `CalendarPage` calls `onViewOnMap(streetName)` → shell sets `mapPinRequest` and switches tab to `'map'`

## State shape

### Props (received from shell)

```ts
interface CalendarPageProps {
  events: ScheduledEvent[];
  onEventsChange: (events: ScheduledEvent[]) => void;
  sweepingRequest: SweepingCalendarRequest | null;
  onSweepingHandled: () => void;
  onViewOnMap: (streetName: string) => void;
  gcalToken: string | null;
  gcalUser: { name: string; email: string; picture: string } | null;
  onGcalSignIn: (token: string, user: { name: string; email: string; picture: string }) => void;
  onGcalSignOut: () => void;
}
```

### Shared types (from `@dia/shared`)

```ts
interface ScheduledEvent {
  id: string;
  date: string;            // YYYY-MM-DD
  name: string;
  email: string;
  schedulerEmail?: string;
  attendeeEmail?: string;
  timeSlot: string;        // e.g. "9:00 AM"
  endTimeSlot?: string;
  message: string;
  isSweeping?: boolean;
  streetName?: string;
  gcalEventId?: string;
  recurringEventId?: string;
}

interface SweepingCalendarRequest {
  street: string;
  sides: Array<{ label: string; day: string; time: string }>;
}
```

### Local state (internal to component)

```ts
type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface ModalState {
  date: string;
  name: string;
  email: string;
  schedulerEmail: string;
  attendeeEmail: string;
  timeSlot: string;
  endTimeSlot: string;
  message: string;
  recurrence: Recurrence;
  recurrenceCount: number;
  editingId: string | null;   // non-null when editing an existing event
  isSweeping?: boolean;
  streetName?: string;
  stopRepeat?: boolean;
}
```

## External services / dependencies

| Dependency | Use |
|---|---|
| `@react-oauth/google` | `useGoogleLogin` hook for OAuth2 token acquisition; `googleLogout` for sign-out |
| Google Calendar API | `buildGoogleCalendarUrl()` constructs a `calendar.google.com/calendar/render` deep-link for one-click event export — no direct API calls, no backend required |
| `VITE_GOOGLE_CLIENT_ID` env var | OAuth client ID passed to `GoogleOAuthProvider` in `dia-website/src/main.tsx` |

Google OAuth is handled entirely client-side via the `@react-oauth/google` library. The OAuth access token is stored in the shell's `gcalToken` state and passed down as a prop.

## Running locally

```bash
cd apps/dia-website
# Ensure apps/dia-website/.env contains:
# VITE_GOOGLE_CLIENT_ID=<your-client-id>
npm run dev
# Calendar tab available at http://localhost:5173
```

Standalone dev (within `dia-calendar` itself) requires passing mock props and is not commonly used. The `src/main.tsx` entry exists only for Vite compatibility.

## Deployment notes

- No feature flag — Calendar is always included in the build.
- The Google OAuth client ID must be added as the `VITE_GOOGLE_CLIENT_ID` GitHub Actions secret (already configured in `.github/workflows/deploy.yml`).
- The Google Cloud Console OAuth client must list `https://powermanelite.github.io` as an **Authorized JavaScript origin** for sign-in to work on the deployed site.
- `buildGoogleCalendarUrl()` opens `calendar.google.com` in a new tab — no backend or server-side token exchange needed.

## Key implementation details

- **Planner grid positioning:** event blocks are absolutely positioned using `top` and `height` calculated from `ROW_HEIGHT = 56` (pixels per hour row). This value must stay in sync with the CSS `--planner-row-height: 56px` variable.
- **Recurrence expansion:** when creating a recurring event, `CalendarPage` generates multiple `ScheduledEvent` entries (one per occurrence), all sharing the same `recurringEventId`. Editing or deleting asks whether to affect all occurrences or just the selected one.
- **Google Calendar URL format:** uses the `calendar.google.com/calendar/render?action=TEMPLATE` deep-link with `dates` in `YYYYMMDDTHHmmss/YYYYMMDDTHHmmss` format — no API scopes required.
