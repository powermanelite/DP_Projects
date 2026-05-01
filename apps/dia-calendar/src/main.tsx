import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@dia/shared/index.css';
import CalendarPage from './CalendarPage';
import type { ScheduledEvent } from '@dia/shared';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

function StandaloneApp() {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [gcalToken, setGcalToken] = useState<string | null>(null);
  const [gcalUser, setGcalUser] = useState<{ name: string; email: string; picture: string } | null>(null);

  return (
    <CalendarPage
      events={events}
      onEventsChange={setEvents}
      sweepingRequest={null}
      onSweepingHandled={() => {}}
      onViewOnMap={() => {}}
      gcalToken={gcalToken}
      gcalUser={gcalUser}
      onGcalSignIn={(token, user) => { setGcalToken(token); setGcalUser(user); }}
      onGcalSignOut={() => { setGcalToken(null); setGcalUser(null); setEvents([]); }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <StandaloneApp />
    </GoogleOAuthProvider>
  </StrictMode>,
);
