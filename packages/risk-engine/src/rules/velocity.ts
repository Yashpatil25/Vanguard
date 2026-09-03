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

  // Same-merchant payment loop
  const sameMerchantTransactions =
    recentTransactions.filter(
      (transaction) =>
        transaction.merchantId === request.merchantId
    );

  if (sameMerchantTransactions.length >= 2) {
    signals.push({
      type: "PAYMENT_LOOP",
      score: 30,
      severity: "HIGH",
      description:
        "Multiple payments to the same merchant were attempted within a very short period.",
    });
  }

  return signals;
}