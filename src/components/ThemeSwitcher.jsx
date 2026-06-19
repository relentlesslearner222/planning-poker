import { themes, applyTheme } from "../themes/themeRegistry";

export default function ThemeSwitcher({ currentTheme = "default", onChange }) {
  function handleChange(e) {
    const themeId = e.target.value;
    applyTheme(themeId);
    if (typeof onChange === "function") {
      onChange(themeId);
    }
  }

  return (
    <div className="theme-switcher" role="region" aria-label="Theme switcher">
      <label htmlFor="theme-select" style={{ marginRight: "0.5rem", fontWeight: 600 }}>
        Theme:
      </label>
      <select
        id="theme-select"
        value={currentTheme}
        onChange={handleChange}
        aria-label="Select application theme"
      >
        {themes.map((theme) => (
          <option key={theme.id} value={theme.id} title={theme.description}>
            {theme.label}
          </option>
        ))}
      </select>
    </div>
  );
}