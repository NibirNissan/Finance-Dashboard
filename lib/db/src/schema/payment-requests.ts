import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { pricingPlansTable } from "./pricing-plans";

export const paymentMethodEnum = pgEnum("payment_method", ["bKash", "Nagad"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "rejected"]);

export const paymentRequestsTable = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => pricingPlansTable.id, { onDelete: "cascade" }),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  senderNumber: text("sender_number").notNull(),
  trxId: text("trx_id").notNull().unique(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentRequest = typeof paymentRequestsTable.$inferSelect;
export type NewPaymentRequest = typeof paymentRequestsTable.$inferInsert;
