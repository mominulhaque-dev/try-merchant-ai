import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { captureStoreSnapshot, scoreSnapshot } from "../lib/domain/store-health";
import type { HealthReport } from "../lib/domain/store-health";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";
import type { Severity } from "../lib/domain/enums";

/**
 * Home / Dashboard (docs/14) — the merchant's daily surface. Replaces the
 * Shopify template demo. It answers "Is my store healthy? What should I do next?"
 * from a real, bounded Store Health quick scan (docs/07 F-01) run server-side in
 * the loader. States follow docs/14: first-run (no products), healthy (no
 * findings), steady (findings list), and section-level error (scan failed) —
 * never a blank page (docs/40). The heavier queued scan + ROI/history sections
 * land with M1.T5/M1.T7 and the DB cutover.
 */

interface DashboardData {
  shop: string;
  report: HealthReport | null;
  scanError: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop: session.shop });

  try {
    const snapshot = await captureStoreSnapshot(admin, {
      shopDomain: session.shop,
      capturedAt: new Date().toISOString(),
    });
    const report = scoreSnapshot(snapshot);
    log.info("dashboard.scan.ok", {
      overallScore: report.overallScore,
      findings: report.findings.length,
      sample: report.sampleSize,
    });
    return { shop: session.shop, report, scanError: false } satisfies DashboardData;
  } catch (error) {
    log.error("dashboard.scan.failed", { err: AppError.from(error, traceId) });
    return { shop: session.shop, report: null, scanError: true } satisfies DashboardData;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // "Run scan" re-runs the quick scan on demand (docs/14). The queued background
  // scan (docs/17, M1.T5) supersedes this once the worker + DB land.
  const { admin, session } = await authenticate.admin(request);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop: session.shop });

  try {
    const snapshot = await captureStoreSnapshot(admin, {
      shopDomain: session.shop,
      capturedAt: new Date().toISOString(),
    });
    const report = scoreSnapshot(snapshot);
    log.info("dashboard.rescan.ok", { overallScore: report.overallScore });
    return { report, scanError: false };
  } catch (error) {
    log.error("dashboard.rescan.failed", { err: AppError.from(error, traceId) });
    return { report: null, scanError: true };
  }
};

/* --------------------------------------------------------------- View --- */

/** Valid `s-badge` tones (subset of Polaris badge tones we use). */
type BadgeTone = "info" | "success" | "warning" | "critical";

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  CRITICAL: "critical",
  HIGH: "warning",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "info",
};

function scoreTone(score: number): BadgeTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "critical";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Needs attention";
  return "At risk";
}

function formatAsOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const DOMAIN_LABELS: Record<string, string> = {
  seo: "SEO",
  cro: "Conversion",
  content: "Content",
  catalog: "Catalog",
  performance: "Performance",
  inventory: "Inventory",
};

