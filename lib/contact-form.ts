export const contactSubjects = [
  "General question",
  "Support",
  "Feedback",
  "Partnership",
] as const;

export type ContactSubject = (typeof contactSubjects)[number];
