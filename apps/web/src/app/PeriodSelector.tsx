import {
  addDays,
  formatPeriodLabel,
  toIsoWeekPeriod,
  toMonthPeriod,
} from "@/lib/periods";

type PeriodOption = {
  label: string;
  value: string;
};

type PeriodOptionGroup = {
  label: string;
  options: PeriodOption[];
};

type HiddenParam = {
  name: string;
  value: string;
};

type PeriodSelectorProps = {
  activePeriod: string;
  action?: string;
  hiddenParams?: HiddenParam[];
};

export function PeriodSelector({
  activePeriod,
  action,
  hiddenParams = [],
}: PeriodSelectorProps) {
  const optionGroups = getPeriodOptionGroups(activePeriod);

  return (
    <form className="period-selector" action={action} method="get" aria-label="Score period">
      {hiddenParams.map((param) => (
        <input key={param.name} type="hidden" name={param.name} value={param.value} />
      ))}
      <label htmlFor="period">Period</label>
      <select id="period" name="period" defaultValue={activePeriod}>
        {optionGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button className="button" type="submit">
        Apply
      </button>
    </form>
  );
}

function getPeriodOptionGroups(activePeriod: string): PeriodOptionGroup[] {
  const now = new Date();
  const years = new Set<string>();
  const months = new Set<string>();
  const weeks = new Set<string>();

  for (let offset = 0; offset < 5; offset += 1) {
    years.add(String(now.getUTCFullYear() - offset));
  }
  for (let offset = 0; offset < 12; offset += 1) {
    months.add(
      toMonthPeriod(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))),
    );
  }
  for (let offset = 0; offset < 12; offset += 1) {
    weeks.add(toIsoWeekPeriod(addDays(now, -offset * 7)));
  }

  if (/^\d{4}$/.test(activePeriod)) {
    years.add(activePeriod);
  } else if (/^\d{4}-W\d{2}$/.test(activePeriod)) {
    weeks.add(activePeriod);
  } else {
    months.add(activePeriod);
  }

  return [
    {
      label: "Years",
      options: [...years].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
    {
      label: "Months",
      options: [...months].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
    {
      label: "Weeks",
      options: [...weeks].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
  ];
}

export { formatPeriodLabel } from "@/lib/periods";
