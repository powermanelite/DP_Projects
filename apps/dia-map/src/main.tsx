import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dia/shared/index.css';
import MapPage from './MapPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MapPage
      onAddToCalendar={() => {}}
      pinRequest={null}
      onPinHandled={() => {}}
    />
  </StrictMode>,
);
