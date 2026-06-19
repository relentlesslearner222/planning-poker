export const themes = [
  {
    id: "default",
    label: "Default",
    description: "The standard planning-poker theme.",
    className: "",
  },
  {
    id: "dark",
    label: "Dark",
    description: "A high-contrast dark mode theme.",
    className: "theme-dark",
  },
  {
    id: "salesforce",
    label: "Salesforce",
    description: "Salesforce Lightning Design System (SLDS)-inspired theme.",
    className: "theme-salesforce",
  },
];

export function getThemeById(id) {
  return themes.find((t) => t.id === id) ?? themes[0];
}

export function applyTheme(themeId) {
  const theme = getThemeById(themeId);
  document.documentElement.setAttribute("data-theme", theme.id);
  try { localStorage.setItem("pp-theme", theme.id); } catch (_) {}
}

export function restoreTheme() {
  let stored = "default";
  try { stored = localStorage.getItem("pp-theme") ?? "default"; } catch (_) {}
  applyTheme(stored);
}