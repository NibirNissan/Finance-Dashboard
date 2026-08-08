import { Router, type IRouter } from "express";
import healthRouter from "./health";
import userRouter from "./user";
import expensesRouter from "./expenses";
import adminRouter from "./admin";
import subscriptionRouter from "./subscription";
import cmsRouter from "./cms";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cmsRouter);      // public: /categories, /pricing-plans, /settings
router.use(userRouter);
router.use(expensesRouter);
router.use(adminRouter);
router.use(subscriptionRouter);
router.use(paymentsRouter);

export default router;
