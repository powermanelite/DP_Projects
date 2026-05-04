import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import AssistMe from './components/AssistMe';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssistMe />
  </StrictMode>
);
