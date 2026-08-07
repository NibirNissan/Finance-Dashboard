import { createInsertSchema } from "drizzle-zod";
import { date, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "Utilities",
  "Bazar",
  "One-Time",
]);

export const expenseTypeEnum = pgEnum("expense_type", ["recurring", "one-time"]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  category: expenseCategoryEnum("category").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  type: expenseTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;