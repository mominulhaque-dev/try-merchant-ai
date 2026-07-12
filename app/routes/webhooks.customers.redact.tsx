import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";
import {
  prismaComplianceStore,
  redactCustomer,
  extractCustomerId,
} from "../lib/domain/compliance/gdpr.server";

/**
 * GDPR `customers/redact` (docs/24, docs/44) — hard-delete a customer's PII
 * across shop-scoped storage. The app persists no customer-scoped PII today, so
 * this truthfully deletes nothing and records the request; it gains real
 * deletions unchanged once customer tables land. Verified via HMAC, audited,
 * idempotent; 500 on failure so Shopify retries.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  try {
    const customerId = extractCustomerId(payload);
    const result = await redactCustomer(prismaComplianceStore(db), shop, customerId);
    log.info("gdpr.customer_redact", {
      topic,
      customerId: result.customerId,
      piiRecordsDeleted: result.piiRecordsDeleted,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    log.error("gdpr.customer_redact.failed", { err: AppError.from(error, traceId), topic });
    return new Response("Redaction failed", { status: 500 });
  }
};
