import {
  AgentContext,
  PaymentRequest,
  RiskSignal,
} from "../types.js";

export function evaluatePolicy(
  request: PaymentRequest,
  agent: AgentContext
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (request.amount > agent.perTransactionLimit) {
    signals.push({
      type: "POLICY_VIOLATION",
      score: 30,
      severity: "HIGH",
      description:
        "Payment exceeds the agent's per-transaction spending limit.",
    });
  }

  if (
    agent.amountSpentToday + request.amount >
    agent.dailyLimit
  ) {
    signals.push({
      type: "POLICY_VIOLATION",
      score: 25,
      severity: "HIGH",
      description:
        "Payment would cause the agent to exceed its daily spending limit.",
    });
  }

  return signals;
}