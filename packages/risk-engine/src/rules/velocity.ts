import {
  AgentContext,
  PaymentRequest,
  RiskSignal,
} from "../types.js";

export function evaluateVelocity(
  request: PaymentRequest,
  agent: AgentContext
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const now = Date.now();

  const recentTransactions = agent.recentTransactions.filter(
    (transaction) => {
      const age = now - transaction.createdAt.getTime();

      return age >= 0 && age <= 60_000;
    }
  );

  // General payment velocity
  if (recentTransactions.length >= 3) {
    signals.push({
      type: "VELOCITY_ANOMALY",
      score: 25,
      severity: "HIGH",
      description:
        "The agent has initiated an unusually high number of payments within the last minute.",
    });
  }

  // Payment loop:
  // repeated attempts to the same merchant with a similar
  // amount within a short period.
  const sameMerchantTransactions =
    recentTransactions.filter(
      (transaction) =>
        transaction.merchantId === request.merchantId
    );

  const similarAmountTransactions =
    sameMerchantTransactions.filter((transaction) => {
      if (request.amount <= 0) {
        return false;
      }

      const difference =
        Math.abs(transaction.amount - request.amount) /
        request.amount;

      return difference <= 0.05;
    });

  if (similarAmountTransactions.length >= 2) {
    signals.push({
      type: "PAYMENT_LOOP",
      score: 40,
      severity: "CRITICAL",
      description:
        "The agent is repeatedly attempting a similar payment to the same merchant within a short period, indicating a possible payment loop.",
    });
  }

  return signals;
}