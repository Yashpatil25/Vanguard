import { prisma } from "./lib/prisma.js";
import { executePayment } from "./services/payment-execution.js";
import { evaluateAndPersistPayment } from "./services/payment-evaluation.js";

async function assertThrows(
  name: string,
  paymentIntentId: string,
  expectedMessage: string
) {
  try {
    await executePayment(paymentIntentId);

    throw new Error(
      `❌ ${name}: execution unexpectedly succeeded`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (message !== expectedMessage) {
      throw new Error(
        `❌ ${name}: expected "${expectedMessage}", got "${message}"`
      );
    }

    console.log(`✅ ${name}`);
  }
}

async function main() {
  const testEmail =
    `vanguard-security-test-${Date.now()}@example.com`;

  /*
   * Test fixture:
   *
   * User
   *   ↓
   * Agent
   *   ↓
   * Intent Passport
   *   ↓
   * Payment Intent
   */

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Vanguard Security Test",
    },
  });

  const agent = await prisma.agent.create({
    data: {
      user: {
        connect: {
          id: user.id,
        },
      },
      name: "Vanguard Security Test Agent",
      dailyLimit: 1_000_000,
      perTransactionLimit: 500_000,
      riskThreshold: 70,
    },
  });

  const intent = await prisma.intentPassport.create({
    data: {
      agent: {
        connect: {
          id: agent.id,
        },
      },
      originalRequest: "Security execution gate test",
      purpose: "Test payment execution",
      category: "testing",
      maxAmount: 100_000,
      currency: "INR",
      recurringAllowed: false,
      maxTransactions: 1,
      expiresAt: new Date(
        Date.now() + 30 * 60 * 1000
      ),
    },
  });

  /*
   * ------------------------------------------------
   * BLOCK
   * ------------------------------------------------
   */

  const blocked = await prisma.paymentIntent.create({
    data: {
      agent: {
        connect: {
          id: agent.id,
        },
      },
      intent: {
        connect: {
          id: intent.id,
        },
      },
      merchantName: "Security Test Merchant",
      amount: 1000,
      currency: "INR",
      status: "BLOCKED",
      decision: "BLOCK",
    },
  });

  await assertThrows(
    "BLOCKED payment cannot execute",
    blocked.id,
    "Payment blocked by Vanguard risk policy"
  );

  const blockedTransaction =
    await prisma.transaction.findUnique({
      where: {
        paymentIntentId: blocked.id,
      },
    });

  if (blockedTransaction) {
    throw new Error(
      "❌ BLOCKED payment created a transaction"
    );
  }

  console.log(
    "✅ BLOCKED payment created no transaction"
  );

  /*
   * ------------------------------------------------
   * REVIEW
   * ------------------------------------------------
   */

  const review = await prisma.paymentIntent.create({
    data: {
      agent: {
        connect: {
          id: agent.id,
        },
      },
      intent: {
        connect: {
          id: intent.id,
        },
      },
      merchantName: "Security Test Merchant",
      amount: 1000,
      currency: "INR",
      status: "REVIEW",
      decision: "REVIEW",
    },
  });

  await assertThrows(
    "REVIEW payment cannot execute",
    review.id,
    "Payment requires human approval before execution"
  );

  const reviewTransaction =
    await prisma.transaction.findUnique({
      where: {
        paymentIntentId: review.id,
      },
    });

  if (reviewTransaction) {
    throw new Error(
      "❌ REVIEW payment created a transaction"
    );
  }

  console.log(
    "✅ REVIEW payment created no transaction"
  );

  /*
   * ------------------------------------------------
   * ALLOW + APPROVED
   *
   * Force simulator so this test can never create
   * a Razorpay order.
   * ------------------------------------------------
   */

  const previousProvider =
    process.env.PAYMENT_PROVIDER;

  process.env.PAYMENT_PROVIDER = "SIMULATOR";

  const allowed = await prisma.paymentIntent.create({
    data: {
      agent: {
        connect: {
          id: agent.id,
        },
      },
      intent: {
        connect: {
          id: intent.id,
        },
      },
      merchantName: "Security Test Merchant",
      amount: 1000,
      currency: "INR",
      status: "APPROVED",
      decision: "ALLOW",
    },
  });

  const result = await executePayment(allowed.id);

  if (!result.success) {
    throw new Error(
      "❌ ALLOW + APPROVED payment did not execute"
    );
  }

  if (result.provider !== "SIMULATOR") {
    throw new Error(
      "❌ Security test executed against an unexpected provider"
    );
  }

  console.log(
    "✅ ALLOW + APPROVED payment executes"
  );

  const allowedTransaction =
    await prisma.transaction.findUnique({
      where: {
        paymentIntentId: allowed.id,
      },
    });

  if (!allowedTransaction) {
    throw new Error(
      "❌ ALLOW payment did not create a transaction"
    );
  }

  console.log(
    "✅ ALLOW payment created exactly one transaction"
  );

  /*
   * ------------------------------------------------
   * DUPLICATE EXECUTION
   *
   * The same approved payment must not execute twice.
   * ------------------------------------------------
   */

  await assertThrows(
    "Duplicate execution is rejected",
    allowed.id,
    "Payment has already been submitted for execution"
  );
  /*
   * ------------------------------------------------
   * AGENT QUARANTINE
   *
   * Even an otherwise ALLOW + APPROVED payment
   * must not execute when the agent is quarantined.
   * ------------------------------------------------
   */

  const originalAgentStatus = agent.status;

  await prisma.agent.update({
    where: {
      id: agent.id,
    },
    data: {
      status: "QUARANTINED",
    },
  });

  const quarantinedPayment = await prisma.paymentIntent.create({
    data: {
      agent: {
        connect: {
          id: agent.id,
        },
      },
      intent: {
        connect: {
          id: intent.id,
        },
      },
      merchantName: "Security Test Merchant",
      amount: 1000,
      currency: "INR",
      status: "APPROVED",
      decision: "ALLOW",
    },
  });

  await assertThrows(
    "QUARANTINED agent cannot execute payment",
    quarantinedPayment.id,
    "Payment blocked because agent is QUARANTINED"
  );

  const quarantinedTransaction =
    await prisma.transaction.findUnique({
      where: {
        paymentIntentId: quarantinedPayment.id,
      },
    });

  if (quarantinedTransaction) {
    throw new Error(
      "❌ QUARANTINED agent payment created a transaction"
    );
  }

  console.log(
    "✅ QUARANTINED agent cannot execute payment"
  );
    /*
   * ------------------------------------------------
   * STICKY QUARANTINE
   *
   * A quarantined agent must remain quarantined
   * after a new payment evaluation.
   * ------------------------------------------------
   */

  const quarantinePersistencePayment = {
    agentId: agent.id,
    intentId: intent.id,
    merchantName: "Security Test Merchant",
    amount: 1000,
    currency: "INR",
  };

