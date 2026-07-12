import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";
import { prismaComplianceStore, redactShop } from "../lib/domain/compliance/gdpr.server";

/**
 * GDPR `shop/redact` (docs/24, docs/44) — fires ≥48h after uninstall. Erase all
 * persisted shop data. Verified via HMAC (`authenticate.webhook`), audited, and
 * idempotent. On failure we return 500 so Shopify retries (deliveries retry with
 * backoff for ~48h); on success we 200-ack.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  try {
    const result = await redactShop(prismaComplianceStore(db), shop);
    log.info("gdpr.shop_redact", { topic, sessionsDeleted: result.sessionsDeleted });
    return new Response(null, { status: 200 });
  } catch (error) {
    log.error("gdpr.shop_redact.failed", { err: AppError.from(error, traceId), topic });
    return new Response("Redaction failed", { status: 500 });
  }
};
