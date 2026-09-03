import {
  AgentRiskEvent,
  AgentRiskState,
} from "./types.js";

export function evaluateAgentRisk(
  events: AgentRiskEvent[]
): AgentRiskState {
  if (events.length === 0) {
    return "ACTIVE";
  }

  const now = Date.now();

  const recentEvents = events.filter((event) => {
    const age = now - event.createdAt.getTime();

    return age >= 0 && age <= 10 * 60 * 1000;
  });

  const blockedEvents = recentEvents.filter(
    (event) => event.decision === "BLOCK"
  );

  const reviewEvents = recentEvents.filter(
    (event) => event.decision === "REVIEW"
  );

  /*
   * Critical containment rule:
   *
   * Multiple blocked financial actions within
   * a short period indicate that the agent may
   * be compromised or behaving outside its
   * intended authority.
   */
  if (blockedEvents.length >= 3) {
    return "QUARANTINED";
  }

  /*
   * Two blocked actions in a short period mean
   * the agent should no longer operate normally.
   */
  if (blockedEvents.length >= 2) {
    return "RESTRICTED";
  }

  /*
   * A single blocked action or multiple reviews
   * place the agent under observation.
   */
  if (
    blockedEvents.length >= 1 ||
    reviewEvents.length >= 2
  ) {
    return "WATCH";
  }

  return "ACTIVE";
}