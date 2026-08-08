import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  announcementText: text("announcement_text").notNull().default(""),
  isAnnouncementActive: boolean("is_announcement_active").notNull().default(false),
  allowRegistrations: boolean("allow_registrations").notNull().default(true),
  bkashNumber: text("bkash_number").notNull().default(""),
  nagadNumber: text("nagad_number").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SystemSettings = typeof systemSettingsTable.$inferSelect;
