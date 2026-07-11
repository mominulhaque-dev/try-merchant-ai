import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { captureStoreSnapshot, scoreSnapshot } from "../lib/domain/store-health";
import type { HealthFinding } from "../lib/domain/store-health";
import { isFixable, type FixableActionType } from "../lib/domain/store-health/fix";
import {
  previewFinding,
  executeFinding,
  undoFinding,
  listFixState,
  listActivity,
  type FixState,
  type ActivityEntry,
} from "../lib/domain/store-health/fix.server";
import { resolveEntitlements } from "../lib/security/entitlements.server";
import { assertShop } from "../lib/security/tenant.server";
import { planSatisfies, type Severity } from "../lib/domain/enums";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";

/**
 * Findings (docs/07 F-02, docs/14, docs/16) — the merchant reviews prioritized
 * Store-Health findings and drives each fixable one through the action
 * pipeline's reversibility spine: preview → approve → execute → undo. Nothing
 * mutates the store without an explicit approval of the preview. Fix state is
 * process-scoped (in-memory adapters) until the DB cutover (M0.T7) makes it
 * durable; the loop and its guardrails are already real.
 */

/* ---------------------------------------------------------------- Loader -- */

interface FindingsData {
  shop: string;
  findings: HealthFinding[];
  fixState: Record<string, FixState>;
  activity: ActivityEntry[];
  fixesEnabled: boolean;
  scanError: boolean;
  totalProducts: number;
  sampleSize: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = assertShop(session.shop);
  const entitlements = resolveEntitlements(session);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  const fixesEnabled =
    entitlements.grantedScopes.includes("write_products") &&
    planSatisfies(entitlements.plan, "GROWTH");

  try {
    const snapshot = await captureStoreSnapshot(admin, {
      shopDomain: shop,
      capturedAt: new Date().toISOString(),
    });
    const report = scoreSnapshot(snapshot);
    const fixState = await listFixState(shop);
    log.info("findings.loaded", { findings: report.findings.length });
    return {
      shop,
      findings: [...report.findings],
      fixState,
      activity: listActivity(shop),
      fixesEnabled,
      scanError: false,
      totalProducts: report.totalProducts,
      sampleSize: report.sampleSize,
    } satisfies FindingsData;
  } catch (error) {
    log.error("findings.scan_failed", { err: AppError.from(error, traceId) });
    return {
      shop,
      findings: [] as HealthFinding[],
      fixState: {} as Record<string, FixState>,
      activity: listActivity(shop),
      fixesEnabled,
      scanError: true,
      totalProducts: 0,
      sampleSize: 0,
    } satisfies FindingsData;
  }
};

/* ---------------------------------------------------------------- Action -- */

interface DiffView {
  fields: Array<{ key: string; before: string; after: string }>;
  summary: string;
  itemCount?: number;
}

type FindingActionResult =
  | {
      ok: true;
      intent: "preview";
      findingId: string;
      actionId: string;
      status: "PREVIEWED";
      diff: DiffView;
      requiresApproval: boolean;
    }
  | { ok: true; intent: "execute"; findingId: string; actionId: string; status: "DONE" }
  | { ok: true; intent: "undo"; findingId: string; actionId: string; status: "REVERTED" }
  | { ok: false; intent: string; findingId: string; error: { code: string; message: string } };

function fail(
  intent: string,
  findingId: string,
  error: AppError,
): FindingActionResult {
  return { ok: false, intent, findingId, error: { code: error.code, message: error.message } };
}

