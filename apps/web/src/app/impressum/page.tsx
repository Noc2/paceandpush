import type { Metadata } from "next";
import { brandName } from "@paceandpush/brand";
import Link from "next/link";
import { legalEntity } from "@/lib/legal";
import { SiteHeader } from "@/app/SiteHeader";

export const metadata: Metadata = {
  title: `Impressum | ${brandName}`,
  description: `Legal provider information for ${brandName}.`,
};

export default function ImpressumPage() {
  return (
    <main className="app-shell legal-page" lang="de">
      <section className="app-frame" aria-label="Impressum">
        <SiteHeader compact>
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </SiteHeader>

        <section className="profile-hero">
          <p className="section-label">Legal</p>
          <h1>Impressum</h1>
          <p>Angaben nach § 5 DDG für den Dienst {brandName}.</p>
        </section>

        <div className="legal-content">
          <section className="legal-section">
            <h2>Diensteanbieter</h2>
            <address>
              <strong>{legalEntity.displayName}</strong>
              {legalEntity.displayAddress.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          </section>

          <section className="legal-section">
            <h2>Vertreten durch</h2>
            <p>{legalEntity.managingDirector}</p>
          </section>

          <section className="legal-section">
            <h2>Kontakt</h2>
            <dl className="legal-list">
              <div>
                <dt>E-Mail</dt>
                <dd>{legalEntity.email}</dd>
              </div>
            </dl>
          </section>

          <section className="legal-section">
            <h2>Registereintrag</h2>
            <dl className="legal-list">
              <div>
                <dt>Registergericht</dt>
                <dd>{legalEntity.registerCourt}</dd>
              </div>
              <div>
                <dt>Registernummer</dt>
                <dd>{legalEntity.registerNumber}</dd>
              </div>
            </dl>
          </section>

          <section className="legal-section">
            <h2>Umsatzsteuer</h2>
            <p>{legalEntity.vatId}</p>
          </section>

          <section className="legal-section">
            <h2>Verbraucherstreitbeilegung</h2>
            <p>{legalEntity.consumerDisputeResolution}</p>
            <p>
              Mitarbeiterzahl nach § 36 Abs. 3 VSBG:{" "}
              {legalEntity.employeesVsbThresholdStatus}.
            </p>
          </section>

          <section className="legal-section legal-warning">
            <h2>Launch checklist</h2>
            <p>
              Registergericht, Registernummer, vertretungsberechtigte Person und
              eine funktionierende E-Mail-Adresse müssen vor dem öffentlichen
              Launch ergänzt und rechtlich geprüft werden.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
