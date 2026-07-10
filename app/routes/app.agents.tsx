import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { ALL_AGENT_SPECS } from "../lib/agents/specs";
import type { TrustLevel } from "../lib/domain/enums";

/**
 * Agents — the fleet overview (docs/10 IA, docs/16). Read-only capability view
 * sourced from the declarative AgentSpec registry. Per-shop state (enabled,
 * configured autonomy, usage) overlays this once the DB cutover lands
 * (docs/_IMPLEMENTATION); this page never shows a dead/empty state because the
 * fleet is always known.
 */

const TRUST_LABELS: Record<TrustLevel, string> = {
  SUGGEST: "Suggest only",
  DRAFT: "Draft changes",
  APPROVE: "Approve to execute",
  AUTO_REVERSIBLE: "Auto (reversible)",
  AUTO_GUARDED: "Auto (guarded)",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const agents = ALL_AGENT_SPECS.map((spec) => ({
    id: spec.id,
    displayName: spec.displayName,
    responsibilities: spec.responsibilities,
    outOfScope: spec.outOfScope,
    defaultTrustLevel: spec.defaultTrustLevel,
    maxTrustLevel: spec.maxTrustLevel,
    toolCount: spec.tools.length,
    dailyAAC: spec.budget.dailyAAC,
  }));

  return { agents };
};

export default function AgentsPage() {
  const { agents } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Agents">
      <s-section heading="Your AI operations team">
        <s-paragraph>
          {agents.length} specialized agents work across your store. Each one has a
          single responsibility, an explicit tool allowlist, and an autonomy level
          you control. New capabilities always start at “Suggest” and only act with
          your permission.
        </s-paragraph>
      </s-section>

      {agents.map((agent) => (
        <s-section key={agent.id} heading={agent.displayName}>
          <s-stack direction="block" gap="base">
            <s-box>
              <s-text>Default autonomy: </s-text>
              <s-text>{TRUST_LABELS[agent.defaultTrustLevel]}</s-text>
              <s-text> · Max autonomy: </s-text>
              <s-text>{TRUST_LABELS[agent.maxTrustLevel]}</s-text>
              <s-text> · Tools: </s-text>
              <s-text>{String(agent.toolCount)}</s-text>
              <s-text> · Daily credit budget: </s-text>
              <s-text>{String(agent.dailyAAC)}</s-text>
            </s-box>

            <s-heading>Responsibilities</s-heading>
            <s-unordered-list>
              {agent.responsibilities.map((item, i) => (
                <s-list-item key={i}>{item}</s-list-item>
              ))}
            </s-unordered-list>

            <s-heading>Out of scope</s-heading>
            <s-unordered-list>
              {agent.outOfScope.map((item, i) => (
                <s-list-item key={i}>{item}</s-list-item>
              ))}
            </s-unordered-list>
          </s-stack>
        </s-section>
      ))}

      <s-section slot="aside" heading="How autonomy works">
        <s-paragraph>
          Agents operate on a trust ladder: Suggest → Draft → Approve → Auto
          (reversible) → Auto (guarded). Every action they take is previewed,
          reversible or explicitly confirmed, and recorded in an audit log.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