function num(form: FormData, key: string): number {
  const n = Number(form.get(key));
  return Number.isFinite(n) ? n : 0;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<FindingActionResult> => {
  const { session } = await authenticate.admin(request);
  const shop = assertShop(session.shop);
  const entitlements = resolveEntitlements(session);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const findingId = String(form.get("findingId") ?? "");
  const actionTypeRaw = String(form.get("actionType") ?? "");

  if (!isFixable(actionTypeRaw)) {
    return fail(intent, findingId, new AppError("VALIDATION", {
      message: "This finding has no automated fix.",
      traceId,
    }));
  }
  const actionType: FixableActionType = actionTypeRaw;

  try {
    if (intent === "preview") {
      const finding: HealthFinding = {
        id: findingId,
        domain: String(form.get("domain") ?? "seo") as HealthFinding["domain"],
        severity: String(form.get("severity") ?? "MEDIUM") as Severity,
        title: String(form.get("title") ?? ""),
        rationale: String(form.get("rationale") ?? ""),
        actionType,
        effort: num(form, "effort"),
        affectedCount: num(form, "affectedCount"),
        sampleSize: num(form, "sampleSize"),
        priority: num(form, "priority"),
      };
      const result = await previewFinding({ shop, entitlements, finding, traceId });
      if (!result.ok) return fail("preview", findingId, result.error);
      const { action: stored, diff, requiresApproval } = result.value;
      log.info("findings.preview.ok", { actionId: stored.id });
      return {
        ok: true,
        intent: "preview",
        findingId,
        actionId: stored.id,
        status: "PREVIEWED",
        requiresApproval,
        diff: {
          summary: diff.summary,
          itemCount: diff.itemCount,
          fields: diff.fields.map((f) => ({
            key: f.key,
            before: String(f.before),
            after: String(f.after),
          })),
        },
      };
    }

    const actionId = String(form.get("actionId") ?? "");
    if (!actionId) {
      return fail(intent, findingId, new AppError("VALIDATION", { traceId }));
    }

    if (intent === "execute") {
      const result = await executeFinding({ shop, entitlements, actionType, actionId, traceId });
      if (!result.ok) return fail("execute", findingId, result.error);
      log.info("findings.execute.ok", { actionId });
      return { ok: true, intent: "execute", findingId, actionId, status: "DONE" };
    }

    if (intent === "undo") {
      const result = await undoFinding({ shop, entitlements, actionType, actionId, traceId });
      if (!result.ok) return fail("undo", findingId, result.error);
      log.info("findings.undo.ok", { actionId });
      return { ok: true, intent: "undo", findingId, actionId, status: "REVERTED" };
    }

    return fail(intent, findingId, new AppError("VALIDATION", {
      message: "Unknown action.",
      traceId,
    }));
  } catch (error) {
    const appError = AppError.from(error, traceId);
    log.error("findings.action_failed", { err: appError, intent });
    return fail(intent, findingId, appError);
  }
};

/* ------------------------------------------------------------------ View -- */

type BadgeTone = "info" | "success" | "warning" | "critical";

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  CRITICAL: "critical",
  HIGH: "warning",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "info",
};

const DOMAIN_LABELS: Record<string, string> = {
  seo: "SEO",
  cro: "Conversion",
  content: "Content",
  catalog: "Catalog",
  performance: "Performance",
  inventory: "Inventory",
};

