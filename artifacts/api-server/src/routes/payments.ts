import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  paymentRequestsTable,
  pricingPlansTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/admin";

const router: IRouter = Router();

// ── User: submit a payment request ───────────────────────────────────────────

const SubmitBody = z.object({
  planId: z.number().int().positive(),
  paymentMethod: z.enum(["bkash", "nagad"]),
  senderNumber: z.string().min(1, "Sender number is required"),
  transactionId: z.string().min(1, "Transaction ID is required"),
});

router.post("/payments/submit", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { planId, paymentMethod, senderNumber, transactionId } = parsed.data;
  const userId = req.localUser!.id;

  // Verify plan exists
  const [plan] = await db
    .select()
    .from(pricingPlansTable)
    .where(eq(pricingPlansTable.id, planId))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  // Check for a duplicate pending request for this user + plan
  const existing = await db
    .select({ id: paymentRequestsTable.id })
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.userId, userId))
    .limit(10);

  const alreadyPending = existing.some(
    (r) =>
      (r as unknown as { status: string; planId: number }).status === "pending" &&
      (r as unknown as { planId: number }).planId === planId
  );

  // Re-query with full row to properly check
  const existingFull = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.userId, userId));

  const hasPending = existingFull.some(
    (r) => r.status === "pending" && r.planId === planId
  );

  if (hasPending) {
    res.status(409).json({ error: "You already have a pending payment request for this plan. Please wait for admin review." });
    return;
  }

  const [request] = await db
    .insert(paymentRequestsTable)
    .values({
      userId,
      planId,
      amount: plan.price,
      paymentMethod,
      senderNumber: senderNumber.trim(),
      transactionId: transactionId.trim(),
    })
    .returning();

  res.status(201).json({
    id: request.id,
    status: request.status,
    message: "Payment submitted. Your account will be upgraded once an admin verifies the transaction.",
  });
});

// ── Admin: list payment requests (with user + plan info) ──────────────────────

router.get("/admin/payments", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const { usersTable, pricingPlansTable: plansTable } = await import("@workspace/db");
  const alias = { user: usersTable, plan: plansTable };

  const rows = await db
    .select({
      id: paymentRequestsTable.id,
      amount: paymentRequestsTable.amount,
      paymentMethod: paymentRequestsTable.paymentMethod,
      senderNumber: paymentRequestsTable.senderNumber,
      transactionId: paymentRequestsTable.transactionId,
      status: paymentRequestsTable.status,
      createdAt: paymentRequestsTable.createdAt,
      reviewedAt: paymentRequestsTable.reviewedAt,
      userId: paymentRequestsTable.userId,
      planId: paymentRequestsTable.planId,
      userEmail: alias.user.email,
      userName: alias.user.name,
      planName: alias.plan.planName,
      planSlug: alias.plan.slug,
    })
    .from(paymentRequestsTable)
    .leftJoin(alias.user, eq(alias.user.id, paymentRequestsTable.userId))
    .leftJoin(alias.plan, eq(alias.plan.id, paymentRequestsTable.planId))
    .orderBy(paymentRequestsTable.createdAt);

  res.json(rows);
});

// ── Admin: approve a payment request ─────────────────────────────────────────

router.post("/admin/payments/:id/approve", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.id, id))
    .limit(1);

  if (!request) { res.status(404).json({ error: "Payment request not found" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  const adminId = req.localUser!.id;

  // Activate subscription on the user
  const [plan] = await db
    .select()
    .from(pricingPlansTable)
    .where(eq(pricingPlansTable.id, request.planId))
    .limit(1);

  if (!plan) { res.status(404).json({ error: "Plan no longer exists" }); return; }

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + plan.durationInMonths);

  const { usersTable } = await import("@workspace/db");
  await db
    .update(usersTable)
    .set({ subscriptionPlan: plan.slug, subscriptionExpiry: expiry })
    .where(eq(usersTable.id, request.userId));

  const [updated] = await db
    .update(paymentRequestsTable)
    .set({ status: "approved", reviewedBy: adminId, reviewedAt: new Date() })
    .where(eq(paymentRequestsTable.id, id))
    .returning();

  res.json(updated);
});

// ── Admin: reject a payment request ──────────────────────────────────────────

router.post("/admin/payments/:id/reject", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.id, id))
    .limit(1);

  if (!request) { res.status(404).json({ error: "Payment request not found" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: `Request is already ${request.status}` });
    return;
  }

  const adminId = req.localUser!.id;
  const [updated] = await db
    .update(paymentRequestsTable)
    .set({ status: "rejected", reviewedBy: adminId, reviewedAt: new Date() })
    .where(eq(paymentRequestsTable.id, id))
    .returning();

  res.json(updated);
});

export default router;
