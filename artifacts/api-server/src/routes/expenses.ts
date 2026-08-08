import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, expensesTable, categoriesTable } from "@workspace/db";
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  DeleteExpenseParams,
  GetExpenseHistoryQueryParams,
  GetExpenseHistoryResponse,
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

const MAX_HISTORY_MONTHS = 24;

function isValidCalendarMonth(month: string): boolean {
  const [, m] = month.split("-").map(Number);
  return m >= 1 && m <= 12;
}

router.get(
  "/expenses/history",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsedParams = GetExpenseHistoryQueryParams.safeParse(req.query);
    if (!parsedParams.success) {
      res.status(400).json({ error: parsedParams.error.message });
      return;
    }

    const userId = req.localUser!.id;
    const toMonth = parsedParams.data.to ?? currentMonth();
    const fromMonth = (() => {
      if (parsedParams.data.from) return parsedParams.data.from;
      // Default to 5 months ago so we get 6 months total (from..to inclusive)
      const [year, month] = toMonth.split("-").map(Number);
      const d = new Date(year, month - 1 - 5, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    // Semantic validation: calendar months must be valid (01-12) and ordered
    if (!isValidCalendarMonth(fromMonth)) {
      res.status(400).json({ error: `Invalid month: ${fromMonth}` });
      return;
    }
    if (!isValidCalendarMonth(toMonth)) {
      res.status(400).json({ error: `Invalid month: ${toMonth}` });
      return;
    }
    if (fromMonth > toMonth) {
      res.status(400).json({ error: "'from' must not be after 'to'" });
      return;
    }

    // Build month list first so we can enforce the max range before any DB query
    const months: string[] = [];
    let cursor = fromMonth;
    while (cursor <= toMonth) {
      months.push(cursor);
      if (months.length > MAX_HISTORY_MONTHS) {
        res.status(400).json({ error: `Date range exceeds maximum of ${MAX_HISTORY_MONTHS} months` });
        return;
      }
      const [y, m] = cursor.split("-").map(Number);
      const next = new Date(y, m, 1);
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    }

    const { start } = monthBounds(fromMonth);
    const { end } = monthBounds(toMonth);

    // Get all expenses in the range, grouped by month (YYYY-MM), category, and type
    const rows = await db
      .select({
        month: sql<string>`to_char(${expensesTable.date}, 'YYYY-MM')`,
        category: expensesTable.category,
        type: expensesTable.type,
        total: sql<number>`coalesce(sum(${expensesTable.amount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(expensesTable)
      .where(
        and(
          eq(expensesTable.userId, userId),
          gte(expensesTable.date, start),
          lt(expensesTable.date, end),
        ),
      )
      .groupBy(
        sql`to_char(${expensesTable.date}, 'YYYY-MM')`,
        expensesTable.category,
        expensesTable.type,
      )
      .orderBy(sql`to_char(${expensesTable.date}, 'YYYY-MM')`);

    // Fetch active categories for zero-filling
    const activeCategories = await db
      .select({ name: categoriesTable.name })
      .from(categoriesTable)
      .where(eq(categoriesTable.isActive, true))
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
    const knownCategoryNames = activeCategories.map((c) => c.name);

    const summaries = months.map((month) => {
      const monthRows = rows.filter((r) => r.month === month);
      const total = monthRows.reduce((s, r) => s + Number(r.total), 0);
      const transactionCount = monthRows.reduce((s, r) => s + Number(r.count), 0);
      const recurringTotal = monthRows
        .filter((r) => r.type === "recurring")
        .reduce((s, r) => s + Number(r.total), 0);
      const oneTimeTotal = monthRows
        .filter((r) => r.type === "one-time")
        .reduce((s, r) => s + Number(r.total), 0);

      // Category totals
      const categoryMap = new Map<string, number>();
      for (const r of monthRows) {
        categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + Number(r.total));
      }
      // Include extra categories not in known list
      const extraNames = [...categoryMap.keys()].filter((c) => !knownCategoryNames.includes(c));
      const allNames = [...knownCategoryNames, ...extraNames];
      const byCategory = allNames.map((category) => ({
        category,
        total: categoryMap.get(category) ?? 0,
      }));

      return { month, total, transactionCount, recurringTotal, oneTimeTotal, byCategory };
    });

    res.json(GetExpenseHistoryResponse.parse(summaries));
  },
);

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
