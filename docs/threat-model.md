# Vanguard Threat Model

## 1. Purpose

Vanguard is an intent-aware runtime security and authorization layer for autonomous AI agents that are allowed to initiate financial actions.

The purpose of this threat model is to define:

- assets that must be protected,
- actors interacting with the system,
- trust boundaries,
- threats against autonomous financial actions,
- security invariants,
- mitigations,
- residual risks,
- demo attack scenarios,
- testable security requirements.

Vanguard's security boundary exists between an AI agent and the payment provider.

The core principle is:

> An AI agent may request a financial action, but it must never have direct authority to move money.

---

# 2. Security Objective

The primary security objective of Vanguard is:

> Ensure that every financial action executed by an AI agent remains within the authority explicitly granted by the user.

Vanguard therefore evaluates the relationship between:

1. User intent
2. Agent request
3. Agent behavior
4. External/tool influence
5. Spending policy
6. Transaction history
7. Payment execution

The core security flow is:

```text
Intent
  ↓
Policy
  ↓
Risk
  ↓
Behaviour
  ↓
Authorization
  ↓
Payment
---

# 3. Assets

Vanguard protects the following security-critical assets.

## 3.1 User Intent

The user's authorized purpose and constraints for an agent action.

Examples:

- purpose
- category
- maximum amount
- currency
- recurring permission
- transaction limit
- expiration

Compromise of user intent could allow an agent to perform an action that the user did not authorize.

## 3.2 Intent Passport

The machine-readable authorization envelope representing the user's financial authority granted to the agent.

The Intent Passport defines the boundary within which an agent may request payment actions.

## 3.3 Agent Identity and State

The identity and security state of an autonomous agent.

Agent states include:

- ACTIVE
- PAUSED
- QUARANTINED

An agent's security state is security-sensitive because a paused or quarantined agent must not be able to execute payments.

## 3.4 Payment Intent

The server-side representation of a requested financial action.

It contains information such as:

- agent
- intent
- merchant
- amount
- currency
- decision
- payment status

## 3.5 Risk Assessment

The risk score, risk level, and security signals produced by Vanguard's risk engine.

These determine whether a payment request is:

- ALLOW
- REVIEW
- BLOCK

## 3.6 Payment Transaction

The transaction representing an actual payment execution.

This is a high-value asset because it represents the point at which Vanguard has authorized interaction with the payment provider.

## 3.7 Razorpay Credentials and Verification Secrets

Server-side credentials and secrets used to interact with Razorpay and verify Razorpay callbacks.

These must never be exposed to the frontend or autonomous agent.

## 3.8 Webhook Integrity

The authenticity and integrity of Razorpay webhook events.

Vanguard must verify:

- webhook signature
- event identity
- payment/order relationship
- amount
- currency
- payment ID

before changing transaction state.

## 3.9 Audit Trail

Security-relevant records describing:

- risk decisions
- payment execution
- payment verification
- webhook capture
- security failures
- agent activity

The audit trail provides evidence of why and how a financial action was authorized or rejected.

---

# 4. Actors

## 4.1 User

The user defines the intended financial action and grants authority to the autonomous agent.

The user is considered the source of authorization.

## 4.2 Autonomous AI Agent

The agent interprets user intent and requests financial actions.

The agent is **not trusted with direct payment authority**.

The agent must communicate with the payment system through Vanguard.

## 4.3 Vanguard

Vanguard is the trusted authorization boundary.

It evaluates:

- intent
- policy
- risk
- behaviour
- agent state
- transaction history

before permitting payment execution.

## 4.4 Razorpay

Razorpay is the external payment provider responsible for payment processing.

Vanguard must not assume that an agent request is authorized merely because it reaches the payment provider.

## 4.5 Untrusted Tool or External Context

External tools, tool outputs, retrieved content, prompts, or other external context may influence an AI agent.

These inputs are considered potentially untrusted because they may attempt to alter the agent's intended behaviour.

## 4.6 Attacker

An attacker attempts to cause an autonomous agent to perform an unauthorized financial action.

The attacker may attempt to manipulate:

- prompts
- tool outputs
- transaction parameters
- merchant information
- payment timing
- repeated requests
- intent interpretation

---

# 5. Trust Boundaries

Vanguard defines the following trust boundaries.

## Boundary 1 — User → AI Agent

The agent receives user intent and interprets it.

Threat:

An attacker may attempt to manipulate the agent's interpretation of the user's authorization.

## Boundary 2 — AI Agent → Vanguard

The agent submits a financial request to Vanguard.

Threat:

The agent may request an action that exceeds the user's authorized intent.

Vanguard must independently evaluate the request rather than trusting the agent.

## Boundary 3 — External Tools/Context → AI Agent

Tools and external content may influence agent behaviour.

Threat:

Prompt injection or tool poisoning may cause the agent to request unauthorized actions.

## Boundary 4 — Vanguard → Razorpay

Vanguard sends an approved payment request to the payment provider.

Security requirement:

Only requests that pass Vanguard's authorization gate may reach payment execution.

## Boundary 5 — Razorpay → Vanguard

Razorpay communicates payment state through callbacks/webhooks.

Security requirement:

Vanguard must authenticate and validate webhook events before updating transaction state.

## Boundary 6 — Frontend → Vanguard API

The frontend can request evaluation and payment execution.

Security requirement:

The frontend must not be treated as the final authorization authority.

The backend must independently enforce payment authorization.
---

# 6. Threat Model

Vanguard considers threats that could cause an autonomous agent to perform a financial action outside the authority granted by the user.

## 6.1 Prompt Injection

### Threat

Malicious instructions attempt to override the user's authorization and cause the agent to request an unauthorized payment.

### Preconditions

- The agent receives attacker-controlled or untrusted text.
- The malicious text influences the agent's payment request.

### Attack

An attacker injects instructions such as:

- ignore previous instructions
- ignore user authorization
- execute the payment immediately

### Security Invariant

Untrusted instructions must not override the user's financial authorization.

A payment request containing detected prompt-injection behaviour must not be ALLOWED.

### Mitigation

Vanguard detects prompt-injection patterns in the payment request and generates a critical security signal.

Critical signals cause the transaction to be BLOCKED.

### Test

The security test suite verifies that prompt injection:

- generates a `PROMPT_INJECTION` signal
- results in `BLOCK`
- cannot reach payment execution

### Residual Risk

Detection based on known patterns cannot guarantee detection of every possible semantic prompt-injection technique.

---

## 6.2 Tool Poisoning

### Threat

A malicious or compromised external tool attempts to influence the agent to bypass the user's authorization.

### Preconditions

- The agent consumes output from an untrusted tool.
- The tool output contains malicious payment instructions.

### Attack

An untrusted tool returns instructions attempting to bypass Vanguard authorization and execute a payment.

### Security Invariant

Untrusted tool output must not be sufficient to authorize a financial transaction.

### Mitigation

Vanguard detects untrusted tool output containing payment-bypass instructions and generates a critical `TOOL_POISONING` signal.

The transaction is BLOCKED.

### Test

The security test suite verifies that tool poisoning:

- generates a `TOOL_POISONING` signal
- results in `BLOCK`
- cannot reach payment execution

### Residual Risk

Tool poisoning techniques that do not match the current detection patterns may require additional behavioural or semantic detection.

---

## 6.3 Intent Mismatch

### Threat

An agent requests a transaction that does not match the purpose or category authorized by the user.

### Preconditions

- A valid Intent Passport exists.
- The agent submits a request outside the authorized purpose or category.

### Attack

The agent attempts to use an authorization granted for one purpose to perform a different purchase.

### Security Invariant

A valid Intent Passport must not authorize transactions outside its defined intent.

### Mitigation

Vanguard evaluates the requested transaction against the Intent Passport.

Intent mismatches generate risk signals and prevent unauthorized requests from being ALLOWED.

### Test

The Battlebox verifies that an intent mismatch produces a non-ALLOW decision.

### Residual Risk

Highly ambiguous or semantically similar purposes may require stronger semantic intent verification.

---

## 6.4 Amount Escalation

### Threat

An agent attempts to increase the transaction amount beyond the amount authorized by the user.

### Preconditions

- An Intent Passport defines a maximum authorized amount.
- The agent modifies the requested amount.

### Attack

The agent submits a payment exceeding the authorized amount.

### Security Invariant

A transaction must never exceed the maximum amount authorized by the Intent Passport.

### Mitigation

Vanguard compares the requested amount with the authorized maximum and generates an `INTENT_MISMATCH` signal when the request exceeds authorization.

### Test

The security test suite verifies that amount escalation generates `INTENT_MISMATCH` and cannot result in `ALLOW`.

### Residual Risk

Correct enforcement depends on the integrity of the Intent Passport itself.

---

## 6.5 Recurring Payment Abuse

### Threat

An agent attempts to create a recurring payment when recurring payments were not authorized.

### Preconditions

- The Intent Passport disallows recurring transactions.
- The agent requests a recurring payment.

### Attack

The agent modifies the request to enable recurring payment behaviour.

### Security Invariant

Recurring payments must not be executed unless explicitly authorized.

### Mitigation

Vanguard compares the requested recurring state with the Intent Passport.

Unauthorized recurring behaviour generates a security signal and prevents ALLOW.

### Test

The security test suite verifies that unauthorized recurring payments are detected and cannot be ALLOWED.

### Residual Risk

Future recurring-payment support must preserve the same authorization boundary across subscription lifecycle events.

---

## 6.6 Expired Intent

### Threat

An agent attempts to use an authorization after its expiration time.

### Preconditions

- The Intent Passport has expired.
- The agent submits a payment using the expired authorization.

### Security Invariant

Expired authorization must never permit payment execution.

### Mitigation

Vanguard evaluates intent expiration before authorization.

An expired intent results in `BLOCK`.

### Test

The security test suite verifies that expired intents are BLOCKED.

### Residual Risk

Correct time handling requires consistent server-side time and timezone-independent timestamps.

---

## 6.7 Duplicate Payment

### Threat

The same financial action is executed more than once.

### Preconditions

- A payment request or transaction has already been executed.
- The agent or client submits another execution request.

### Security Invariant

A payment intent must not create more than one transaction.

### Mitigation

Vanguard checks for an existing transaction before execution.

Duplicate execution is rejected.

### Test

The API security test suite verifies that duplicate execution is rejected and does not create another transaction.

### Residual Risk

Distributed concurrent requests require atomic database-level protection in addition to application-level checks.

---

## 6.8 Velocity Anomaly

### Threat

An agent performs transactions at a frequency or volume inconsistent with its expected behaviour.

### Preconditions

- The agent generates multiple payment requests.
- The requests exceed expected velocity thresholds.

### Security Invariant

Abnormal transaction velocity must increase risk and must not silently bypass authorization.

### Mitigation

Vanguard's velocity rule evaluates recent transaction activity and contributes risk signals to the overall decision.

### Test

Velocity behaviour is covered by the risk-engine evaluation suite.

### Residual Risk

Static thresholds may require tuning based on observed legitimate agent behaviour.

---

## 6.9 Behavioural Drift

### Threat

An agent gradually changes its transaction behaviour from its expected baseline.

### Preconditions

- Historical agent behaviour exists.
- New requests differ significantly from previous behaviour.

### Security Invariant

Significant behavioural deviation must increase the agent's risk and may require review or restriction.

### Mitigation

Vanguard evaluates behavioural signals and maintains an agent-level risk state.

Agent risk states include:

- `ACTIVE`
- `WATCH`
- `RESTRICTED`
- `QUARANTINED`

### Test

Agent-risk tests verify state transitions for clean, watch, restricted, and quarantined event histories.

### Residual Risk

Behavioural baselines may produce false positives when legitimate agent behaviour changes.

---

## 6.10 Agent Quarantine

### Threat

A high-risk agent continues attempting financial actions after repeated security violations.

### Preconditions

- The agent generates repeated blocked or suspicious payment requests.

### Attack

The agent continues requesting payments after its behaviour indicates compromise.

### Security Invariant

A quarantined agent must not be able to execute payments.

### Mitigation

Repeated security violations increase the agent risk state.

A `QUARANTINED` agent is blocked by the payment execution service.

### Test

The API security test suite verifies that a quarantined agent cannot execute a payment and cannot create a transaction.

### Residual Risk

Agent-state persistence and recovery policies require additional lifecycle controls.

---

## 6.11 Payment Execution Bypass

### Threat

An attacker attempts to bypass Vanguard's risk decision and directly trigger payment execution.

### Preconditions

- The attacker can reach the payment execution API.
- The attacker attempts to submit or modify a payment request.

### Security Invariant

Only an `ALLOW` decision with an `APPROVED` payment intent may execute.

### Mitigation

The backend payment execution service independently checks:

1. Payment intent existence
2. Agent state
3. Risk decision
4. Payment approval state
5. Existing transaction

The frontend is therefore not the final security boundary.

### Test

The API security test suite verifies:

- BLOCK cannot execute
- REVIEW cannot execute
- ALLOW + APPROVED can execute
- duplicate execution is rejected
- quarantined agents cannot execute

### Residual Risk

Future payment providers must remain behind the same server-side authorization boundary.
---

# 7. Security Invariants

The following invariants define security properties that must always hold regardless of whether the request originates from a legitimate agent, a compromised agent, a malicious prompt, or an attacker-controlled client.

## SI-01 — BLOCK Cannot Execute

A payment with a final decision of `BLOCK` must never execute.

**Required property:**

```text
decision = BLOCK
        ↓
no payment execution
        ↓
no transaction created