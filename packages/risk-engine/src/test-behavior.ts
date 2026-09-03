import { evaluatePayment } from "./index.js";
import { evaluateBehavior } from "./rules/behavior.js";
import { evaluateAgentRisk } from "./agent-risk.js";

import type {
  AgentContext,
  AgentRiskEvent,
  IntentContext,
  PaymentRequest,
} from "./types.js";

const now = new Date();

const agent: AgentContext = {
  dailyLimit: 100_000,
  perTransactionLimit: 100_000,
  riskThreshold: 70,
  amountSpentToday: 0,
  previousMerchants: [],
  recentTransactions: [
    {
      merchantId: "merchant_a",
      amount: 1_000,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
    {
      merchantId: "merchant_b",
      amount: 1_200,
      createdAt: new Date(now.getTime() - 45 * 60 * 1000),
    },
    {
      merchantId: "merchant_a",
      amount: 800,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
  ],
};

const request: PaymentRequest = {
  agentId: "agent-test",
  intentId: "intent-test",
  merchantId: "unknown_merchant",
  merchantName: "Unknown Merchant",
  amount: 5_000,
  currency: "INR",
  category: "electronics",
  purpose: "Buy headphones",
};

const intent: IntentContext = {
  maxAmount: 10_000,
  currency: "INR",
  purpose: "Buy headphones",
  category: "electronics",
  recurringAllowed: false,
  maxTransactions: 10,
  transactionsUsed: 0,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
};

// --------------------------------------------------
// 1. Direct behavioral rule
// --------------------------------------------------

const signals = evaluateBehavior(request, agent);

const behavioralDrift = signals.find(
  (signal) => signal.type === "BEHAVIORAL_DRIFT"
);

const merchantAnomaly = signals.find(
  (signal) => signal.type === "MERCHANT_ANOMALY"
);

if (!behavioralDrift) {
  throw new Error("Behavioral drift was not detected");
}

if (behavioralDrift.score !== 25) {
  throw new Error(
    `Expected behavioral drift score 25, got ${behavioralDrift.score}`
  );
}

if (behavioralDrift.severity !== "HIGH") {
  throw new Error(
    `Expected HIGH severity, got ${behavioralDrift.severity}`
  );
}

if (!merchantAnomaly) {
  throw new Error("Unknown merchant was not detected");
}

console.log("✅ Behavioral drift detected");
console.log("✅ Unknown merchant detected");

// --------------------------------------------------
// 2. Full payment pipeline
// --------------------------------------------------

const result = evaluatePayment(
  request,
  agent,
  intent
);

if (!result.signals.some(
  (signal) => signal.type === "BEHAVIORAL_DRIFT"
)) {
  throw new Error(
    "Full pipeline did not produce BEHAVIORAL_DRIFT"
  );
}

if (!result.signals.some(
  (signal) => signal.type === "MERCHANT_ANOMALY"
)) {
  throw new Error(
    "Full pipeline did not produce MERCHANT_ANOMALY"
  );
}

if (result.riskScore !== 40) {
  throw new Error(
    `Expected risk score 40, got ${result.riskScore}`
  );
}

if (result.decision !== "REVIEW") {
  throw new Error(
    `Expected REVIEW, got ${result.decision}`
  );
}

console.log("✅ Pipeline detects behavioral anomalies");
console.log("✅ Behavioral risk score is 40");
console.log("✅ Behavioral anomaly escalates payment to REVIEW");

// --------------------------------------------------
// 3. Agent-level escalation
// --------------------------------------------------

const events: AgentRiskEvent[] = [
  {
    riskScore: 40,
    decision: "REVIEW",
    createdAt: new Date(now.getTime() - 2 * 60 * 1000),
  },
  {
    riskScore: 40,
    decision: "REVIEW",
    createdAt: new Date(now.getTime() - 1 * 60 * 1000),
  },
];

const agentRiskState = evaluateAgentRisk(events);

if (agentRiskState !== "WATCH") {
  throw new Error(
    `Expected WATCH after repeated reviews, got ${agentRiskState}`
  );
}

console.log("✅ Repeated behavioral reviews escalate agent to WATCH");

console.log("");
console.log("====================================");
console.log("VANGUARD BEHAVIOR TESTS PASSED");
console.log("====================================");