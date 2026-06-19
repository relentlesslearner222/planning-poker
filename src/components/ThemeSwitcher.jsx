import React, { useEffect, useState } from 'react';
import { themeRegistry, applyTheme, restoreTheme, THEMES } from '../themes/themeRegistry';

export default function ThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState(THEMES.DEFAULT);

  useEffect(() => {
    restoreTheme();
    try {
      const saved = localStorage.getItem('planning-poker-theme');
      if (saved) setActiveTheme(saved);
    } catch {}
  }, []);

  function handleThemeChange(themeId) {
    applyTheme(themeId);
    setActiveTheme(themeId);
  }

  return (
    <div
      className="theme-switcher"
      role="radiogroup"
      aria-label="Select application theme"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      <span style={{ fontWeight: 600, fontSize: '0.875rem', marginRight: '0.25rem' }}>
        Theme:
      </span>

      {themeRegistry.map((theme) => {
        const isActive = activeTheme === theme.id;
        return (
          <button
            key={theme.id}
            role="radio"
            aria-checked={isActive}
            aria-label={`${theme.label} theme`}
            title={`Switch to ${theme.label} theme`}
            onClick={() => handleThemeChange(theme.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.875rem',
              borderRadius: '0.375rem',
              border: isActive ? '2px solid currentColor' : '1px solid #ccc',
              background: isActive ? theme.color : 'transparent',
              color: isActive ? '#fff' : 'inherit',
              fontWeight: isActive ? 700 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                background: theme.color,
                border: '1px solid rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            />
            {theme.label}
          </button>
        );
      })}
    </div>
  );
}