import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simsRouter from "./sims";

const router: IRouter = Router();

router.use(healthRouter);
router.use(simsRouter);

export default router;
