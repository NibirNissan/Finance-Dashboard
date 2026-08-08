import { Router, type IRouter } from "express";
import { z } from "zod";
import { count, desc, eq, ne, and, gt, isNull } from "drizzle-orm";
import { db, usersTable, expensesTable, adminLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/admin";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function publicUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    accountType: user.accountType,
    role: user.role,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

async function insertLog(adminId: number, actionType: string, description: string) {
  await db.insert(adminLogsTable).values({ adminId, actionType, description });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get("/admin/stats", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();

  const [{ totalUsers }] = await db
    .select({ totalUsers: count() })
    .from(usersTable);

  const activeSubscriberRows = await db
    .select({ plan: usersTable.subscriptionPlan, cnt: count() })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.subscriptionPlan, "free"),
        gt(usersTable.subscriptionExpiry, now),
      ),
    )
    .groupBy(usersTable.subscriptionPlan);

  const activeSubscribers = activeSubscriberRows.reduce((sum, r) => sum + Number(r.cnt), 0);
  const monthlyCount = Number(activeSubscriberRows.find((r) => r.plan === "monthly")?.cnt ?? 0);
  const yearlyCount = Number(activeSubscriberRows.find((r) => r.plan === "yearly")?.cnt ?? 0);
  const totalRevenue = monthlyCount * 100 + yearlyCount * 500;

  res.json({ totalUsers: Number(totalUsers), activeSubscribers, totalRevenue });
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(users.map(publicUser));
});

router.post(
  "/admin/user/:id/toggle-status",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const [existing] = await db
      .select({ status: usersTable.status, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "User not found" }); return; }

    const newStatus = existing.status === "active" ? "suspended" : "active";
    const [user] = await db
      .update(usersTable)
      .set({ status: newStatus })
      .where(eq(usersTable.id, id))
      .returning();

    // Activity log
    const actionType = newStatus === "suspended" ? "suspend_user" : "unban_user";
    const verb = newStatus === "suspended" ? "Suspended" : "Unbanned";
    await insertLog(
      req.localUser!.id,
      actionType,
      `${verb} user "${existing.name}" (id: ${id})`,
    );

    res.json(publicUser(user));
  },
);

const UpgradeBody = z.object({
  plan: z.enum(["monthly", "yearly"]),
});

router.post(
  "/admin/user/:id/upgrade",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const parsed = UpgradeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { plan } = parsed.data;
    const expiry = new Date();
    if (plan === "monthly") expiry.setMonth(expiry.getMonth() + 1);
    else expiry.setFullYear(expiry.getFullYear() + 1);

    const [existing] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    const [user] = await db
      .update(usersTable)
      .set({ subscriptionPlan: plan, subscriptionExpiry: expiry })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Activity log
    await insertLog(
      req.localUser!.id,
      "upgrade_user",
      `Manually upgraded "${existing?.name ?? `user #${id}`}" to ${plan} plan`,
    );

    res.json(publicUser(user));
  },
);

// ── Activity Logs ─────────────────────────────────────────────────────────────

router.get("/admin/logs", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(adminLogsTable)
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(500);

  res.json(
    logs.map((l) => ({
      id: l.id,
      adminId: l.adminId,
      actionType: l.actionType,
      description: l.description,
      createdAt: l.createdAt.toISOString(),
    })),
  );
});

// ── Orphan cleanup ────────────────────────────────────────────────────────────

router.post(
  "/admin/expenses/purge-orphaned",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    const deleted = await db
      .delete(expensesTable)
      .where(isNull(expensesTable.userId))
      .returning({ id: expensesTable.id });

    res.json({ deleted: deleted.length, ids: deleted.map((r) => r.id) });
  },
);

export default router;
