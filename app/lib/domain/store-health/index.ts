/**
 * Store Health quick scan (docs/07 F-01, docs/14). Import from here.
 *
 * `captureStoreSnapshot` (server-only) reads a bounded sample from Admin GraphQL;
 * `scoreSnapshot` (pure) turns it into an explainable, prioritized HealthReport.
 */
export { scoreSnapshot } from "./score";
export {
  captureStoreSnapshot,
  type AdminGraphqlClient,
  type SnapshotOptions,
} from "./snapshot.server";
export type {
  StoreSnapshot,
  ProductSnapshot,
  HealthReport,
  HealthFinding,
  DomainScore,
} from "./types";
