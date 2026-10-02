/**
 * Auth session shape shared by web and mobile.
 * Cookie encoding and HMAC signing stay in the web app.
 */
import { z } from "zod";

export const authSessionSchema = z.object({
  provider: z.enum(["google", "email"]),
  email: z.string().email(),
  name: z.string().optional(),
  username: z.string().optional(),
  picture: z.string().url().optional().or(z.literal("")),
});

export type AuthSession = z.infer<typeof authSessionSchema>;
