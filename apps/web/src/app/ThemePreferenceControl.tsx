"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "pace-theme";
const preferences: ThemePreference[] = ["system", "light", "dark"];

export function ThemePreferenceControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    function syncPreference() {
      setPreference(readStoredPreference());
    }

    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("pace-theme-change", syncPreference);

    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("pace-theme-change", syncPreference);
    };
  }, []);

  function chooseTheme(nextPreference: ThemePreference) {
    setPreference(nextPreference);
    applyThemePreference(nextPreference);
  }

  return (
    <div
      className={compact ? "theme-toggle compact" : "theme-toggle"}
      role="group"
      aria-label="Color theme"
    >
      {preferences.map((option) => (
        <button
          type="button"
          className={preference === option ? "active" : ""}
          aria-pressed={preference === option}
          key={option}
          onClick={() => chooseTheme(option)}
        >
          {themeLabel(option)}
        </button>
      ))}
    </div>
  );
}

function readStoredPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(storageKey);
      document.documentElement.removeAttribute("data-theme");
    } else {
      window.localStorage.setItem(storageKey, preference);
      document.documentElement.dataset.theme = preference;
    }
    window.dispatchEvent(new Event("pace-theme-change"));
  } catch {
  }
}

function themeLabel(preference: ThemePreference): string {
  switch (preference) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default:
      return "System";
  }
}
