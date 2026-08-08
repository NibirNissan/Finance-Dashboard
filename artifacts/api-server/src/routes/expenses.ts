import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, expensesTable, categoriesTable } from "@workspace/db";
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  DeleteExpenseParams,
  GetMonthlySummaryQueryParams,
  GetMonthlySummaryResponse,
  ListExpensesResponse,
  UpdateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const endYear = monthNumber === 12 ? year + 1 : year;
  const endMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    start: `${month}-01`,
    end: `${endYear}-${String(endMonth).padStart(2, "0")}-01`,
  };
}

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const expenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.userId, userId))
    .orderBy(desc(expensesTable.date), desc(expensesTable.createdAt));

  res.json(ListExpensesResponse.parse(expenses));
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db
    .insert(expensesTable)
    .values({
      ...parsed.data,
      userId: req.localUser!.id,
      date: parsed.data.date.toISOString().slice(0, 10),
    })
    .returning();

  res.status(201).json(CreateExpenseResponse.parse(expense));
});

router.patch("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [expense] = await db
    .update(expensesTable)
    .set({
      ...parsed.data,
      date: parsed.data.date.toISOString().slice(0, 10),
    })
    .where(
      and(
        eq(expensesTable.id, params.data.id),
        eq(expensesTable.userId, req.localUser!.id),
      ),
    )
    .returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.json(UpdateExpenseResponse.parse(expense));
});

router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [expense] = await db
    .delete(expensesTable)
    .where(
      and(
        eq(expensesTable.id, params.data.id),
        eq(expensesTable.userId, req.localUser!.id),
      ),
    )
    .returning({ id: expensesTable.id });

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  res.sendStatus(204);
});

router.get(
  "/expenses/summary/monthly",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsedParams = GetMonthlySummaryQueryParams.safeParse(req.query);
    if (!parsedParams.success) {
      res.status(400).json({ error: parsedParams.error.message });
      return;
    }

    const userId = req.localUser!.id;
    const month = parsedParams.data.month ?? currentMonth();
    const { start, end } = monthBounds(month);
    const where = and(
      eq(expensesTable.userId, userId),
      gte(expensesTable.date, start),
      lt(expensesTable.date, end),
    );

    const [totals] = await db
      .select({
        total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)`,
        transactionCount: sql<number>`count(*)`,
        recurringTotal: sql<number>`coalesce(sum(case when ${expensesTable.type} = 'recurring' then ${expensesTable.amount} else 0 end), 0)`,
        oneTimeTotal: sql<number>`coalesce(sum(case when ${expensesTable.type} = 'one-time' then ${expensesTable.amount} else 0 end), 0)`,
      })
      .from(expensesTable)
      .where(where);

    const categoryRows = await db
      .select({
        category: expensesTable.category,
        total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)`,
      })
      .from(expensesTable)
      .where(where)
      .groupBy(expensesTable.category)
      .orderBy(asc(expensesTable.category));

    // Fetch active categories for zero-filling
    const activeCategories = await db
      .select({ name: categoriesTable.name })
      .from(categoriesTable)
      .where(eq(categoriesTable.isActive, true))
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));

    const knownNames = activeCategories.map((c) => c.name);
    // Include any categories in expenses that may not be in the categories table
    const extraNames = categoryRows
      .map((r) => r.category)
      .filter((c) => !knownNames.includes(c));
    const allNames = [...knownNames, ...extraNames];

    const byCategory = allNames.map((category) => ({
      category,
      total: Number(categoryRows.find((row) => row.category === category)?.total ?? 0),
    }));

    res.json(
      GetMonthlySummaryResponse.parse({
        month,
        total: Number(totals?.total ?? 0),
        transactionCount: Number(totals?.transactionCount ?? 0),
        recurringTotal: Number(totals?.recurringTotal ?? 0),
        oneTimeTotal: Number(totals?.oneTimeTotal ?? 0),
        byCategory,
      }),
    );
  },
);

export default router;
