import crypto from "node:crypto";
import { prisma } from "./lib/prisma.js";
import { verifyRazorpayPayment } from "./services/razorpay-verification.js";

async function assertThrows(
  name: string,
  fn: () => Promise<unknown>,
  expectedMessage: string
) {
  try {
    await fn();

    throw new Error(
      `❌ ${name} did not throw`
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== expectedMessage
    ) {
      throw new Error(
        `❌ ${name} threw unexpected error: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }

    console.log(`✅ ${name}`);
  }
}

async function main() {
  const originalSecret =
    process.env.RAZORPAY_KEY_SECRET;

  const testSecret =
    "vanguard-test-secret";

  process.env.RAZORPAY_KEY_SECRET = testSecret;

  let agentId: string | undefined;
  let intentId: string | undefined;
  let paymentIntentId: string | undefined;

  try {
    /*
     * ------------------------------------------------
     * TEST FIXTURES
     * ------------------------------------------------
     */

    const user = await prisma.user.create({
      data: {
        email: `razorpay-test-${Date.now()}@vanguard.local`,
        name: "Razorpay Verification Test",
      },
    });

    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: "Razorpay Verification Test Agent",
        dailyLimit: 100000,
        perTransactionLimit: 50000,
      },
    });

    agentId = agent.id;

    const intent = await prisma.intentPassport.create({
      data: {
        agentId: agent.id,
        purpose: "purchase",
        category: "test",
        maxAmount: 5000,
        currency: "INR",
        recurringAllowed: false,
        maxTransactions: 1,
        originalRequest: "Purchase test item for Razorpay verification security test",
        expiresAt: new Date(
          Date.now() + 30 * 60 * 1000
        ),
      },
    });

    intentId = intent.id;

    const paymentIntent =
      await prisma.paymentIntent.create({
        data: {
          agentId: agent.id,
          intentId: intent.id,
          merchantName: "Razorpay Verification Test",
          amount: 1000,
          currency: "INR",
          status: "APPROVED",
          decision: "ALLOW",
        },
      });

    paymentIntentId = paymentIntent.id;

    const transaction = await prisma.transaction.create({
      data: {
        paymentIntentId: paymentIntent.id,
        amount: 1000,
        currency: "INR",
        status: "PAYMENT_PENDING",
        provider: "RAZORPAY",
        providerOrderId: "order_vanguard_test_001",
      },
    });

    /*
     * ------------------------------------------------
     * VALID SIGNATURE
     * ------------------------------------------------
     */

    const razorpayPaymentId =
      "pay_vanguard_test_001";

    const validSignature = crypto
      .createHmac("sha256", testSecret)
      .update(
        `${transaction.providerOrderId}|${razorpayPaymentId}`
      )
      .digest("hex");

    const verified =
      await verifyRazorpayPayment({
        paymentIntentId: paymentIntent.id,
        razorpayOrderId:
          transaction.providerOrderId!,
        razorpayPaymentId,
        razorpaySignature: validSignature,
      });

    if (
      !verified.success ||
      verified.alreadyVerified ||
      verified.status !== "CAPTURED"
    ) {
      throw new Error(
        "❌ Valid Razorpay signature was not accepted"
      );
    }

    const capturedTransaction =
      await prisma.transaction.findUnique({
        where: {
          id: transaction.id,
        },
      });

    if (
      !capturedTransaction ||
      capturedTransaction.status !== "CAPTURED" ||
      capturedTransaction.providerPaymentId !==
        razorpayPaymentId
    ) {
      throw new Error(
        "❌ Valid verification did not capture the transaction correctly"
      );
    }

    console.log(
      "✅ Valid Razorpay signature verified and transaction captured"
    );

    /*
     * ------------------------------------------------
     * REPLAY / IDEMPOTENCY
     * ------------------------------------------------
     */

    const replay =
      await verifyRazorpayPayment({
        paymentIntentId: paymentIntent.id,
        razorpayOrderId:
          transaction.providerOrderId!,
        razorpayPaymentId,
        razorpaySignature: validSignature,
      });

    if (
      !replay.success ||
      !replay.alreadyVerified ||
      replay.status !== "CAPTURED"
    ) {
      throw new Error(
        "❌ Razorpay verification replay was not handled idempotently"
      );
    }

    console.log(
      "✅ Razorpay verification replay is idempotent"
    );

    /*
     * ------------------------------------------------
     * INVALID SIGNATURE
     * ------------------------------------------------
     *
     * Create a second transaction fixture so
     * verification is attempted while still pending.
     */

    const invalidPaymentIntent =
      await prisma.paymentIntent.create({
        data: {
          agentId: agent.id,
          intentId: intent.id,
          merchantName:
            "Razorpay Invalid Signature Test",
          amount: 1500,
          currency: "INR",
          status: "APPROVED",
          decision: "ALLOW",
        },
      });

    const invalidTransaction =
      await prisma.transaction.create({
        data: {
          paymentIntentId: invalidPaymentIntent.id,
          amount: 1500,
          currency: "INR",
          status: "PAYMENT_PENDING",
          provider: "RAZORPAY",
          providerOrderId:
            "order_vanguard_test_invalid",
        },
      });

    await assertThrows(
      "Invalid Razorpay signature is rejected",
      () =>
        verifyRazorpayPayment({
          paymentIntentId:
            invalidPaymentIntent.id,
          razorpayOrderId:
            invalidTransaction.providerOrderId!,
          razorpayPaymentId:
            "pay_vanguard_invalid",
          razorpaySignature: "invalid-signature",
        }),
      "Invalid Razorpay payment signature"
    );

    const invalidTransactionAfter =
      await prisma.transaction.findUnique({
        where: {
          id: invalidTransaction.id,
        },
      });

    if (
      !invalidTransactionAfter ||
      invalidTransactionAfter.status !==
        "PAYMENT_PENDING"
    ) {
      throw new Error(
        "❌ Invalid signature changed transaction status"
      );
    }

    console.log(
      "✅ Invalid signature did not capture transaction"
    );

    /*
     * ------------------------------------------------
     * WRONG ORDER ID
     * ------------------------------------------------
     */

    const wrongOrderPaymentId =
      "pay_vanguard_wrong_order";

    const wrongOrderSignature = crypto
      .createHmac("sha256", testSecret)
      .update(
        `order_vanguard_wrong|${wrongOrderPaymentId}`
      )
      .digest("hex");

    await assertThrows(
      "Mismatched Razorpay order ID is rejected",
      () =>
        verifyRazorpayPayment({
          paymentIntentId: paymentIntent.id,
          razorpayOrderId:
            "order_vanguard_wrong",
          razorpayPaymentId:
            wrongOrderPaymentId,
          razorpaySignature:
            wrongOrderSignature,
        }),
      "Razorpay order ID does not match Vanguard transaction"
    );

    console.log(
      "✅ Mismatched order ID cannot verify payment"
    );

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "VANGUARD RAZORPAY VERIFICATION TESTS PASSED"
    );
    console.log(
      "===================================="
    );
    } finally {
    if (agentId) {
      // Transactions must be deleted before their
      // referenced PaymentIntents.
      await prisma.transaction.deleteMany({
        where: {
          paymentIntent: {
            agentId,
          },
        },
      });
    }

    if (paymentIntentId) {
      await prisma.paymentIntent.deleteMany({
        where: {
          id: paymentIntentId,
        },
      });
    }

    if (agentId) {
      await prisma.paymentIntent.deleteMany({
        where: {
          agentId,
        },
      });

      await prisma.intentPassport.deleteMany({
        where: {
          agentId,
        },
      });

      await prisma.agentEvent.deleteMany({
        where: {
          agentId,
        },
      });

      await prisma.auditLog.deleteMany({
        where: {
          agentId,
        },
      });

      await prisma.agent.delete({
        where: {
          id: agentId,
        },
      });
    }

    if (originalSecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET =
        originalSecret;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });