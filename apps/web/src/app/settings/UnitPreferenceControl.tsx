"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UnitPreference } from "@/lib/distance-units";

const options: Array<{ value: UnitPreference; label: string }> = [
  { value: "metric", label: "Kilometers" },
  { value: "imperial", label: "Miles" },
];

export function UnitPreferenceControl({ initialUnits }: { initialUnits: UnitPreference }) {
  const router = useRouter();
  const [units, setUnits] = useState<UnitPreference>(initialUnits);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function updateUnits(nextUnits: UnitPreference) {
    if (nextUnits === units || isSaving) return;

    const previousUnits = units;
    setUnits(nextUnits);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ units: nextUnits }),
      });

      if (!response.ok) {
        setUnits(previousUnits);
        setError("Could not save units.");
        return;
      }

      const body = (await response.json()) as { units?: UnitPreference };
      setUnits(body.units === "imperial" ? "imperial" : "metric");
      router.refresh();
    } catch {
      setUnits(previousUnits);
      setError("Could not save units.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="settings-row unit-setting">
      <span>Units</span>
      <div>
        <div className="segmented-control" role="group" aria-label="Distance units">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === units ? "active" : ""}
              aria-pressed={option.value === units}
              disabled={isSaving}
              onClick={() => updateUnits(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
