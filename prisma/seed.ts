import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // Clean existing development data
  await prisma.riskSignal.deleteMany();
  await prisma.riskAssessment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.agentEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.intentPassport.deleteMany();
  await prisma.spendingPolicy.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();

  // Create test user
const user = await prisma.user.create({
  data: {
    email: "test@vanguard.local",
    name: "Vanguard Test User",
    role: "REVIEWER",
  },
});

  // Create test agent
  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      name: "Test Shopping Agent",
      status: "ACTIVE",

      dailyLimit: 1_000_000,
      perTransactionLimit: 500_000,
      riskThreshold: 70,
    },
  });

  // Create spending policy
  await prisma.spendingPolicy.create({
    data: {
      agentId: agent.id,
      name: "Default Spending Policy",
      description: "Development policy for payment testing",

      enabled: true,
      priority: 100,

      maxTransactionAmount: 500_000,
      dailyLimit: 1_000_000,

      allowRecurring: false,
      requireApprovalAbove: 400_000,
    },
  });

  // Create an intent passport
  const intent = await prisma.intentPassport.create({
    data: {
      agentId: agent.id,

      originalRequest: "Buy headphones from an online merchant",

      purpose: "Buy headphones",
      category: "electronics",

      maxAmount: 500_000,
      currency: "INR",

      recurringAllowed: false,
      maxTransactions: 1,

      expiresAt: new Date(Date.now() + 30 * 60 * 1000),

      status: "ACTIVE",
    },
  });

  console.log("Vanguard development data created.");
  console.log("");
  console.log("User:");
  console.log(`  ${user.id}`);
  console.log("");
  console.log("Agent:");
  console.log(`  ${agent.id}`);
  console.log("");
  console.log("Intent:");
  console.log(`  ${intent.id}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });