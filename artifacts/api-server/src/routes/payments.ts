import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, paymentRequestsTable, pricingPlansTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const SubmitBody = z.object({
  planId: z.number().int().positive(),
  paymentMethod: z.enum(["bKash", "Nagad"]),
  senderNumber: z.string().min(5).max(20),
  trxId: z.string().min(3).max(60),
});

// GET /api/payments/my-requests — return the current user's latest payment request status
router.get("/payments/my-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;

  // Fetch the single most recent request for this user
  const rows = await db
    .select()
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.userId, userId))
    .orderBy(desc(paymentRequestsTable.createdAt))
    .limit(1);

  if (rows.length === 0 || rows[0].status === "approved") {
    // No requests, or the latest is approved — plan is active, no banner needed
    res.json({ status: "none", request: null });
    return;
  }

  res.json({ status: rows[0].status, request: rows[0] });
});

// GET /api/payments/pending — check if the current user has a pending payment request (legacy)
router.get("/payments/pending", requireAuth, async (req, res): Promise<void> => {
  const userId = req.localUser!.id;
  const rows = await db
    .select()
    .from(paymentRequestsTable)
    .where(and(eq(paymentRequestsTable.userId, userId), eq(paymentRequestsTable.status, "pending")))
    .limit(1);

  res.json({ hasPending: rows.length > 0, request: rows[0] ?? null });
});

// GET /api/payments/numbers — return admin-configured bKash/Nagad numbers (authenticated)
router.get("/payments/numbers", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(systemSettingsTable).limit(1);
  if (rows.length === 0) {
    res.json({ bkashNumber: "", nagadNumber: "" });
    return;
  }
  const { bkashNumber, nagadNumber } = rows[0];
  res.json({ bkashNumber, nagadNumber });
});

// POST /api/payments/submit
router.post("/payments/submit", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.localUser!.id;
  const { planId, paymentMethod, senderNumber, trxId } = parsed.data;

  // Ensure the plan exists and is active
  const [plan] = await db
    .select()
    .from(pricingPlansTable)
    .where(and(eq(pricingPlansTable.id, planId), eq(pricingPlansTable.isActive, true)))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found or inactive" });
    return;
  }

  // Check for existing pending request by this user
  const [existingPending] = await db
    .select({ id: paymentRequestsTable.id })
    .from(paymentRequestsTable)
    .where(and(eq(paymentRequestsTable.userId, userId), eq(paymentRequestsTable.status, "pending")))
    .limit(1);

  if (existingPending) {
    res.status(409).json({ error: "You already have a pending payment request. Please wait for admin verification." });
    return;
  }

  // Check duplicate trxId
  const [dupTrx] = await db
    .select({ id: paymentRequestsTable.id })
    .from(paymentRequestsTable)
    .where(eq(paymentRequestsTable.trxId, trxId))
    .limit(1);

  if (dupTrx) {
    res.status(409).json({ error: "This transaction ID has already been submitted." });
    return;
  }

  const [created] = await db
    .insert(paymentRequestsTable)
    .values({ userId, planId, paymentMethod, senderNumber, trxId })
    .returning();

  res.status(201).json({ id: created.id, status: created.status });
});

export default router;
