import { Router, type IRouter } from "express";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import {
  db,
  categoriesTable,
  pricingPlansTable,
  systemSettingsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/admin";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function planOut(p: typeof pricingPlansTable.$inferSelect) {
  return {
    id: p.id,
    planName: p.planName,
    slug: p.slug,
    price: p.price,
    durationInMonths: p.durationInMonths,
    features: p.features,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  };
}

function catOut(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
  };
}

async function ensureSettings() {
  const rows = await db.select().from(systemSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(systemSettingsTable).values({}).returning();
  return created;
}

// ── Public endpoints ──────────────────────────────────────────────────────────

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(rows.map(catOut));
});

router.get("/pricing-plans", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(pricingPlansTable)
    .where(eq(pricingPlansTable.isActive, true))
    .orderBy(asc(pricingPlansTable.sortOrder));
  res.json(rows.map(planOut));
});

router.get("/settings", async (_req, res): Promise<void> => {
  const s = await ensureSettings();
  res.json({
    announcementText: s.announcementText,
    isAnnouncementActive: s.isAnnouncementActive,
    allowRegistrations: s.allowRegistrations,
  });
});

// ── Admin: Categories ─────────────────────────────────────────────────────────

const CategoryBody = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().max(10).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/admin/categories", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(rows.map(catOut));
});

router.post("/admin/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(catOut(row));
});

router.patch("/admin/categories/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = CategoryBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(catOut(row));
});

router.delete("/admin/categories/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning({ id: categoriesTable.id });
  if (!row) { res.status(404).json({ error: "Category not found" }); return; }
  res.sendStatus(204);
});

// ── Admin: Pricing Plans ──────────────────────────────────────────────────────

const PlanBody = z.object({
  planName: z.string().min(1).max(80),
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  price: z.number().min(0),
  durationInMonths: z.number().int().min(1),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/admin/pricing-plans", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(pricingPlansTable).orderBy(asc(pricingPlansTable.sortOrder));
  res.json(rows.map(planOut));
});

router.post("/admin/pricing-plans", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = PlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(pricingPlansTable).values(parsed.data).returning();
  res.status(201).json(planOut(row));
});

router.patch("/admin/pricing-plans/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = PlanBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(pricingPlansTable).set(parsed.data).where(eq(pricingPlansTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(planOut(row));
});

router.delete("/admin/pricing-plans/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [row] = await db.delete(pricingPlansTable).where(eq(pricingPlansTable.id, id)).returning({ id: pricingPlansTable.id });
  if (!row) { res.status(404).json({ error: "Plan not found" }); return; }
  res.sendStatus(204);
});

// ── Admin: System Settings ────────────────────────────────────────────────────

const SettingsBody = z.object({
  announcementText: z.string().max(500).optional(),
  isAnnouncementActive: z.boolean().optional(),
  allowRegistrations: z.boolean().optional(),
});

router.get("/admin/settings", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const s = await ensureSettings();
  res.json(s);
});

router.patch("/admin/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = SettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const s = await ensureSettings();
  const [updated] = await db
    .update(systemSettingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(systemSettingsTable.id, s.id))
    .returning();
  res.json(updated);
});

export default router;
