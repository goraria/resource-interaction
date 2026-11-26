import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const taskPolicyProjectionTable = pgTable(
  "task_policy_projection",
  {
    id: text("id").primaryKey(),
    epoch: uuid("epoch").notNull(),
    revision: bigint("revision", { mode: "bigint" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    digest: text("digest").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("task_policy_projection_id_check", sql`${table.id} = 'task'`),
    check("task_policy_projection_revision_check", sql`${table.revision} > 0`),
    check(
      "task_policy_projection_check",
      sql`${table.expiresAt} > ${table.issuedAt} AND ${table.expiresAt} <= ${table.issuedAt} + interval '120 seconds'`,
    ),
  ],
);

export const taskPolicyGrantTable = pgTable(
  "task_policy_grant",
  {
    pageId: uuid("page_id").notNull(),
    subject: text("subject").notNull(),
    comment: boolean("comment").notNull(),
  },
  (table) => [
    primaryKey({
      name: "task_policy_grant_pkey",
      columns: [table.pageId, table.subject],
    }),
    index("task_policy_grant_subject_idx").on(table.subject, table.pageId),
    check(
      "task_policy_grant_subject_check",
      sql`length(${table.subject}) BETWEEN 1 AND 255`,
    ),
  ],
);
