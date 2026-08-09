import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const UpdateProfileBody = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
});

const UpdateAccountTypeBody = z.object({
  accountType: z.enum(["Single Person", "Family"]),
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

// GET — return the JIT-provisioned local user attached by requireAuth
router.get("/user/profile", requireAuth, async (req, res): Promise<void> => {
  try {
    res.json(publicUser(req.localUser!));
  } catch (err) {
    console.error("GET /user/profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// PATCH — set account type during onboarding (called once, after sign-up)
router.patch("/user/account-type", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateAccountTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ accountType: parsed.data.accountType })
    .where(eq(usersTable.id, req.localUser!.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(user));
});

router.patch("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.localUser!.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(publicUser(user));
});

export default router;
