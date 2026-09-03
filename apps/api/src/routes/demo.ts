import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/bootstrap", async (_req: Request, res: Response) => {
  try {
    const agent = await prisma.agent.findFirst({
      where: {
        status: {
          in: ["ACTIVE", "PAUSED", "QUARANTINED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        intents: {
          where: {
            status: "ACTIVE",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "No demo agent found",
      });
    }

    const intent = agent.intents[0];

    if (!intent) {
      return res.status(404).json({
        success: false,
        error: "No active demo Intent Passport found",
      });
    }

    return res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          dailyLimit: agent.dailyLimit,
          perTransactionLimit: agent.perTransactionLimit,
          riskThreshold: agent.riskThreshold,
        },
        intent: {
          id: intent.id,
          purpose: intent.purpose,
          category: intent.category,
          maxAmount: intent.maxAmount,
          currency: intent.currency,
          recurringAllowed: intent.recurringAllowed,
          maxTransactions: intent.maxTransactions,
          expiresAt: intent.expiresAt,
        },
      },
    });
  } catch (error) {
    console.error("Demo bootstrap failed:", error);

    return res.status(500).json({
      success: false,
      error: "Demo bootstrap failed",
    });
  }
});

export default router;
