export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hub-theme';

/** The theme to start with: whatever was chosen last time, else the OS preference. */
export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme to the document and remembers the choice for next time. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
