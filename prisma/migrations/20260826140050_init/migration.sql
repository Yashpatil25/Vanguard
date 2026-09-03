-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'QUARANTINED', 'DISABLED');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'ANALYZING', 'APPROVED', 'REVIEW', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskSignalType" AS ENUM ('INTENT_MISMATCH', 'AMOUNT_ANOMALY', 'MERCHANT_ANOMALY', 'VELOCITY_ANOMALY', 'DUPLICATE_PAYMENT', 'RECURRING_PAYMENT', 'POLICY_VIOLATION', 'PROMPT_INJECTION', 'TOOL_POISONING', 'BEHAVIORAL_DRIFT', 'PAYMENT_LOOP');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY', 'SIMULATOR');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('TRUSTED', 'SEMI_TRUSTED', 'UNTRUSTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "dailyLimit" INTEGER NOT NULL,
    "perTransactionLimit" INTEGER NOT NULL,
    "riskThreshold" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spending_policies" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "maxTransactionAmount" INTEGER,
    "dailyLimit" INTEGER,
    "allowRecurring" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalAbove" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spending_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intent_passports" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "originalRequest" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "category" TEXT,
    "maxAmount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "recurringAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxTransactions" INTEGER NOT NULL DEFAULT 1,
    "allowedMerchants" TEXT,
    "blockedMerchants" TEXT,
    "requiresApprovalAbove" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "IntentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_passports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "merchantId" TEXT,
    "merchantName" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "category" TEXT,
    "purpose" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "decision" "Decision",
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "amountScore" INTEGER NOT NULL DEFAULT 0,
    "merchantScore" INTEGER NOT NULL DEFAULT 0,
    "behaviorScore" INTEGER NOT NULL DEFAULT 0,
    "velocityScore" INTEGER NOT NULL DEFAULT 0,
    "attackScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "reasons" TEXT,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_signals" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "type" "RiskSignalType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "score" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "TransactionStatus" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "eventType" TEXT NOT NULL,
    "toolName" TEXT,
    "inputData" TEXT,
    "outputData" TEXT,
    "source" TEXT,
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'UNTRUSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "spending_policies_agentId_idx" ON "spending_policies"("agentId");

-- CreateIndex
CREATE INDEX "intent_passports_agentId_idx" ON "intent_passports"("agentId");

-- CreateIndex
CREATE INDEX "intent_passports_status_idx" ON "intent_passports"("status");

-- CreateIndex
CREATE INDEX "payment_intents_agentId_idx" ON "payment_intents"("agentId");

-- CreateIndex
CREATE INDEX "payment_intents_intentId_idx" ON "payment_intents"("intentId");

-- CreateIndex
CREATE INDEX "payment_intents_status_idx" ON "payment_intents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_paymentIntentId_key" ON "risk_assessments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "risk_signals_paymentIntentId_idx" ON "risk_signals"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_paymentIntentId_key" ON "transactions"("paymentIntentId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "agent_events_agentId_createdAt_idx" ON "agent_events"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_agentId_createdAt_idx" ON "audit_logs"("agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_policies" ADD CONSTRAINT "spending_policies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intent_passports" ADD CONSTRAINT "intent_passports_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "intent_passports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
