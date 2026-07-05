export const legalEntity = {
  name: "Hawig Ventures UG (haftungsbeschraenkt)",
  displayName: "Hawig Ventures UG (haftungsbeschränkt)",
  address: ["Herzogin-Juliana-Strasse 7", "55469 Simmern", "Germany"],
  displayAddress: ["Herzogin-Juliana-Straße 7", "55469 Simmern", "Germany"],
  managingDirector: "To be added before public launch",
  registerCourt: "To be added before public launch",
  registerNumber: "To be added before public launch",
  vatId: "To be added if available",
  email: "To be added before public launch",
  employeesVsbThresholdStatus: "To be confirmed before public launch",
  consumerDisputeResolution:
    "Participation in consumer dispute resolution will be confirmed before consumer-facing launch.",
} as const;

export const legalLinks = [
  { href: "/impressum", label: "Impressum" },
  { href: "/privacy", label: "Privacy" },
] as const;
