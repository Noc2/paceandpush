export type UnitPreference = "metric" | "imperial";

const kilometersToMiles = 0.621371;

export function distanceUnitLabel(units: UnitPreference): string {
  return units === "imperial" ? "Miles" : "Kilometers";
}

export function distanceUnitAbbreviation(units: UnitPreference): string {
  return units === "imperial" ? "mi" : "km";
}

export function runningDistanceLabel(units: UnitPreference): string {
  return units === "imperial" ? "Run miles" : "Run kilometers";
}

export function runningDistanceShortLabel(units: UnitPreference): string {
  return units === "imperial" ? "Run mi" : "Run km";
}

export function convertKilometers(kilometers: number, units: UnitPreference): number {
  return units === "imperial" ? kilometers * kilometersToMiles : kilometers;
}

export function formatDistance(kilometers: number, units: UnitPreference): string {
  return convertKilometers(kilometers, units).toFixed(1);
}

export function parseUnitPreference(value: string | null | undefined): UnitPreference {
  return value === "imperial" ? "imperial" : "metric";
}
