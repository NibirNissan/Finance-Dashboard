import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const expenseTypeEnum = pgEnum("expense_type", ["recurring", "one-time"]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  category: text("category").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  type: expenseTypeEnum("type").notNull().default("one-time"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
