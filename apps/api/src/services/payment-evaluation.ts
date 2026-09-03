import { prisma } from "../lib/prisma.js";
import {
  evaluatePayment,
  evaluateAgentRisk,
} from "@vanguard/risk-engine";

import type {
  AgentContext,
  IntentContext,
  PaymentRequest,
  DecisionResult,
} from "@vanguard/risk-engine";

export async function evaluateAndPersistPayment(
  payment: PaymentRequest,
  agent: AgentContext,
  intent: IntentContext
): Promise<DecisionResult & { paymentIntentId: string }> {
  const result = evaluatePayment(payment, agent, {
    ...intent,
    expiresAt: new Date(intent.expiresAt),
  });

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      agentId: payment.agentId,
      intentId: payment.intentId,

      ...(payment.merchantId !== undefined && {
        merchantId: payment.merchantId,
      }),

      ...(payment.merchantName !== undefined && {
        merchantName: payment.merchantName,
      }),

      amount: payment.amount,
      currency: payment.currency,

      ...(payment.category !== undefined && {
        category: payment.category,
      }),

      ...(payment.purpose !== undefined && {
        purpose: payment.purpose,
      }),

      recurring: payment.recurring ?? false,

      status:
        result.decision === "ALLOW"
          ? "APPROVED"
          : result.decision === "REVIEW"
            ? "REVIEW"
            : "BLOCKED",

      decision: result.decision,
      decisionReason: `Risk score: ${result.riskScore}`,
    },
  });

  await prisma.riskAssessment.create({
    data: {
      paymentIntentId: paymentIntent.id,

      totalScore: result.riskScore,
      riskLevel: result.riskLevel,

      reasons: JSON.stringify(
        result.signals.map(
          (signal) => signal.description
        )
      ),

      modelVersion: "rule-engine-v1",
    },
  });

  if (result.signals.length > 0) {
    await prisma.riskSignal.createMany({
      data: result.signals.map((signal) => ({
        paymentIntentId: paymentIntent.id,

        type: signal.type,
        severity: signal.severity,
        score: signal.score,

        description: signal.description,
      })),
    });
  }
    const recentPaymentIntents =
    await prisma.paymentIntent.findMany({
      where: {
        agentId: payment.agentId,
        decision: {
          not: null,
        },
        createdAt: {
          gte: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        riskAssessment: true,
      },
    });

  const agentRiskState = evaluateAgentRisk(
    recentPaymentIntents
      .filter(
        (
          paymentIntent
        ): paymentIntent is typeof paymentIntent & {
          decision: "ALLOW" | "REVIEW" | "BLOCK";
          riskAssessment: {
            totalScore: number;
          };
        } =>
          paymentIntent.decision !== null &&
          paymentIntent.riskAssessment !== null
      )
      .map((paymentIntent) => ({
        riskScore: paymentIntent.riskAssessment.totalScore,
        decision: paymentIntent.decision,
        createdAt: paymentIntent.createdAt,
      }))
  );

  const currentAgent = await prisma.agent.findUnique({
  where: {
    id: payment.agentId,
  },
  select: {
    status: true,
  },
});

const persistedAgentStatus =
  currentAgent?.status === "QUARANTINED"
    ? "QUARANTINED"
    : agentRiskState === "QUARANTINED"
      ? "QUARANTINED"
      : agentRiskState === "RESTRICTED"
        ? "PAUSED"
        : "ACTIVE";

  await prisma.agent.update({
    where: {
      id: payment.agentId,
    },
    data: {
      status: persistedAgentStatus,
    },
  });

  return {
    paymentIntentId: paymentIntent.id,
    ...result,
  };
}