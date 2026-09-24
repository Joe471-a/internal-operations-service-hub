import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// @ts-ignore - CSS side-effect import has no ambient type here; Vite serves it fine, this only silences the checker
import './App.css';
import { applyTheme, getInitialTheme } from './lib/theme';

// Applied before the first paint, so there's no flash of the wrong theme.
applyTheme(getInitialTheme());

/** This is the entry point: the first frontend file that runs. */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
