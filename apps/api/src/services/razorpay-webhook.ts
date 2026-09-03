import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

export async function processRazorpayWebhook(params: {
  rawBody: Buffer;
  signature: string;
  eventId: string;
}) {
  const { rawBody, signature, eventId } = params;

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is not configured"
    );
  }

  if (!Buffer.isBuffer(rawBody)) {
    throw new Error("Webhook body must be raw");
  }

  /*
   * Razorpay signs the RAW request body.
   * Do not JSON.parse() before this verification.
   */
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedSignatureBuffer = Buffer.from(
    expectedSignature,
    "utf8"
  );

  const providedSignatureBuffer = Buffer.from(
    signature,
    "utf8"
  );

  const signaturesMatch =
    expectedSignatureBuffer.length ===
      providedSignatureBuffer.length &&
    crypto.timingSafeEqual(
      expectedSignatureBuffer,
      providedSignatureBuffer
    );

  if (!signaturesMatch) {
    throw new Error(
      "Invalid Razorpay webhook signature"
    );
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("Invalid JSON webhook payload");
  }

  const eventValue = payload.event;

  if (!eventValue) {
    throw new Error("Missing Razorpay webhook event");
  }

  const event = eventValue;

  /*
   * Replay protection:
   * Razorpay provides a unique event ID for each webhook event.
   */
  const existingEvent =
    await prisma.razorpayWebhookEvent.findUnique({
      where: {
        eventId,
      },
    });

  if (existingEvent) {
    return {
      message:
        "Razorpay webhook event already processed",
      eventId,
      alreadyProcessed: true,
    };
  }

  /*
   * Vanguard currently processes payment.captured.
   * Other valid Razorpay events are safely ignored and
   * recorded so that the same event is not processed again.
   */
  if (event !== "payment.captured") {
    await prisma.razorpayWebhookEvent.create({
      data: {
        eventId,
        event,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return {
      message: "Razorpay webhook event ignored",
      eventId,
      event,
      alreadyProcessed: false,
    };
  }

  const paymentEntity =
    payload.payload?.payment?.entity;

  if (
    !paymentEntity?.id ||
    !paymentEntity.order_id ||
    typeof paymentEntity.amount !== "number" ||
    !paymentEntity.currency
  ) {
    throw new Error(
      "Invalid payment.captured payload"
    );
  }

  /*
   * Match the Razorpay order to a transaction
   * previously created by Vanguard.
   */
  const transaction =
    await prisma.transaction.findFirst({
      where: {
        provider: "RAZORPAY",
        providerOrderId: paymentEntity.order_id,
      },
    });

  if (!transaction) {
    throw new Error(
      "Razorpay transaction not found"
    );
  }

  /*
   * Never trust the webhook amount blindly.
   * It must match the amount Vanguard authorized.
   */
  if (transaction.amount !== paymentEntity.amount) {
    throw new Error(
      "Webhook payment amount does not match Vanguard transaction"
    );
  }

  /*
   * Currency must also match.
   */
  if (
    transaction.currency.toUpperCase() !==
    paymentEntity.currency.toUpperCase()
  ) {
    throw new Error(
      "Webhook payment currency does not match Vanguard transaction"
    );
  }

  /*
   * Prevent a different Razorpay payment from
   * being attached to an already-associated transaction.
   */
  if (
    transaction.providerPaymentId &&
    transaction.providerPaymentId !== paymentEntity.id
  ) {
    throw new Error(
      "Webhook payment ID conflicts with Vanguard transaction"
    );
  }

  /*
   * Idempotent handling of an already-captured payment.
   */
  if (transaction.status === "CAPTURED") {
    if (
      transaction.providerPaymentId ===
      paymentEntity.id
    ) {
      await prisma.razorpayWebhookEvent.create({
        data: {
          eventId,
          event,
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      return {
        message: "Razorpay payment already captured",
        eventId,
        event,
        alreadyProcessed: true,
        transactionId: transaction.id,
      };
    }

    throw new Error(
      "Transaction is already captured with a different payment ID"
    );
  }

  /*
   * Finalize the Vanguard transaction.
   */
  const updatedTransaction =
    await prisma.transaction.update({
      where: {
        id: transaction.id,
      },
      data: {
        status: "CAPTURED",
        providerPaymentId: paymentEntity.id,
      },
    });

  /*
   * Find the agent responsible for this payment
   * so the security audit trail remains connected
   * to the agent.
   */
  const paymentIntent =
    await prisma.paymentIntent.findUniqueOrThrow({
      where: {
        id: transaction.paymentIntentId,
      },
      select: {
        agentId: true,
      },
    });

  /*
   * Record the final payment capture in Vanguard's
   * security audit trail.
   */
  await prisma.auditLog.create({
    data: {
      agentId: paymentIntent.agentId,
      actorType: "SYSTEM",
      actorId: "razorpay-webhook",
      action: "PAYMENT_CAPTURED",
      resourceType: "Transaction",
      resourceId: transaction.id,
      previousState: JSON.stringify({
        status: transaction.status,
        providerPaymentId:
          transaction.providerPaymentId,
      }),
      newState: JSON.stringify({
        status: updatedTransaction.status,
        providerPaymentId:
          updatedTransaction.providerPaymentId,
      }),
      metadata: JSON.stringify({
        provider: "RAZORPAY",
        event: "payment.captured",
        eventId,
        razorpayOrderId:
          paymentEntity.order_id,
        razorpayPaymentId:
          paymentEntity.id,
        amount: paymentEntity.amount,
        currency: paymentEntity.currency,
      }),
    },
  });

  /*
   * Record the webhook event only after successful
   * payment processing.
   */
  await prisma.razorpayWebhookEvent.create({
    data: {
      eventId,
      event,
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  return {
    message: "Razorpay payment captured",
    eventId,
    event,
    alreadyProcessed: false,
    transactionId: updatedTransaction.id,
  };
}