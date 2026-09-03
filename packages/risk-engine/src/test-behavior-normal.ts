import { evaluatePayment } from "./index.js";

const now = Date.now();

const result = evaluatePayment(
  {
    agentId: "agent_normal_001",
    intentId: "intent_normal_001",
    merchantId: "merchant_amazon",
    merchantName: "Amazon",
    amount: 130000,
    currency: "INR",
    category: "electronics",
    purpose: "Buy headphones",
    recurring: false,
  },

  {
    dailyLimit: 2000000,
    perTransactionLimit: 1000000,
    riskThreshold: 70,
    amountSpentToday: 0,
    previousMerchants: [],
    recentTransactions: [
      {
        merchantId: "merchant_amazon",
        amount: 100000,
        createdAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      {
        merchantId: "merchant_amazon",
        amount: 120000,
        createdAt: new Date(now - 20 * 60 * 60 * 1000),
      },
      {
        merchantId: "merchant_flipkart",
        amount: 90000,
        createdAt: new Date(now - 18 * 60 * 60 * 1000),
      },
      {
        merchantId: "merchant_amazon",
        amount: 110000,
        createdAt: new Date(now - 12 * 60 * 60 * 1000),
      },
    ],
  },

  {
    maxAmount: 1000000,
    currency: "INR",
    purpose: "Buy headphones",
    category: "electronics",
    recurringAllowed: false,
    maxTransactions: 5,
    transactionsUsed: 0,
    expiresAt: new Date(now + 30 * 60 * 1000),
  }
);

console.log(
  JSON.stringify(result, null, 2)
);