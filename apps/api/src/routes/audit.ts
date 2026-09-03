import { Router } from "express";
import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return res.json({
      success: true,
      data: auditLogs,
    });
  } catch (error) {
    console.error("Audit log retrieval failed:", error);

    return res.status(500).json({
      success: false,
      error: "Audit log retrieval failed",
    });
  }
});

export default router;