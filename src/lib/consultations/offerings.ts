export const consultationKinds = ["FIRST_TIME", "RETURNING"] as const;

export type ConsultationKind = (typeof consultationKinds)[number];

export const consultationOfferings = {
  FIRST_TIME: {
    kind: "FIRST_TIME",
    name: "1 Hour First-Time Consultation",
    durationMinutes: 60,
    priceCents: 20_000
  },
  RETURNING: {
    kind: "RETURNING",
    name: "1 Hour Consultation",
    durationMinutes: 60,
    priceCents: 15_000
  }
} as const satisfies Record<ConsultationKind, {
  kind: ConsultationKind;
  name: string;
  durationMinutes: number;
  priceCents: number;
}>;

export function consultationOffering(kind: ConsultationKind) {
  return consultationOfferings[kind];
}

export function consultationKindForHistory(hasCompletedFirstTimeConsultation: boolean): ConsultationKind {
  return hasCompletedFirstTimeConsultation ? "RETURNING" : "FIRST_TIME";
}
