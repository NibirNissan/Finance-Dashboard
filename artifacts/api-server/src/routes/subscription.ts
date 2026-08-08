import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// The instant upgrade endpoint has been disabled.
// Subscriptions are now activated only through the manual payment verification flow:
//   POST /api/payments/submit   → user submits bKash/Nagad transaction ID
//   POST /api/admin/payments/:id/approve → admin verifies and activates subscription
router.post("/subscription/upgrade", requireAuth, async (_req, res): Promise<void> => {
  res.status(410).json({
    error: "Direct upgrade is no longer available. Please subscribe via bKash or Nagad and wait for admin verification.",
  });
});

export default router;