export default function FindingsPage() {
  const data = useLoaderData<typeof loader>();

  const fixable = data.findings.filter((f) => isFixable(f.actionType));
  const advisory = data.findings.filter((f) => !isFixable(f.actionType));

  return (
    <s-page heading="Findings">
      <s-section heading="Review and fix">
        <s-paragraph>
          Each finding is ranked by impact, confidence, and effort. Fixable items
          run through a safe pipeline — you preview the change, approve it, and can
          undo it at any time. Nothing is written to your store without your
          approval.
        </s-paragraph>
        <s-text color="subdued">
          Sampled {data.sampleSize} of {data.totalProducts} products
        </s-text>
      </s-section>

      {data.scanError && (
        <s-section heading="We couldn't complete the scan">
          <s-banner tone="critical" heading="Store Health scan failed">
            <s-paragraph>
              Something went wrong reading your store. Your data is unchanged.
              Reload to try again.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {!data.fixesEnabled && !data.scanError && data.findings.length > 0 && (
        <s-section heading="Fixes are read-only for now">
          <s-banner tone="info" heading="Automated fixes need write access and a plan">
            <s-paragraph>
              You can review every finding below. Applying fixes requires the
              product write permission and the Growth plan or higher.
            </s-paragraph>
          </s-banner>
        </s-section>
      )}

      {!data.scanError && data.findings.length === 0 && (
        <s-section heading="No findings">
          <s-paragraph>
            This scan found no issues in your catalog. New findings appear here as
            your store changes.
          </s-paragraph>
        </s-section>
      )}

      {fixable.length > 0 && (
        <s-section heading="Fixable findings">
          <s-stack direction="block" gap="base">
            {fixable.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                initial={data.fixState[f.id]}
                fixesEnabled={data.fixesEnabled}
              />
            ))}
          </s-stack>
        </s-section>
      )}

      {advisory.length > 0 && (
        <s-section heading="Advisory findings">
          <s-stack direction="block" gap="base">
            {advisory.map((f) => (
              <AdvisoryRow key={f.id} finding={f} />
            ))}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="Recent activity">
        {data.activity.length === 0 ? (
          <s-paragraph color="subdued">
            Previews, fixes, and undos you run will be recorded here with a full
            audit trail.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="small-300">
            {data.activity.map((a) => (
              <s-text key={a.seq} color="subdued">
                {a.event}
                {a.target ? ` · ${a.target}` : ""}
              </s-text>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

function FindingRow({
  finding,
  initial,
  fixesEnabled,
}: {
  finding: HealthFinding;
  initial?: FixState;
  fixesEnabled: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  let status: string = initial?.status ?? "IDLE";
  let actionId: string | undefined = initial?.actionId;
  let diff: DiffView | undefined;
  let requiresApproval = false;
  let errorMsg: string | undefined;

  if (result) {
    if (result.ok) {
      actionId = result.actionId ?? actionId;
      status = result.status;
      if (result.intent === "preview") {
        diff = result.diff;
        requiresApproval = result.requiresApproval;
      }
    } else {
      errorMsg = result.error.message;
    }
  }

  const actionType = finding.actionType as FixableActionType;

  const submitPreview = () =>
    fetcher.submit(
      {
        intent: "preview",
        findingId: finding.id,
        actionType,
        domain: finding.domain,
        title: finding.title,
        severity: finding.severity,
        rationale: finding.rationale,
        effort: String(finding.effort),
        affectedCount: String(finding.affectedCount),
        sampleSize: String(finding.sampleSize),
        priority: String(finding.priority),
      },
      { method: "POST" },
    );

  const submitExecute = () =>
    fetcher.submit(
      { intent: "execute", findingId: finding.id, actionType, actionId: actionId ?? "" },
      { method: "POST" },
    );

  const submitUndo = () =>
    fetcher.submit(
      { intent: "undo", findingId: finding.id, actionType, actionId: actionId ?? "" },
      { method: "POST" },
    );

  const isPreviewed = status === "PREVIEWED" || status === "APPROVED";
  const isDone = status === "DONE";
  const canPreviewAgain = status === "IDLE" || status === "REVERTED" || status === "FAILED";

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</s-badge>
          <s-heading>{finding.title}</s-heading>
        </s-stack>

        <s-paragraph>{finding.rationale}</s-paragraph>
        <s-text color="subdued">
          Affects {finding.affectedCount} of {finding.sampleSize} sampled ·{" "}
          {DOMAIN_LABELS[finding.domain] ?? finding.domain}
        </s-text>

        {errorMsg && (
          <s-banner tone="critical" heading="Couldn't complete that step">
            <s-paragraph>{errorMsg}</s-paragraph>
          </s-banner>
        )}

        {diff && (
          <s-box padding="small-300" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="small-300">
              <s-text>{diff.summary}</s-text>
              {diff.fields.map((field) => (
                <s-text key={field.key} color="subdued">
                  {field.before} → {field.after}
                </s-text>
              ))}
              {requiresApproval && (
                <s-text color="subdued">Approve to apply this change.</s-text>
              )}
            </s-stack>
          </s-box>
        )}

        <s-stack direction="inline" gap="small-300" alignItems="center">
          {isDone ? (
            <>
              <s-badge tone="success">Fix applied</s-badge>
              <s-button
                onClick={submitUndo}
                {...(busy ? { loading: true } : {})}
              >
                Undo
              </s-button>
            </>
          ) : isPreviewed ? (
            <>
              <s-button
                onClick={submitExecute}
                {...(busy ? { loading: true } : {})}
                {...(fixesEnabled ? {} : { disabled: true })}
              >
                Apply fix
              </s-button>
              <s-button
                onClick={submitPreview}
                {...(busy ? { loading: true } : {})}
              >
                Re-preview
              </s-button>
            </>
          ) : (
            <>
              {status === "REVERTED" && <s-badge tone="info">Reverted</s-badge>}
              <s-button
                onClick={submitPreview}
                {...(busy ? { loading: true } : {})}
                {...(fixesEnabled && canPreviewAgain ? {} : { disabled: true })}
              >
                Preview fix
              </s-button>
            </>
          )}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function AdvisoryRow({ finding }: { finding: HealthFinding }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</s-badge>
          <s-heading>{finding.title}</s-heading>
          <s-badge tone="info">Advisory</s-badge>
        </s-stack>
        <s-paragraph>{finding.rationale}</s-paragraph>
        <s-text color="subdued">
          Affects {finding.affectedCount} of {finding.sampleSize} sampled ·{" "}
          {DOMAIN_LABELS[finding.domain] ?? finding.domain}
        </s-text>
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
