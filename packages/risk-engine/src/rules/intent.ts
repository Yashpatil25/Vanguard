import {
  PaymentRequest,
  IntentContext,
  RiskSignal,
} from "../types.js";

export function evaluateIntent(
  request: PaymentRequest,
  intent: IntentContext
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // ------------------------------------------------------------
  // 1. Expired authorization
  // ------------------------------------------------------------
  if (new Date() > intent.expiresAt) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 40,
      severity: "CRITICAL",
      description:
        "The payment request uses an expired authorization intent.",
    });

    return signals;
  }

  // ------------------------------------------------------------
  // 2. Amount exceeds authorized intent
  // ------------------------------------------------------------
  if (
    intent.maxAmount !== undefined &&
    request.amount > intent.maxAmount
  ) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 30,
      severity: "HIGH",
      description:
        "Payment amount exceeds the amount authorized by the user's intent.",
    });
  }

  // ------------------------------------------------------------
  // 3. Currency mismatch
  // ------------------------------------------------------------
  if (
    request.currency.toUpperCase() !==
    intent.currency.toUpperCase()
  ) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 35,
      severity: "HIGH",
      description:
        "Payment currency does not match the currency authorized by the user's intent.",
    });
  }

  // ------------------------------------------------------------
  // 4. Purpose mismatch
  // ------------------------------------------------------------
  if (
    request.purpose &&
    intent.purpose &&
    request.purpose.trim().toLowerCase() !==
      intent.purpose.trim().toLowerCase()
  ) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 35,
      severity: "HIGH",
      description:
        "The payment purpose does not match the purpose authorized by the user's intent.",
    });
  }

  // ------------------------------------------------------------
  // 5. Category mismatch
  // ------------------------------------------------------------
  if (
    request.category &&
    intent.category &&
    request.category.trim().toLowerCase() !==
      intent.category.trim().toLowerCase()
  ) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 30,
      severity: "HIGH",
      description:
        "The payment category does not match the category authorized by the user's intent.",
    });
  }

  // ------------------------------------------------------------
  // 6. Unauthorized recurring payment
  // ------------------------------------------------------------
  if (
    request.recurring === true &&
    intent.recurringAllowed === false
  ) {
    signals.push({
      type: "RECURRING_PAYMENT",
      score: 25,
      severity: "HIGH",
      description:
        "The payment attempts to create a recurring charge that the user did not authorize.",
    });
  }

  // ------------------------------------------------------------
  // 7. Transaction count exhausted
  // ------------------------------------------------------------
  if (intent.transactionsUsed >= intent.maxTransactions) {
    signals.push({
      type: "INTENT_MISMATCH",
      score: 35,
      severity: "HIGH",
      description:
        "The authorized transaction count for this intent has already been exhausted.",
    });
  }

  return signals;
}