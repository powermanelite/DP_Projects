import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dia/shared/index.css';
import Home from './Home';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
