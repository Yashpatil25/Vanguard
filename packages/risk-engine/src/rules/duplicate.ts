import {
  AgentContext,
  PaymentRequest,
  RiskSignal,
} from "../types.js";

export function detectDuplicate(
  request: PaymentRequest,
  agent: AgentContext
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  const now = Date.now();

  const duplicate = agent.recentTransactions.some((transaction) => {
    const age = now - transaction.createdAt.getTime();

    return (
      age <= 60_000 &&
      transaction.merchantId === request.merchantId &&
      transaction.amount === request.amount
    );
  });

  if (duplicate) {
    signals.push({
      type: "DUPLICATE_PAYMENT",
      score: 35,
      severity: "HIGH",
      description:
        "An identical payment to the same merchant occurred within the last minute.",
    });
  }

  return signals;
}