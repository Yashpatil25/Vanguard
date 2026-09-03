import {
  Decision,
  RiskLevel,
  RiskSignal,
} from "./types.js";

export function calculateRiskScore(
  signals: RiskSignal[]
): number {
  const total = signals.reduce(
    (sum, signal) => sum + signal.score,
    0
  );

  return Math.min(total, 100);
}

export function getRiskLevel(
  score: number,
  signals: RiskSignal[] = []
): RiskLevel {
  const hasCriticalSignal = signals.some(
    (signal) => signal.severity === "CRITICAL"
  );

  if (hasCriticalSignal) return "CRITICAL";
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";

  return "LOW";
}

export function getDecision(
  score: number,
  hasCriticalSignal: boolean,
  signals: RiskSignal[] = []
): Decision {
  if (hasCriticalSignal || score >= 80) {
    return "BLOCK";
  }

  const hasHighSeveritySignal = signals.some(
    (signal) => signal.severity === "HIGH"
  );

  if (hasHighSeveritySignal || score >= 50) {
    return "REVIEW";
  }

  return "ALLOW";
}