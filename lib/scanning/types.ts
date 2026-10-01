import { z } from "zod";

export const scanningJobStatusSchema = z.enum([
  "pending",
  "connecting",
  "scanning",
  "processing",
  "extracting",
  "organizing",
  "completed",
  "failed",
]);

export type ScanningJobStatus = z.infer<typeof scanningJobStatusSchema>;

export const scanningStepIdSchema = z.enum([
  "connecting_to_gmail",
  "finding_subscription_emails",
  "identifying_subscriptions",
  "checking_renewal_dates",
  "organizing_everything",
]);

export type ScanningStepId = z.infer<typeof scanningStepIdSchema>;

export const scanningJobSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  status: scanningJobStatusSchema,
  currentStep: scanningStepIdSchema.nullable(),
  progress: z.number().min(0).max(100),
  emailsScanned: z.number().int().nonnegative(),
  relevantEmailsFound: z.number().int().nonnegative(),
  subscriptionsFound: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
});

export type ScanningJob = z.infer<typeof scanningJobSchema>;

export type ScanningStepVisualState = "completed" | "active" | "pending";

export type ScanningChecklistItem = {
  id: string;
  label: string;
  state: ScanningStepVisualState;
};
