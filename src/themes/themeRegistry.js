export const TH®íES = {
  DEFAULT: 'theme-default',
  DARK: 'theme-dark',
  SALESFORCE: 'theme-salesforce',
};

export const themeRegistry = [
  { id: THEMES.DEFAULT,   label: 'Default',    color: '#6366f1', stylesheet: null },
  { id: THEMES.DARK,      label: 'Dark',       color: '#1e1e2e', stylesheet: null },
  {
    id: THEMES.SALESFORCE,
    label: 'Salesforce',
    color: '#0176D3',
    stylesheet: '../styles/themes/salesforce.css',
  },
];

export function getThemeById(id) {
  return themeRegistry.find((t) => t.id === id);
}

export function applyTheme(themeId, root = document.body) {
  const allThemeClasses = themeRegistry.map((t) => t.id);
  root.classList.remove(...allThemeClasses);
  const theme = getThemeById(themeId);
  if (!theme) {
    console.warn(`warning: Unknown theme "${themeId}". Falling back to default.`);
    root.classList.add(THEMES.DEFAULT);
    return;
  }
  root.classList.add(theme.id);
  try { localStorage.setItem('planning-poker-theme', themeId); } catch {}
}

export function restoreTheme(root = document.body) {
  let saved = null;
  try { saved = localStorage.getItem('planning-poker-theme'); } catch {}
  const validId = saved && themeRegistry.some((t) => t.id === saved) ? saved : THEMES.DEFAULT;
  applyTheme(validId, root);
}