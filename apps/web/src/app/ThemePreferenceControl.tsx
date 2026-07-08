"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";
type SelectableThemePreference = Exclude<ThemePreference, "system">;

const storageKey = "pace-theme";
const systemSchemeQuery = "(prefers-color-scheme: dark)";
const preferences: SelectableThemePreference[] = ["light", "dark"];

export function ThemePreferenceControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemPreference, setSystemPreference] = useState<SelectableThemePreference>("light");
  const activePreference = preference === "system" ? systemPreference : preference;

  useEffect(() => {
    function syncPreference() {
      setPreference(readStoredPreference());
    }

    function syncSystemPreference() {
      setSystemPreference(readSystemPreference());
    }

    syncPreference();
    syncSystemPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("pace-theme-change", syncPreference);
    const media = window.matchMedia(systemSchemeQuery);
    media.addEventListener("change", syncSystemPreference);

    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("pace-theme-change", syncPreference);
      media.removeEventListener("change", syncSystemPreference);
    };
  }, []);

  function chooseTheme(nextPreference: SelectableThemePreference) {
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
          className={activePreference === option ? "active" : ""}
          aria-pressed={activePreference === option}
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

function readSystemPreference(): SelectableThemePreference {
  try {
    return window.matchMedia(systemSchemeQuery).matches ? "dark" : "light";
  } catch {
    return "light";
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

function themeLabel(preference: SelectableThemePreference): string {
  switch (preference) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
  }
}