const quarantinePersistenceResult =
  await evaluateAndPersistPayment(
    quarantinePersistencePayment,
    {
      dailyLimit: agent.dailyLimit,
      perTransactionLimit: agent.perTransactionLimit,
      riskThreshold: agent.riskThreshold,
      amountSpentToday: 0,
      previousMerchants: [],
      recentTransactions: [],
    },
    {
      ...(intent.maxAmount !== null && {
        maxAmount: intent.maxAmount,
      }),
      currency: intent.currency,
      purpose: intent.purpose,
      ...(intent.category !== null && {
        category: intent.category,
      }),
      recurringAllowed: intent.recurringAllowed,
      maxTransactions: intent.maxTransactions,
      transactionsUsed: 0,
      expiresAt: intent.expiresAt,
    }
  );

  const persistedAgent = await prisma.agent.findUnique({
    where: {
      id: agent.id,
    },
    select: {
      status: true,
    },
  });

  if (persistedAgent?.status !== "QUARANTINED") {
    throw new Error(
      "❌ QUARANTINED agent was automatically restored"
    );
  }

  console.log(
    "✅ QUARANTINED agent remains quarantined after evaluation"
  );
await prisma.riskSignal.deleteMany({
  where: {
    paymentIntentId:
      quarantinePersistenceResult.paymentIntentId,
  },
});

await prisma.riskAssessment.deleteMany({
  where: {
    paymentIntentId:
      quarantinePersistenceResult.paymentIntentId,
  },
});

await prisma.paymentIntent.delete({
  where: {
    id: quarantinePersistenceResult.paymentIntentId,
  },
});
  await prisma.paymentIntent.delete({
    where: {
      id: quarantinedPayment.id,
    },
  });

  await prisma.agent.update({
    where: {
      id: agent.id,
    },
    data: {
      status: originalAgentStatus,
    },
  });
  /*
   * Restore the agent so the test suite remains isolated.
   */
  await prisma.agent.update({
    where: {
      id: agent.id,
    },
    data: {
      status: originalAgentStatus,
    },
  });
  /*
   * ------------------------------------------------
   * CLEANUP
   * ------------------------------------------------
   */

  await prisma.auditLog.deleteMany({
    where: {
      resourceId: {
        in: [
          blocked.id,
          review.id,
          allowed.id,
        ],
      },
    },
  });

  await prisma.transaction.deleteMany({
    where: {
      paymentIntentId: {
        in: [
          blocked.id,
          review.id,
          allowed.id,
        ],
      },
    },
  });

  await prisma.paymentIntent.deleteMany({
    where: {
      id: {
        in: [
          blocked.id,
          review.id,
          allowed.id,
        ],
      },
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

  if (previousProvider === undefined) {
    delete process.env.PAYMENT_PROVIDER;
  } else {
    process.env.PAYMENT_PROVIDER =
      previousProvider;
  }

  console.log("");
  console.log("====================================");
  console.log(
    "VANGUARD EXECUTION GATE TESTS PASSED"
  );
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