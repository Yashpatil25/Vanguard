import { prisma } from "./lib/prisma.js";
import { evaluateAndPersistPayment } from "./services/payment-evaluation.js";

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    throw new Error("No user found in database");
  }

  const agentA = await prisma.agent.create({
    data: {
      userId: user.id,
      name: "Intent Security Test Agent A",
      status: "ACTIVE",
      dailyLimit: 100_000,
      perTransactionLimit: 100_000,
      riskThreshold: 70,
    },
  });

  const agentB = await prisma.agent.create({
    data: {
      userId: user.id,
      name: "Intent Security Test Agent B",
      status: "ACTIVE",
      dailyLimit: 100_000,
      perTransactionLimit: 100_000,
      riskThreshold: 70,
    },
  });

  const intentA = await prisma.intentPassport.create({
    data: {
      agentId: agentA.id,
      originalRequest: "Buy headphones",
      purpose: "Buy headphones",
      category: "electronics",
      maxAmount: 5_000,
      currency: "INR",
      recurringAllowed: false,
      maxTransactions: 1,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  const intentB = await prisma.intentPassport.create({
    data: {
      agentId: agentB.id,
      originalRequest: "Buy headphones",
      purpose: "Buy headphones",
      category: "electronics",
      maxAmount: 5_000,
      currency: "INR",
      recurringAllowed: false,
      maxTransactions: 1,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  try {
    /*
     * ------------------------------------------------
     * TEST 1 — UNKNOWN INTENT ID
     * ------------------------------------------------
     */

    try {
      await evaluateAndPersistPayment(
        {
          agentId: agentA.id,
          intentId: "attacker-controlled-intent",
          merchantId: "security-test",
          merchantName: "Security Test Merchant",
          amount: 1_000,
          currency: "INR",
        },
        {
          dailyLimit: agentA.dailyLimit,
          perTransactionLimit: agentA.perTransactionLimit,
          riskThreshold: agentA.riskThreshold,
          amountSpentToday: 0,
          previousMerchants: [],
          recentTransactions: [],
        },
        {
          maxAmount: 999_999,
          currency: "INR",
          purpose: "attacker override",
          recurringAllowed: true,
          maxTransactions: 99,
          transactionsUsed: 0,
          expiresAt: new Date(Date.now() + 3600000),
        }
      );

      throw new Error("Unknown intent ID was accepted");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "Intent Passport not found"
      ) {
        throw error;
      }
    }

    console.log("✅ Unknown Intent Passport is rejected");

    /*
     * ------------------------------------------------
     * TEST 2 — CROSS-AGENT INTENT
     * ------------------------------------------------
     */

    try {
      await evaluateAndPersistPayment(
        {
          agentId: agentA.id,
          intentId: intentB.id,
          merchantId: "security-test",
          merchantName: "Security Test Merchant",
          amount: 1_000,
          currency: "INR",
        },
        {
          dailyLimit: agentA.dailyLimit,
          perTransactionLimit: agentA.perTransactionLimit,
          riskThreshold: agentA.riskThreshold,
          amountSpentToday: 0,
          previousMerchants: [],
          recentTransactions: [],
        },
        {
          maxAmount: 999_999,
          currency: "INR",
          purpose: "attacker override",
          recurringAllowed: true,
          maxTransactions: 99,
          transactionsUsed: 0,
          expiresAt: new Date(Date.now() + 3600000),
        }
      );

      throw new Error("Cross-agent Intent Passport was accepted");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !==
          "Intent Passport does not belong to this agent"
      ) {
        throw error;
      }
    }

    console.log("✅ Cross-agent Intent Passport is rejected");

    /*
     * ------------------------------------------------
     * TEST 3 — CLIENT CANNOT OVERRIDE PASSPORT
     * ------------------------------------------------
     */

    const result = await evaluateAndPersistPayment(
      {
        agentId: agentA.id,
        intentId: intentA.id,

        merchantId: "security-test",
        merchantName: "Security Test Merchant",

        // Database passport allows ₹5,000.
        // Client attempts ₹5,001.
        amount: 5_001,

        currency: "INR",

        // Database says recurring=false.
        // Client attempts recurring=true.
        recurring: true,

        // Database says "Buy headphones".
        // Client attempts to change purpose.
        purpose: "Buy laptop",
      },
      {
        dailyLimit: agentA.dailyLimit,
        perTransactionLimit: agentA.perTransactionLimit,
        riskThreshold: agentA.riskThreshold,
        amountSpentToday: 0,
        previousMerchants: [],
        recentTransactions: [],
      },

      // Attacker-controlled intent values.
      // These MUST be ignored by the backend.
      {
        maxAmount: 999_999,
        currency: "INR",
        purpose: "Buy laptop",
        category: "laptop",
        recurringAllowed: true,
        maxTransactions: 99,
        transactionsUsed: 0,
        expiresAt: new Date(Date.now() + 3600000),
      }
    );

    if (result.decision === "ALLOW") {
      throw new Error(
        "Client-supplied intent values bypassed the database Intent Passport"
      );
    }

    console.log(
      "✅ Client intent values cannot override database Intent Passport"
    );

    console.log("");
    console.log("====================================");
    console.log("VANGUARD INTENT PASSPORT TESTS PASSED");
    console.log("====================================");
  } finally {
    /*
     * Clean up everything created by this test.
     */

    const testPaymentIntents = await prisma.paymentIntent.findMany({
      where: {
        agentId: {
          in: [agentA.id, agentB.id],
        },
      },
      select: {
        id: true,
      },
    });

    for (const paymentIntent of testPaymentIntents) {
      await prisma.riskSignal.deleteMany({
        where: {
          paymentIntentId: paymentIntent.id,
        },
      });

      await prisma.riskAssessment.deleteMany({
        where: {
          paymentIntentId: paymentIntent.id,
        },
      });

      await prisma.paymentIntent.delete({
        where: {
          id: paymentIntent.id,
        },
      });
    }

    await prisma.intentPassport.delete({
      where: {
        id: intentA.id,
      },
    });

    await prisma.intentPassport.delete({
      where: {
        id: intentB.id,
      },
    });

    await prisma.agent.delete({
      where: {
        id: agentA.id,
      },
    });

    await prisma.agent.delete({
      where: {
        id: agentB.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error("❌ INTENT PASSPORT SECURITY TEST FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });