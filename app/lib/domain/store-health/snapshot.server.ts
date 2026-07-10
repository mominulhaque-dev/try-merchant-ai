import type { ProductSnapshot, StoreSnapshot } from "./types";

/**
 * Build a bounded {@link StoreSnapshot} from the Admin GraphQL API (docs/22).
 *
 * This is a *quick* scan: it samples the catalog (default 50 products) so the
 * dashboard stays fast and never issues N+1 or full-catalog queries (docs/33,
 * docs/14 huge-catalog edge). The heavier, queued, full Store Health scan
 * (M1.T5) reuses the same pure scorer over a persisted snapshot; this read path
 * is the interactive, cache-free fallback until that lands.
 *
 * It performs only authorized reads via the caller's authenticated admin client
 * and never mutates the store.
 */

/** The subset of the Shopify admin GraphQL client we depend on (docs/22). */
export interface AdminGraphqlClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}

export interface SnapshotOptions {
  /** Max products to sample. Bounded for latency; defaults to 50. */
  readonly sampleSize?: number;
  /** ISO capture time, injected by the caller (no clock in the domain layer). */
  readonly capturedAt: string;
  readonly shopDomain: string;
}

const DEFAULT_SAMPLE = 50;
const MAX_SAMPLE = 100;
/** Images sampled per product for the alt-text check (bounds payload size). */
const IMAGES_PER_PRODUCT = 10;
/** Variants sampled per product for the inventory rollup. */
const VARIANTS_PER_PRODUCT = 50;

const SNAPSHOT_QUERY = `#graphql
  query StoreHealthSnapshot($first: Int!, $images: Int!, $variants: Int!) {
    productsCount { count }
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        descriptionHtml
        seo { title description }
        totalInventory
        media(first: $images) {
          nodes {
            mediaContentType
            ... on MediaImage { id alt }
          }
        }
        variants(first: $variants) { nodes { id } }
      }
    }
  }`;

/* ------------------------------------------------------ Response shapes --- */

interface RawSeo {
  title: string | null;
  description: string | null;
}
interface RawMediaNode {
  mediaContentType?: string;
  id?: string;
  alt?: string | null;
}
interface RawProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml: string | null;
  seo: RawSeo | null;
  totalInventory: number | null;
  media: { nodes: RawMediaNode[] } | null;
  variants: { nodes: { id: string }[] } | null;
}
interface RawSnapshotResponse {
  data?: {
    productsCount?: { count: number } | null;
    products?: { nodes: RawProduct[] } | null;
  };
}

/** Strip HTML tags to measure real copy length (not markup) for the content check. */
function plainTextLength(html: string | null): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function toProductSnapshot(raw: RawProduct): ProductSnapshot {
  const mediaNodes = raw.media?.nodes ?? [];
  // Only image media are relevant to image count + alt-text scoring.
  const imageNodes = mediaNodes.filter((m) => m.mediaContentType === "IMAGE");
  const imagesMissingAlt = imageNodes.reduce(
    (n, m) => n + (m.alt && m.alt.trim().length > 0 ? 0 : 1),
    0,
  );
  return {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    status: (raw.status ?? "").toUpperCase(),
    descriptionLength: plainTextLength(raw.descriptionHtml),
    hasSeoTitle: Boolean(raw.seo?.title && raw.seo.title.trim().length > 0),
    hasSeoDescription: Boolean(
      raw.seo?.description && raw.seo.description.trim().length > 0,
    ),
    imageCount: imageNodes.length,
    imagesMissingAlt,
    totalInventory: raw.totalInventory,
    variantCount: raw.variants?.nodes.length ?? 0,
  };
}

/**
 * Capture a bounded store snapshot. Throws on transport/GraphQL failure so the
 * caller (loader) maps it to a section-level error (docs/40); it never returns a
 * partially-fabricated snapshot.
 */
export async function captureStoreSnapshot(
  admin: AdminGraphqlClient,
  options: SnapshotOptions,
): Promise<StoreSnapshot> {
  const first = Math.min(Math.max(1, options.sampleSize ?? DEFAULT_SAMPLE), MAX_SAMPLE);

  const response = await admin.graphql(SNAPSHOT_QUERY, {
    variables: {
      first,
      images: IMAGES_PER_PRODUCT,
      variants: VARIANTS_PER_PRODUCT,
    },
  });
  const body = (await response.json()) as RawSnapshotResponse;
  const rawProducts = body.data?.products?.nodes ?? [];
  const totalProducts = body.data?.productsCount?.count ?? rawProducts.length;

  return {
    shopDomain: options.shopDomain,
    totalProducts,
    products: rawProducts.map(toProductSnapshot),
    capturedAt: options.capturedAt,
  };
}
