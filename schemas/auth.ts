import { z } from "zod";

/** Business identity data, never an alternative token verifier. */
export const ssoProfileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().min(1).max(255),
  name: z.string().nullable().optional(),
  preferred_username: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "suspended", "deleted"]),
});
export type SsoProfile = z.infer<typeof ssoProfileSchema>;
