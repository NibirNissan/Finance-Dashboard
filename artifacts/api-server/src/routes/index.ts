import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import expensesRouter from "./expenses";
import adminRouter from "./admin";
import subscriptionRouter from "./subscription";
import cmsRouter from "./cms";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cmsRouter);      // public: /categories, /pricing-plans, /settings
router.use(authRouter);
router.use(userRouter);
router.use(expensesRouter);
router.use(adminRouter);
router.use(subscriptionRouter);

export default router;
