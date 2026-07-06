import {
  addDays,
  formatPeriodLabel,
  formatWeekRange,
  periodForKind,
  periodKind,
  periodStartDate,
  shiftPeriod,
  toIsoWeekPeriod,
  toMonthPeriod,
  type PeriodKind,
} from "@/lib/periods";
import Link from "next/link";

type PeriodOption = {
  label: string;
  meta?: string;
  value: string;
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
  const activeKind = periodKind(activePeriod);
  const referenceDate = getReferenceDate(activePeriod);
  const years = getYearOptions(activePeriod);
  const months = getMonthOptions(referenceDate, activePeriod);
  const weeks = getWeekOptions(referenceDate, activePeriod);
  const previousPeriod = shiftPeriod(activePeriod, -1);
  const nextPeriod = shiftPeriod(activePeriod, 1);
  const modeTabs: Array<{ kind: PeriodKind; label: string }> = [
    { kind: "week", label: "Week" },
    { kind: "month", label: "Month" },
    { kind: "year", label: "Year" },
  ];

  return (
    <section className="period-selector" aria-label="Score period">
      <span className="period-selector-label">Period</span>
      <nav className="period-mode-tabs" aria-label="Period type">
        {modeTabs.map((tab) => {
          const period = periodForKind(tab.kind, referenceDate);
          return (
            <Link
              key={tab.kind}
              className={tab.kind === activeKind ? "active" : ""}
              href={periodHref(action, hiddenParams, period)}
              aria-current={tab.kind === activeKind ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="period-navigator">
        <Link
          className="period-step"
          href={periodHref(action, hiddenParams, previousPeriod)}
          aria-label={`Previous ${activeKind}`}
        >
          ‹
        </Link>
        <details className="period-menu">
          <summary>
            <span>
              <small>{activeKind}</small>
              <strong>{summaryLabel(activePeriod)}</strong>
            </span>
            <span className="period-menu-caret" aria-hidden="true" />
          </summary>
          <div className="period-popover" aria-label="Choose period">
            <nav className="period-popover-tabs" aria-label="Period type">
              {modeTabs.map((tab) => {
                const period = periodForKind(tab.kind, referenceDate);
                return (
                  <Link
                    key={tab.kind}
                    className={tab.kind === activeKind ? "active" : ""}
                    href={periodHref(action, hiddenParams, period)}
                    aria-current={tab.kind === activeKind ? "page" : undefined}
                  >
                    {tab.label}s
                  </Link>
                );
              })}
            </nav>

            {activeKind === "week" ? (
              <PeriodOptionList
                activePeriod={activePeriod}
                action={action}
                hiddenParams={hiddenParams}
                options={weeks}
              />
            ) : null}
            {activeKind === "month" ? (
              <PeriodOptionGrid
                activePeriod={activePeriod}
                action={action}
                hiddenParams={hiddenParams}
                options={months}
              />
            ) : null}
            {activeKind === "year" ? (
              <PeriodOptionGrid
                activePeriod={activePeriod}
                action={action}
                hiddenParams={hiddenParams}
                options={years}
              />
            ) : null}
          </div>
        </details>
        <Link
          className="period-step"
          href={periodHref(action, hiddenParams, nextPeriod)}
          aria-label={`Next ${activeKind}`}
        >
          ›
        </Link>
      </div>
    </section>
  );
}

function PeriodOptionGrid({
  activePeriod,
  action,
  hiddenParams,
  options,
}: {
  activePeriod: string;
  action?: string;
  hiddenParams: HiddenParam[];
  options: PeriodOption[];
}) {
  return (
    <div className="period-option-grid">
      {options.map((option) => (
        <Link
          key={option.value}
          className={option.value === activePeriod ? "active" : ""}
          href={periodHref(action, hiddenParams, option.value)}
          aria-current={option.value === activePeriod ? "page" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function PeriodOptionList({
  activePeriod,
  action,
  hiddenParams,
  options,
}: {
  activePeriod: string;
  action?: string;
  hiddenParams: HiddenParam[];
  options: PeriodOption[];
}) {
  return (
    <div className="period-option-list">
      {options.map((option) => (
        <Link
          key={option.value}
          className={option.value === activePeriod ? "active" : ""}
          href={periodHref(action, hiddenParams, option.value)}
          aria-current={option.value === activePeriod ? "page" : undefined}
        >
          <span>{option.label}</span>
          {option.meta ? <small>{option.meta}</small> : null}
        </Link>
      ))}
    </div>
  );
}

function getReferenceDate(activePeriod: string): Date {
  return periodStartDate(activePeriod);
}

function getYearOptions(activePeriod: string): PeriodOption[] {
  const now = new Date();
  const years = new Set<string>();

  for (let offset = 0; offset < 5; offset += 1) {
    years.add(String(now.getUTCFullYear() - offset));
  }
  years.add(String(periodStartDate(activePeriod).getUTCFullYear()));

  return [...years].sort().reverse().map((period) => ({
    label: period,
    value: period,
  }));
}

function getMonthOptions(referenceDate: Date, activePeriod: string): PeriodOption[] {
  const months = new Set<string>();
  const year = referenceDate.getUTCFullYear();

  for (let month = 0; month < 12; month += 1) {
    months.add(toMonthPeriod(new Date(Date.UTC(year, month, 1))));
  }
  if (periodKind(activePeriod) === "month") months.add(activePeriod);

  return [...months].sort().map((period) => ({
    label: new Intl.DateTimeFormat("en", {
      month: "short",
      timeZone: "UTC",
    }).format(periodStartDate(period)),
    value: period,
  }));
}

function getWeekOptions(referenceDate: Date, activePeriod: string): PeriodOption[] {
  const weeks = new Set<string>();

  for (let offset = -2; offset < 10; offset += 1) {
    weeks.add(toIsoWeekPeriod(addDays(referenceDate, -offset * 7)));
  }
  if (periodKind(activePeriod) === "week") weeks.add(activePeriod);

  return [...weeks].sort().reverse().map((period) => ({
    label: formatWeekRange(period),
    meta: formatPeriodLabel(period),
    value: period,
  }));
}

function periodHref(
  action: string | undefined,
  hiddenParams: HiddenParam[],
  period: string,
): string {
  const params = new URLSearchParams();
  for (const param of hiddenParams) {
    params.set(param.name, param.value);
  }
  params.set("period", period);

  return `${action ?? ""}?${params.toString()}`;
}

function summaryLabel(period: string): string {
  if (periodKind(period) === "week") {
    return `${formatWeekRange(period)}, ${period.slice(0, 4)}`;
  }

  return formatPeriodLabel(period);
}

export { formatPeriodLabel } from "@/lib/periods";
