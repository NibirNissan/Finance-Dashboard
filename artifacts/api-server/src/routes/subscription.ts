import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, usersTable, pricingPlansTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const UpgradeBody = z.object({
  planId: z.number().int().positive(),
});

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
  };
}

// Dummy payment — immediately upgrades the subscription based on plan from DB
router.post("/subscription/upgrade", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpgradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db
    .select()
    .from(pricingPlansTable)
    .where(eq(pricingPlansTable.id, parsed.data.planId))
    .limit(1);

  if (!plan || !plan.isActive) {
    res.status(404).json({ error: "Plan not found or inactive" });
    return;
  }

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + plan.durationInMonths);

  const [user] = await db
    .update(usersTable)
    .set({ subscriptionPlan: plan.slug, subscriptionExpiry: expiry })
    .where(eq(usersTable.id, req.localUser!.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: publicUser(user) });
});

export default router;
