import { brandName } from "@paceandpush/brand";
import Link from "next/link";
import { legalEntity, legalLinks } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Legal information">
      <div className="site-footer-inner">
        <span>
          {brandName} is operated by {legalEntity.displayName}.
        </span>
        <nav aria-label="Legal links">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
