import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemePreferenceControl } from "./ThemePreferenceControl";

export function SiteHeader({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <header className="topbar">
      <Link
        href="/"
        className={compact ? "brand-lockup compact" : "brand-lockup"}
        aria-label={brandName}
      >
        <span className="logo-mark" aria-hidden="true">
          {promptMark.character}
        </span>
        <span>
          <strong>{brandName}</strong>
          {compact ? null : <small>{brandTagline}</small>}
        </span>
      </Link>

      <div className="site-header-actions">
        <ThemePreferenceControl compact />
        {children}
      </div>
    </header>
  );
}
