/**
 * Email validation helpers shared by web and mobile.
 * Pure Zod rules — no browser or Next.js APIs.
 */
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address");

/** Returns true when the value is a valid email address. */
export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}
