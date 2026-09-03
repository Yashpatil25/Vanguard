import { evaluateAgentRisk } from "./agent-risk.js";

const now = Date.now();

const scenarios = {
  clean: [
    {
      riskScore: 10,
      decision: "ALLOW" as const,
      createdAt: new Date(now - 60_000),
    },
    {
      riskScore: 20,
      decision: "ALLOW" as const,
      createdAt: new Date(now - 120_000),
    },
  ],

  watch: [
    {
      riskScore: 85,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 60_000),
    },
  ],

  restricted: [
    {
      riskScore: 85,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 60_000),
    },
    {
      riskScore: 90,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 120_000),
    },
  ],

  quarantined: [
    {
      riskScore: 85,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 60_000),
    },
    {
      riskScore: 90,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 120_000),
    },
    {
      riskScore: 95,
      decision: "BLOCK" as const,
      createdAt: new Date(now - 180_000),
    },
  ],
};

for (const [name, events] of Object.entries(scenarios)) {
  const state = evaluateAgentRisk(events);

  console.log(`${name}: ${state}`);
}