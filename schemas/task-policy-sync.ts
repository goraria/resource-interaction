import { z } from "zod";

export const taskPolicySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal("task"),
    type: z.literal("snapshot"),
    epoch: z.uuid(),
    revision: z
      .string()
      .regex(/^[1-9][0-9]{0,18}$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n),
    snapshotId: z.uuid(),
    issuedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    grants: z
      .array(
        z
          .object({
            pageId: z.uuid(),
            subject: z.string().min(1).max(255),
            comment: z.boolean(),
          })
          .strict(),
      )
      .max(20_000),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set<string>();
    for (const grant of value.grants) {
      const key = grant.pageId + ":" + grant.subject;
      if (keys.has(key))
        context.addIssue({ code: "custom", message: "duplicate_grant" });
      keys.add(key);
    }
  });

export type TaskPolicySnapshot = z.infer<typeof taskPolicySnapshotSchema>;
