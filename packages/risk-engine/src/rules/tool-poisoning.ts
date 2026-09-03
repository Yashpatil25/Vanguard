import {
  PaymentRequest,
  RiskSignal,
  ToolCall,
} from "../types.js";

function containsPoisoningPattern(value: string): boolean {
  const normalized = value.toLowerCase();

  const patterns = [
  "ignore previous instructions",
  "ignore all previous instructions",
  "ignore the authorized payment policy",
  "ignore authorized payment policy",

  "bypass security",
  "bypass the security",
  "bypass the authorization",
  "bypass the payment authorization",

  "override the payment policy",
  "override payment policy",
  "override the authorized payment policy",

  "ignore the user's limit",
  "ignore user limit",

  "increase the payment limit",

  "transfer the money immediately",
  "execute the transaction immediately",
  "execute this transaction immediately",

  "system message:",
  "developer message:",
  "admin instruction:",
  "do not follow",
];

  return patterns.some((pattern) =>
    normalized.includes(pattern)
  );
}

function inspectValue(value: unknown): boolean {
  if (typeof value === "string") {
    return containsPoisoningPattern(value);
  }

  if (Array.isArray(value)) {
    return value.some(inspectValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(inspectValue);
  }

  return false;
}

function inspectTool(tool: ToolCall): boolean {
  if (tool.trusted === false) {
    return (
      inspectValue(tool.output) ||
      inspectValue(tool.arguments)
    );
  }

  return inspectValue(tool.output);
}

export function detectToolPoisoning(
  request: PaymentRequest
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (!request.toolCalls?.length) {
    return signals;
  }

  const poisonedTool = request.toolCalls.find(inspectTool);

  if (poisonedTool) {
    signals.push({
      type: "TOOL_POISONING",
      score: 40,
      severity: "CRITICAL",
      description:
        `Tool "${poisonedTool.toolName}" returned content containing patterns associated with an attempt to manipulate or override the AI agent's authorized instructions.`,
    });
  }

  return signals;
}