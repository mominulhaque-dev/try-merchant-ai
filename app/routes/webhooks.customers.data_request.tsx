import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";
import {
  prismaComplianceStore,
  collectCustomerData,
  extractCustomerId,
  extractDataRequestId,
} from "../lib/domain/compliance/gdpr.server";

/**
 * GDPR `customers/data_request` (docs/24, docs/44) — compile the data we hold on
 * a customer so the merchant can provide it. The app minimizes PII and persists
 * no customer-scoped data today, so this returns an empty record set and audits
 * the request (the merchant is thereby informed that no data is held). Verified
 * via HMAC, audited, idempotent; 500 on failure so Shopify retries.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  try {
    const customerId = extractCustomerId(payload);
    const result = await collectCustomerData(prismaComplianceStore(db), shop, customerId);
    log.info("gdpr.customer_data_request", {
      topic,
      customerId: result.customerId,
      dataRequestId: extractDataRequestId(payload),
      recordsHeld: result.records.length,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    log.error("gdpr.customer_data_request.failed", { err: AppError.from(error, traceId), topic });
    return new Response("Data request failed", { status: 500 });
  }
};
