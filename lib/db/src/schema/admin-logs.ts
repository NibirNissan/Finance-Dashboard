import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  actionType: text("action_type").notNull(), // e.g. "suspend_user" | "unban_user" | "upgrade_user"
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