export default function Dashboard() {
  const initial = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isScanning =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Prefer a fresh re-scan result over the initial loader snapshot.
  const report = fetcher.data?.report ?? initial.report;
  const scanError = fetcher.data ? fetcher.data.scanError : initial.scanError;

  useEffect(() => {
    if (fetcher.data && !fetcher.data.scanError) {
      shopify.toast.show("Store Health scan complete");
    }
  }, [fetcher.data, shopify]);

  const runScan = () => fetcher.submit({}, { method: "POST" });

  const storeName = initial.shop.replace(/\.myshopify\.com$/, "");

  return (
    <s-page heading="Store Health">
      <s-button
        slot="primary-action"
        onClick={runScan}
        {...(isScanning ? { loading: true } : {})}
      >
        Run scan
      </s-button>

      <s-section heading={`Welcome back, ${storeName}`}>
        <s-paragraph>
          TryMerchantAI continuously checks your store for issues that cost you
          sales and ranking, then hands you the highest-impact fixes first.
        </s-paragraph>
        {report && (
          <s-text color="subdued">
            As of {formatAsOf(report.capturedAt)} · sampled {report.sampleSize} of{" "}
            {report.totalProducts} products
          </s-text>
        )}
      </s-section>

      {scanError && <ScanErrorSection onRetry={runScan} scanning={isScanning} />}

      {!scanError && report && report.totalProducts === 0 && <FirstRunSection />}

      {!scanError && report && report.totalProducts > 0 && (
        <>
          <HealthScoreSection report={report} />
          {report.findings.length > 0 ? (
            <TopFindingsSection report={report} />
          ) : (
            <HealthySection />
          )}
        </>
      )}

      <s-section slot="aside" heading="How scoring works">
        <s-paragraph>
          Your health score is a weighted blend of the domains we can assess from
          your catalog — SEO, content, catalog quality, and inventory. Each
          finding is ranked by impact, confidence, and how easy it is to fix.
        </s-paragraph>
        <s-paragraph color="subdued">
          Deeper conversion and performance checks activate as more of your store
          connects.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

function HealthScoreSection({ report }: { report: HealthReport }) {
  return (
    <s-section heading="Health score">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-badge tone={scoreTone(report.overallScore)} size="large">
            {String(report.overallScore)}/100
          </s-badge>
          <s-text>{scoreLabel(report.overallScore)}</s-text>
        </s-stack>

        <s-stack direction="block" gap="small-300">
          {report.domainScores.map((ds) => (
            <s-box key={ds.domain}>
              <s-text>{DOMAIN_LABELS[ds.domain] ?? ds.domain}: </s-text>
              <s-badge tone={scoreTone(ds.score)}>{String(ds.score)}</s-badge>
              {ds.findingCount > 0 && (
                <s-text color="subdued">
                  {" "}
                  · {ds.findingCount} issue{ds.findingCount === 1 ? "" : "s"}
                </s-text>
              )}
            </s-box>
          ))}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function TopFindingsSection({ report }: { report: HealthReport }) {
  const top = report.findings.slice(0, 5);
  return (
    <s-section heading="What to fix next">
      <s-stack direction="block" gap="base">
        {top.map((f) => (
          <s-box
            key={f.id}
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="small-300">
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <s-badge tone={SEVERITY_TONE[f.severity]}>{f.severity}</s-badge>
                <s-heading>{f.title}</s-heading>
              </s-stack>
              <s-paragraph>{f.rationale}</s-paragraph>
              <s-text color="subdued">
                Affects {f.affectedCount} of {f.sampleSize} sampled ·{" "}
                {DOMAIN_LABELS[f.domain] ?? f.domain}
              </s-text>
            </s-stack>
          </s-box>
        ))}
        {report.findings.length > top.length && (
          <s-text color="subdued">
            +{report.findings.length - top.length} more finding
            {report.findings.length - top.length === 1 ? "" : "s"}
          </s-text>
        )}
        <s-box>
          <s-link href="/app/findings">Review &amp; fix all findings</s-link>
        </s-box>
      </s-stack>
    </s-section>
  );
}

function HealthySection() {
  return (
    <s-section heading="Your store looks healthy">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          No issues in this scan of your catalog. We&apos;ll keep monitoring and
          surface anything worth your attention here.
        </s-paragraph>
      </s-stack>
    </s-section>
  );
}

function FirstRunSection() {
  return (
    <s-section heading="Add products to get started">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Your store doesn&apos;t have any products yet. Once you add products,
          run a Store Health scan and TryMerchantAI will surface the
          highest-impact improvements across SEO, content, catalog, and
          inventory.
        </s-paragraph>
        <s-box>
          <s-link href="shopify://admin/products/new" target="_top">
            Add your first product
          </s-link>
        </s-box>
      </s-stack>
    </s-section>
  );
}

function ScanErrorSection({
  onRetry,
  scanning,
}: {
  onRetry: () => void;
  scanning: boolean;
}) {
  return (
    <s-section heading="We couldn't complete the scan">
      <s-stack direction="block" gap="base">
        <s-banner tone="critical" heading="Store Health scan failed">
          <s-paragraph>
            Something went wrong reading your store. Your data is unchanged. Try
            running the scan again.
          </s-paragraph>
        </s-banner>
        <s-box>
          <s-button onClick={onRetry} {...(scanning ? { loading: true } : {})}>
            Try again
          </s-button>
        </s-box>
      </s-stack>
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
