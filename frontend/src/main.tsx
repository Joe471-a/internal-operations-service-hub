import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-ignore - CSS side-effect import has no ambient type here; Vite serves it fine, this only silences the checker
import './App.css';

/** This is the entry point: the first frontend file that runs. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
