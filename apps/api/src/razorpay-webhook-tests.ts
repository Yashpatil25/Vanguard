import crypto from "node:crypto";
import { prisma } from "./lib/prisma.js";
import { processRazorpayWebhook } from "./services/razorpay-webhook.js";

const WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET ||
  "vanguard-webhook-test-secret";

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
}

function assert(
  condition: boolean,
  message: string
): void {
  if (!condition) {
    throw new Error(`❌ ${message}`);
  }

  console.log(`✅ ${message}`);
}

async function assertThrows(
  name: string,
  fn: () => Promise<unknown>,
  expectedMessage: string
): Promise<void> {
  try {
    await fn();
    throw new Error(
      `❌ ${name}: expected an error but none was thrown`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (!message.includes(expectedMessage)) {
      throw new Error(
        `❌ ${name}: expected "${expectedMessage}", got "${message}"`
      );
    }

    console.log(`✅ ${name}`);
  }
}

async function main() {
  /*
   * ----------------------------------------------------
   * TEST FIXTURES
   * ----------------------------------------------------
   */

  const user = await prisma.user.create({
    data: {
      email: `webhook-test-${Date.now()}@vanguard.test`,
      name: "Webhook Security Test",
    },
  });

  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: "Webhook Test Agent",
      status: "ACTIVE",
      dailyLimit: 1000000,
      perTransactionLimit: 100000,
    },
  });

  const intent = await prisma.intentPassport.create({
    data: {
      agentId: agent.id,
      purpose: "purchase",
      category: "electronics",
      maxAmount: 100000,
      currency: "INR",
      recurringAllowed: false,
      maxTransactions: 1,
      expiresAt: new Date(
        Date.now() + 60 * 60 * 1000
      ),
      originalRequest: "Purchase electronics up to ₹1000",
    },
  });

  /*
   * Create the transaction that represents the
   * Razorpay order previously created by Vanguard.
   */
  const paymentIntent =
    await prisma.paymentIntent.create({
      data: {
        agentId: agent.id,
        intentId: intent.id,
        merchantName: "Webhook Test Merchant",
        amount: 100000,
        currency: "INR",
        status: "APPROVED",
        decision: "ALLOW",
      },
    });

  const transaction =
    await prisma.transaction.create({
      data: {
        paymentIntentId: paymentIntent.id,
        amount: 100000,
        currency: "INR",
        status: "PAYMENT_PENDING",
        provider: "RAZORPAY",
        providerOrderId: `order_webhook_test_${Date.now()}`,
      },
    });

  const orderId = transaction.providerOrderId!;

  /*
   * ----------------------------------------------------
   * BASE payment.captured PAYLOAD
   * ----------------------------------------------------
   */

  function createPayload(overrides: {
    paymentId?: string;
    amount?: number;
    currency?: string;
    orderId?: string;
  } = {}) {
    return JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id:
              overrides.paymentId ||
              "pay_webhook_test_001",
            order_id:
              overrides.orderId || orderId,
            amount:
              overrides.amount !== undefined
                ? overrides.amount
                : 100000,
            currency:
              overrides.currency || "INR",
          },
        },
      },
    });
  }

  /*
   * ----------------------------------------------------
   * TEST 1 — VALID SIGNATURE
   * ----------------------------------------------------
   */

  const validPayload = createPayload({
    paymentId: "pay_webhook_valid_001",
  });

  const validSignature =
    signPayload(validPayload);

  const validEventId =
    `evt_valid_${Date.now()}`;

  const validResult =
    await processRazorpayWebhook({
      rawBody: Buffer.from(validPayload),
      signature: validSignature,
      eventId: validEventId,
    });

  assert(
    validResult.alreadyProcessed === false,
    "Valid webhook signature is accepted"
  );

  /*
   * Confirm that the transaction was actually captured.
   */

  const capturedTransaction =
    await prisma.transaction.findUnique({
      where: {
        id: transaction.id,
      },
    });

  assert(
    capturedTransaction?.status === "CAPTURED",
    "Valid payment.captured updates transaction to CAPTURED"
  );

  assert(
    capturedTransaction?.providerPaymentId ===
      "pay_webhook_valid_001",
    "Valid payment.captured stores Razorpay payment ID"
  );

  /*
   * ----------------------------------------------------
   * TEST 2 — INVALID SIGNATURE
   * ----------------------------------------------------
   */

  const invalidSignaturePayload =
    createPayload({
      paymentId: "pay_webhook_invalid_sig",
    });

  await assertThrows(
    "Invalid webhook signature is rejected",
    () =>
      processRazorpayWebhook({
        rawBody: Buffer.from(
          invalidSignaturePayload
        ),
        signature: "invalid-signature",
        eventId: `evt_invalid_sig_${Date.now()}`,
      }),
    "Invalid Razorpay webhook signature"
  );

  /*
   * ----------------------------------------------------
   * TEST 3 — AMOUNT MISMATCH
   * ----------------------------------------------------
   */

  const amountMismatchPayload =
    createPayload({
      paymentId: "pay_webhook_amount_mismatch",
      amount: 999999,
    });

  await assertThrows(
    "Webhook amount mismatch is rejected",
    () =>
      processRazorpayWebhook({
        rawBody: Buffer.from(
          amountMismatchPayload
        ),
        signature: signPayload(
          amountMismatchPayload
        ),
        eventId: `evt_amount_${Date.now()}`,
      }),
    "Webhook payment amount does not match Vanguard transaction"
  );

  /*
   * ----------------------------------------------------
   * TEST 4 — CURRENCY MISMATCH
   * ----------------------------------------------------
   */

  const currencyMismatchPayload =
    createPayload({
      paymentId: "pay_webhook_currency_mismatch",
      currency: "USD",
    });

  await assertThrows(
    "Webhook currency mismatch is rejected",
    () =>
      processRazorpayWebhook({
        rawBody: Buffer.from(
          currencyMismatchPayload
        ),
        signature: signPayload(
          currencyMismatchPayload
        ),
        eventId: `evt_currency_${Date.now()}`,
      }),
    "Webhook payment currency does not match Vanguard transaction"
  );

  /*
   * ----------------------------------------------------
   * TEST 5 — WRONG RAZORPAY ORDER
   * ----------------------------------------------------
   */

  const wrongOrderPayload =
    createPayload({
      paymentId: "pay_webhook_wrong_order",
      orderId: "order_wrong_vanguard_order",
    });

  await assertThrows(
    "Wrong Razorpay order is rejected",
    () =>
      processRazorpayWebhook({
        rawBody: Buffer.from(
          wrongOrderPayload
        ),
        signature: signPayload(
          wrongOrderPayload
        ),
        eventId: `evt_wrong_order_${Date.now()}`,
      }),
    "Razorpay transaction not found"
  );

  /*
   * ----------------------------------------------------
   * TEST 6 — EVENT ID REPLAY
   * ----------------------------------------------------
   *
   * Send the exact same event again.
   */

  const replayPayload = createPayload({
    paymentId: "pay_webhook_valid_001",
  });

  const replaySignature =
    signPayload(replayPayload);

  const replayEventId =
    `evt_replay_${Date.now()}`;

  /*
   * First delivery.
   *
   * The transaction is already CAPTURED from Test 1,
   * so this also tests idempotent payment handling.
   */

  const firstReplayResult =
    await processRazorpayWebhook({
      rawBody: Buffer.from(replayPayload),
      signature: replaySignature,
      eventId: replayEventId,
    });

  assert(
    firstReplayResult.alreadyProcessed === true,
    "Already captured payment is handled idempotently"
  );

  /*
   * Second delivery with the exact same event ID.
   */

  const secondReplayResult =
    await processRazorpayWebhook({
      rawBody: Buffer.from(replayPayload),
      signature: replaySignature,
      eventId: replayEventId,
    });

  assert(
    secondReplayResult.alreadyProcessed === true,
    "Duplicate webhook event ID is not processed twice"
  );

  const webhookEventCount =
    await prisma.razorpayWebhookEvent.count({
      where: {
        eventId: replayEventId,
      },
    });

  assert(
    webhookEventCount === 1,
    "Webhook replay creates only one event record"
  );

  /*
   * ----------------------------------------------------
   * CLEANUP
   * ----------------------------------------------------
   */

  await prisma.auditLog.deleteMany({
    where: {
      agentId: agent.id,
    },
  });

  await prisma.razorpayWebhookEvent.deleteMany({
    where: {
      eventId: {
        startsWith: "evt_",
      },
    },
  });

  await prisma.transaction.delete({
    where: {
      id: transaction.id,
    },
  });

  await prisma.paymentIntent.delete({
    where: {
      id: paymentIntent.id,
    },
  });

await prisma.intentPassport.delete({
  where: {
    id: intent.id,
  },
});

  await prisma.agent.delete({
    where: {
      id: agent.id,
    },
  });

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });

  console.log("");
  console.log("====================================");
  console.log("VANGUARD WEBHOOK SECURITY TESTS PASSED");
  console.log("====================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });