import type {
  PaymentRequest,
  AgentContext,
  IntentContext,
  DecisionResult,
} from "./types.js";

import { evaluateIntent } from "./rules/intent.js";
import { evaluatePolicy } from "./rules/policy.js";
import { detectDuplicate } from "./rules/duplicate.js";
import { evaluateVelocity } from "./rules/velocity.js";
import { evaluateBehavior } from "./rules/behavior.js";
import { detectPromptInjection } from "./rules/prompt-injection.js";
import { detectToolPoisoning } from "./rules/tool-poisoning.js";

import {
  calculateRiskScore,
  getDecision,
  getRiskLevel,
} from "./scoring.js";

export function evaluatePayment(
  request: PaymentRequest,
  agent: AgentContext,
  intent: IntentContext
): DecisionResult {
  const signals = [
    ...evaluateIntent(request, intent),
    ...evaluatePolicy(request, agent),
    ...detectDuplicate(request, agent),
    ...evaluateVelocity(request, agent),
    ...evaluateBehavior(request, agent),
    ...detectPromptInjection(request),
    ...detectToolPoisoning(request),
  ];

  const riskScore = calculateRiskScore(signals);

  const hasCriticalSignal = signals.some(
    (signal) => signal.severity === "CRITICAL"
  );

const decision = getDecision(
  riskScore,
  hasCriticalSignal,
  signals
);

  return {
    decision,
    riskScore,
    riskLevel: getRiskLevel(riskScore, signals),
    signals,
  };
}

export type {
  PaymentRequest,
  AgentContext,
  IntentContext,
  DecisionResult,
  AgentRiskEvent,
  AgentRiskState,
} from "./types.js";

export { evaluateAgentRisk } from "./agent-risk.js";