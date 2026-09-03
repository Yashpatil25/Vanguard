import type { PaymentRequest, RiskSignal } from "../types.js";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions|rules|commands)/i,

  /disregard\s+(all\s+)?previous\s+(instructions|rules|commands)/i,

  /discard\s+(all\s+)?previous\s+(instructions|rules|commands)/i,

  /ignore\s+(the\s+)?(system|security|payment)\s+(instructions|rules|policy)/i,

  /override\s+(the\s+)?(system|security|payment)\s+(instructions|rules|policy)/i,

  /bypass\s+(the\s+)?(security|payment|authorization)\s+(policy|rules|checks)/i,

  /disable\s+(the\s+)?(security|risk|fraud)\s+(checks|controls|system)/i,

  /do\s+not\s+(check|validate|verify|enforce)\s+(the\s+)?(payment|authorization|policy)/i,

  /forget\s+(your|the)\s+(instructions|rules|policy)/i,

  /you\s+are\s+now\s+(allowed|authorized)\s+to/i,

  /pretend\s+(that\s+)?(the\s+)?user\s+(approved|authorized)/i,

  /ignore\s+(the\s+)?user'?s?\s+(authorization|approval|instructions|limits?)/i,

  /execute\s+(the\s+|this\s+)?(payment|transaction)\s+immediately/i,

  /buy\s+.*immediately/i,
];

export function detectPromptInjection(
  request: PaymentRequest
): RiskSignal[] {
  const instruction = request.agentInstruction?.trim();

  if (!instruction) {
    return [];
  }

  const matchedPatterns = PROMPT_INJECTION_PATTERNS.filter(
    (pattern) => pattern.test(instruction)
  );

  if (matchedPatterns.length === 0) {
    return [];
  }

  return [
    {
      type: "PROMPT_INJECTION",
      score: 40,
      severity: "CRITICAL",
      description:
        "The AI payment instruction contains patterns associated with an attempt to override or bypass authorized system, security, or payment instructions.",
    },
  ];
}