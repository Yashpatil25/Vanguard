import { prisma } from "../lib/prisma.js";

export async function approvePayment(
  paymentIntentId: string,
  actorId: string
) {
  const paymentIntent = await prisma.paymentIntent.findUnique({
    where: {
      id: paymentIntentId,
    },
  });

  if (!paymentIntent) {
    throw new Error("Payment intent not found");
  }

  if (paymentIntent.status !== "REVIEW") {
    throw new Error(
      `Payment cannot be approved from status ${paymentIntent.status}`
    );
  }

  const updatedPayment = await prisma.paymentIntent.update({
    where: {
      id: paymentIntentId,
    },
    data: {
      status: "APPROVED",
      decision: "ALLOW",
      decisionReason: "Approved by authorized reviewer",
    },
  });

  await prisma.auditLog.create({
    data: {
      agentId: paymentIntent.agentId,
      actorType: "HUMAN",
      actorId,

      action: "PAYMENT_APPROVED",
      resourceType: "PaymentIntent",
      resourceId: paymentIntent.id,

      previousState: JSON.stringify({
        status: paymentIntent.status,
        decision: paymentIntent.decision,
      }),

      newState: JSON.stringify({
        status: updatedPayment.status,
        decision: updatedPayment.decision,
      }),

      metadata: JSON.stringify({
        source: "approval-api",
      }),
    },
  });

  return updatedPayment;
}

export async function rejectPayment(
  paymentIntentId: string,
  actorId: string
) {
  const paymentIntent = await prisma.paymentIntent.findUnique({
    where: {
      id: paymentIntentId,
    },
  });

  if (!paymentIntent) {
    throw new Error("Payment intent not found");
  }

  if (paymentIntent.status !== "REVIEW") {
    throw new Error(
      `Payment cannot be rejected from status ${paymentIntent.status}`
    );
  }

  const updatedPayment = await prisma.paymentIntent.update({
    where: {
      id: paymentIntentId,
    },
    data: {
      status: "BLOCKED",
      decision: "BLOCK",
      decisionReason: "Rejected by authorized reviewer",
    },
  });

  await prisma.auditLog.create({
    data: {
      agentId: paymentIntent.agentId,
      actorType: "HUMAN",
      actorId,

      action: "PAYMENT_REJECTED",
      resourceType: "PaymentIntent",
      resourceId: paymentIntent.id,

      previousState: JSON.stringify({
        status: paymentIntent.status,
        decision: paymentIntent.decision,
      }),

      newState: JSON.stringify({
        status: updatedPayment.status,
        decision: updatedPayment.decision,
      }),

      metadata: JSON.stringify({
        source: "approval-api",
      }),
    },
  });

  return updatedPayment;
}