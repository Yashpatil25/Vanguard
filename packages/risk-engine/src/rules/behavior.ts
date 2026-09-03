import {
  AgentContext,
  PaymentRequest,
  RiskSignal,
} from "../types.js";

export function evaluateBehavior(
  request: PaymentRequest,
  agent: AgentContext
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const transactions = agent.recentTransactions;

  // We need historical data to establish a baseline.
  if (transactions.length < 3) {
    return signals;
  }

  // --------------------------------------------------
  // 1. Amount baseline
  // --------------------------------------------------

  const averageAmount =
    transactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    ) / transactions.length;

  // Current transaction is significantly larger than
  // the agent's historical average.
  if (request.amount >= averageAmount * 3) {
    signals.push({
      type: "BEHAVIORAL_DRIFT",
      score: 25,
      severity: "HIGH",
      description:
        "The payment amount is significantly higher than the agent's historical spending behavior.",
    });
  }

  // --------------------------------------------------
  // 2. Merchant familiarity
  // --------------------------------------------------

  if (request.merchantId) {
    const knownMerchant = transactions.some(
      (transaction) =>
        transaction.merchantId === request.merchantId
    );

    if (!knownMerchant) {
      signals.push({
        type: "MERCHANT_ANOMALY",
        score: 15,
        severity: "MEDIUM",
        description:
          "The agent is attempting a payment with a merchant not present in its recent transaction history.",
      });
    }
  }

  // --------------------------------------------------
  // 3. Recent transaction frequency
  // --------------------------------------------------

  const now = Date.now();

  const transactionsLastHour = transactions.filter(
    (transaction) => {
      const age =
        now - transaction.createdAt.getTime();

      return age >= 0 && age <= 60 * 60 * 1000;
    }
  );

  if (transactionsLastHour.length >= 5) {
    signals.push({
      type: "BEHAVIORAL_DRIFT",
      score: 20,
      severity: "HIGH",
      description:
        "The agent is operating at a transaction frequency significantly above its recent activity pattern.",
    });
  }

  return signals;
}