import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

export async function verifyRazorpayPayment(params: {
  paymentIntentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const {
    paymentIntentId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = params;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured");
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      paymentIntentId,
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  if (transaction.provider !== "RAZORPAY") {
    throw new Error("Transaction is not a Razorpay transaction");
  }

  if (transaction.providerOrderId !== razorpayOrderId) {
    throw new Error("Razorpay order ID does not match Vanguard transaction");
  }

  if (transaction.status === "CAPTURED") {
    return {
      success: true,
      alreadyVerified: true,
      transactionId: transaction.id,
      status: transaction.status,
    };
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const generatedSignatureBuffer = Buffer.from(
  generatedSignature,
  "utf8"
);

const providedSignatureBuffer = Buffer.from(
  razorpaySignature,
  "utf8"
);

const signaturesMatch =
  generatedSignatureBuffer.length ===
    providedSignatureBuffer.length &&
  crypto.timingSafeEqual(
    generatedSignatureBuffer,
    providedSignatureBuffer
  );

  if (!signaturesMatch) {
    await prisma.auditLog.create({
      data: {
        agentId: (
          await prisma.paymentIntent.findUniqueOrThrow({
            where: { id: paymentIntentId },
            select: { agentId: true },
          })
        ).agentId,

        actorType: "SYSTEM",
        actorId: "razorpay-verification",

        action: "PAYMENT_VERIFICATION_FAILED",

        resourceType: "PaymentIntent",
        resourceId: paymentIntentId,

        previousState: JSON.stringify({
          transactionStatus: transaction.status,
        }),

        newState: JSON.stringify({
          transactionStatus: transaction.status,
        }),

        metadata: JSON.stringify({
          provider: "RAZORPAY",
          razorpayOrderId,
          razorpayPaymentId,
          reason: "Invalid Razorpay signature",
        }),
      },
    });

    throw new Error("Invalid Razorpay payment signature");
  }

  const updatedTransaction = await prisma.transaction.update({
    where: {
      id: transaction.id,
    },
    data: {
      status: "CAPTURED",
      providerPaymentId: razorpayPaymentId,
    },
  });

  const paymentIntent = await prisma.paymentIntent.findUniqueOrThrow({
    where: {
      id: paymentIntentId,
    },
  });

  await prisma.auditLog.create({
    data: {
      agentId: paymentIntent.agentId,

      actorType: "SYSTEM",
      actorId: "razorpay-verification",

      action: "PAYMENT_VERIFIED",

      resourceType: "PaymentIntent",
      resourceId: paymentIntent.id,

      previousState: JSON.stringify({
        transactionStatus: transaction.status,
      }),

      newState: JSON.stringify({
        transactionStatus: updatedTransaction.status,
        providerPaymentId: updatedTransaction.providerPaymentId,
      }),

      metadata: JSON.stringify({
        provider: "RAZORPAY",
        razorpayOrderId,
        razorpayPaymentId,
      }),
    },
  });

  return {
    success: true,
    alreadyVerified: false,
    transactionId: updatedTransaction.id,
    paymentIntentId,
    provider: updatedTransaction.provider,
    providerOrderId: updatedTransaction.providerOrderId,
    providerPaymentId: updatedTransaction.providerPaymentId,
    amount: updatedTransaction.amount,
    currency: updatedTransaction.currency,
    status: updatedTransaction.status,
  };
}