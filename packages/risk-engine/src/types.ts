export type Decision = "ALLOW" | "REVIEW" | "BLOCK";

export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type AgentRiskState =
  | "ACTIVE"
  | "WATCH"
  | "RESTRICTED"
  | "QUARANTINED";

export type RiskSignalType =
  | "INTENT_MISMATCH"
  | "AMOUNT_ANOMALY"
  | "MERCHANT_ANOMALY"
  | "VELOCITY_ANOMALY"
  | "DUPLICATE_PAYMENT"
  | "RECURRING_PAYMENT"
  | "POLICY_VIOLATION"
  | "PROMPT_INJECTION"
  | "TOOL_POISONING"
  | "BEHAVIORAL_DRIFT"
  | "PAYMENT_LOOP";

export interface ToolCall {
  toolName: string;
  arguments?: Record<string, unknown>;
  output?: unknown;

  // Whether Vanguard considers this tool trusted.
  trusted?: boolean;
}

export interface PaymentRequest {
  agentId: string;
  intentId: string;

  merchantId?: string;
  merchantName?: string;

  amount: number;
  currency: string;

  category?: string;
  purpose?: string;

  recurring?: boolean;

  /**
   * Natural-language instruction/context supplied to the AI payment agent.
   * Used by Vanguard's AI security layer.
   */
  agentInstruction?: string;
  toolCalls?: ToolCall[];
}

export interface AgentContext {
  dailyLimit: number;
  perTransactionLimit: number;
  riskThreshold: number;

  amountSpentToday: number;

  previousMerchants: string[];
  recentTransactions: RecentTransaction[];
}

export interface IntentContext {
  maxAmount?: number;
  currency: string;

  purpose: string;
  category?: string;

  recurringAllowed: boolean;
  maxTransactions: number;

  transactionsUsed: number;

  expiresAt: Date;
}

export interface RecentTransaction {
  merchantId?: string;
  amount: number;
  createdAt: Date;
}

export interface RiskSignal {
  type: RiskSignalType;
  score: number;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface DecisionResult {
  decision: Decision;

  riskScore: number;
  riskLevel: RiskLevel;

  signals: RiskSignal[];
}
export interface AgentRiskEvent {
  riskScore: number;
  decision: Decision;
  createdAt: Date;
}