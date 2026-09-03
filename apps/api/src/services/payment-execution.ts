import { prisma } from "../lib/prisma.js";
import { createRazorpayOrder } from "./razorpay.js";

export async function executePayment(paymentIntentId: string) {
  const paymentIntent = await prisma.paymentIntent.findUnique({
    where: {
      id: paymentIntentId,
    },
    include: {
      riskAssessment: true,
      riskSignals: true,
      transaction: true,
      agent: true,
    },
  });
  if (!paymentIntent) {
  throw new Error("Payment intent not found");
}

    if (
    paymentIntent.agent.status === "QUARANTINED" ||
    paymentIntent.agent.status === "PAUSED"
  ) {
    throw new Error(
      `Payment blocked because agent is ${paymentIntent.agent.status}`
    );
  }

  // Vanguard is the execution gate.
  // A payment can only execute after Vanguard allows it.
  if (paymentIntent.decision !== "ALLOW") {
    if (paymentIntent.decision === "REVIEW") {
      throw new Error(
        "Payment requires human approval before execution"
      );
    }

    throw new Error(
      "Payment blocked by Vanguard risk policy"
    );
  }

  if (paymentIntent.status !== "APPROVED") {
    throw new Error(
      `Payment cannot be executed from status ${paymentIntent.status}`
    );
  }

  // Prevent duplicate execution.
  if (paymentIntent.transaction) {
    throw new Error(
      "Payment has already been submitted for execution"
    );
  }

let transaction;

if (process.env.PAYMENT_PROVIDER === "RAZORPAY") {
  const order = await createRazorpayOrder({
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    receipt: `vanguard_${paymentIntent.id}`,
    notes: {
      paymentIntentId: paymentIntent.id,
      agentId: paymentIntent.agentId,
      merchantName: paymentIntent.merchantName ?? "unknown",
    },
  });

  transaction = await prisma.transaction.create({
    data: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "PAYMENT_PENDING",
      provider: "RAZORPAY",
      providerOrderId: order.id,
    },
  });
} else {
  transaction = await prisma.transaction.create({
    data: {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "CAPTURED",
      provider: "SIMULATOR",
      providerOrderId: `sim_order_${Date.now()}`,
      providerPaymentId: `sim_payment_${Date.now()}`,
    },
  });
}
  await prisma.auditLog.create({
    data: {
      agentId: paymentIntent.agentId,

      actorType: "SYSTEM",
      actorId: "vanguard-execution-engine",

      action: "PAYMENT_EXECUTED",

      resourceType: "PaymentIntent",
      resourceId: paymentIntent.id,

      previousState: JSON.stringify({
        status: paymentIntent.status,
        decision: paymentIntent.decision,
      }),

      newState: JSON.stringify({
        status: paymentIntent.status,
        decision: paymentIntent.decision,
        transactionId: transaction.id,
      }),

      metadata: JSON.stringify({
  provider: transaction.provider,
  transactionId: transaction.id,
  amount: transaction.amount,
  currency: transaction.currency,
  riskScore:
    paymentIntent.riskAssessment?.totalScore ?? 0,
  riskLevel:
    paymentIntent.riskAssessment?.riskLevel ?? null,
  signalCount: paymentIntent.riskSignals.length,
}),
    },
  });

  return {
    success: true,
    paymentIntentId: paymentIntent.id,
    transactionId: transaction.id,
    provider: transaction.provider,
    providerOrderId: transaction.providerOrderId,
    providerPaymentId: transaction.providerPaymentId,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
  };
}