import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

import {
  approvePayment,
  rejectPayment,
} from "../services/payment-approval.js";
import { verifyRazorpayPayment } from "../services/razorpay-verification.js";

import { executePayment } from "../services/payment-execution.js";

import { requireReviewer } from "../middleware/auth.js";
import { evaluateAndPersistPayment } from "../services/payment-evaluation.js";

import type {
  AgentContext,
  IntentContext,
  PaymentRequest,
} from "@vanguard/risk-engine";

const router = Router();

router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    console.log(
  "VANGUARD EVALUATE REQUEST:",
  JSON.stringify(req.body, null, 2)
);
    const {
      payment,
      agent,
      intent,
    }: {
      payment: PaymentRequest;
      agent: AgentContext;
      intent: IntentContext;
    } = req.body;

    if (!payment || !agent || !intent) {
      return res.status(400).json({
        error: "payment, agent and intent are required",
      });
    }

    const result = await evaluateAndPersistPayment(
      payment,
      agent,
      {
        ...intent,
        expiresAt: new Date(intent.expiresAt),
      }
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Payment evaluation failed:", error);

    return res.status(500).json({
      success: false,
      error: "Payment evaluation failed",
    });
  }
});
router.post(
  "/:id/execute",
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.params.id;

      if (typeof paymentIntentId !== "string") {
        return res.status(400).json({
          success: false,
          error: "Invalid payment intent ID",
        });
      }

      const transaction = await executePayment(
        paymentIntentId
      );

      return res.json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error("Payment execution failed:", error);

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment execution failed",
      });
    }
  }
);
router.get("/review", async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.paymentIntent.findMany({
      where: {
        status: "REVIEW",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        riskAssessment: true,
        riskSignals: true,
        intent: true,
      },
    });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Review queue retrieval failed:", error);

    return res.status(500).json({
      success: false,
      error: "Review queue retrieval failed",
    });
  }
});
router.post(
  "/:id/verify-razorpay",
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.params.id;

      if (typeof paymentIntentId !== "string") {
        return res.status(400).json({
          success: false,
          error: "Invalid payment intent ID",
        });
      }

      const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      } = req.body;

      if (
        typeof razorpayOrderId !== "string" ||
        typeof razorpayPaymentId !== "string" ||
        typeof razorpaySignature !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "razorpayOrderId, razorpayPaymentId and razorpaySignature are required",
        });
      }

      const result = await verifyRazorpayPayment({
        paymentIntentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Razorpay payment verification failed:",
        error
      );

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Razorpay payment verification failed",
      });
    }
  }
);

router.post(
  "/:id/approve",
  requireReviewer,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.params.id;

      if (typeof paymentIntentId !== "string") {
        return res.status(400).json({
          success: false,
          error: "Invalid payment intent ID",
        });
      }

      const user = res.locals.user;

      const payment = await approvePayment(
        paymentIntentId,
        user.id
      );

      return res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Payment approval failed:", error);

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment approval failed",
      });
    }
  }
);

router.post(
  "/:id/reject",
  requireReviewer,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.params.id;

      if (typeof paymentIntentId !== "string") {
        return res.status(400).json({
          success: false,
          error: "Invalid payment intent ID",
        });
      }

      const user = res.locals.user;

      const payment = await rejectPayment(
        paymentIntentId,
        user.id
      );

      return res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Payment rejection failed:", error);

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment rejection failed",
      });
    }
  }
);
router.get("/", async (_req: Request, res: Response) => {
  try {
    const payments = await prisma.paymentIntent.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        riskAssessment: true,
        riskSignals: true,
      },
    });

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Payment listing failed:", error);

    return res.status(500).json({
      success: false,
      error: "Payment listing failed",
    });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const paymentIntentId = req.params.id;

    if (typeof paymentIntentId !== "string") {
      return res.status(400).json({
        success: false,
        error: "Invalid payment intent ID",
      });
    }

    const payment = await prisma.paymentIntent.findUnique({
      where: {
        id: paymentIntentId,
      },
      include: {
        riskAssessment: true,
        riskSignals: true,
        transaction: true,
        intent: true,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment intent not found",
      });
    }

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Payment retrieval failed:", error);

    return res.status(500).json({
      success: false,
      error: "Payment retrieval failed",
    });
  }
});

export default router;