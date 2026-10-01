import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address");

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}
