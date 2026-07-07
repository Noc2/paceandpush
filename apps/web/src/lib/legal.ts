export const legalEntity = {
  name: "Hawig Ventures UG (haftungsbeschränkt)",
  displayName: "Hawig Ventures UG (haftungsbeschränkt)",
  address: ["Herzogin-Juliana-Straße 7", "55469 Simmern", "Germany"],
  displayAddress: ["Herzogin-Juliana-Straße 7", "55469 Simmern", "Germany"],
  managingDirector: "David Hawig",
  registerCourt: "Amtsgericht Bad Kreuznach",
  registerNumber: "HRB 24975",
  vatId:
    "Es ist derzeit keine Umsatzsteuer-Identifikationsnummer nach § 27a UStG zugeteilt.",
  email: "hawigxyz@proton.me",
  employeesVsbThresholdStatus: "weniger als 11 Beschäftigte",
  consumerDisputeResolution:
    "Wir sind weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
} as const;

export const legalLinks = [
  { href: "/impressum", label: "Impressum" },
  { href: "/privacy", label: "Privacy" },
] as const;
