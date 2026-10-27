// Client for the Netlify function that proxies Airtable (see netlify/functions/records.ts).
// The Airtable token never reaches the browser.
const RECORDS_ENDPOINT = "/api/records";

// Distinguishes a real tenant receipt from the auto-generated monthly rollups.
// Stored as its own field so aggregate rows don't have to be identified by
// magic tenant_name strings ("Tenant EB bill", "Tenant EB Used", ...).
export type RecordType = "receipt" | "eb_bill_paid" | "eb_bill_aggregate" | "eb_used_aggregate";

export interface ReceiptRecord {
  id: string;
  receipt_date: string;
  tenant_name: string;
  record_type: RecordType;
  eb_reading_last_month: number;
  eb_reading_this_month: number;
  eb_rate_per_unit: number;
  units_consumed: number;
  eb_charges: number;
  rent_amount: number;
  total_amount: number;
  received_date: string | null;
  payment_mode: string | null;
  include_in_eb_used?: boolean | null;
  receipts_count?: number | null;
  // Which EB service/meter this bill payment belongs to (only set on eb_bill_paid rows).
  consumer_number?: string | null;
  receipt_no?: string | null;
  created_at: string;
}

export interface ReceiptData {
  receipt_date: string;
  tenant_name: string;
  record_type?: RecordType;
  eb_reading_last_month: number;
  eb_reading_this_month: number;
  eb_rate_per_unit: number;
  units_consumed: number;
  eb_charges: number;
  rent_amount: number;
  total_amount: number;
  received_date?: string | null;
  payment_mode?: string | null;
  include_in_eb_used?: boolean | null;
  receipts_count?: number | null;
  consumer_number?: string | null;
  receipt_no?: string | null;
}

// Short-lived browser cache for list reads, so reloads and tab switches don't each cost
// Airtable API calls. Any write through this client clears it, so this device never
// shows stale data after its own changes; changes made from another device show up
// once the entry expires.
const CACHE_PREFIX = "sairam:list:";
const CACHE_TTL_MS = 5 * 60 * 1000;

const readCache = (key: string): ReceiptRecord[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { at, records } = JSON.parse(raw);
    return Date.now() - at < CACHE_TTL_MS ? records : null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, records: ReceiptRecord[]) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), records }));
  } catch {
    // Storage full or unavailable - just skip caching.
  }
};

const inFlight = new Map<string, Promise<ReceiptRecord[]>>();

export const clearListCache = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
};

const request = async (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  { id, body, query }: { id?: string; body?: unknown; query?: string } = {}
) => {
  const url = id
    ? `${RECORDS_ENDPOINT}?id=${encodeURIComponent(id)}`
    : query
      ? `${RECORDS_ENDPOINT}?${query}`
      : RECORDS_ENDPOINT;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error || `Request failed (${res.status})`);
  }
  if (method !== "GET") clearListCache();
  return res.json();
};

// Airtable tables can end up with stray blank rows (e.g. default rows left over
// from table creation). Every real row - receipt or aggregate - always has both
// of these fields, so use that to filter out junk rows before they reach any
// sorting/aggregation logic.
const isCompleteReceipt = (r: ReceiptRecord) => Boolean(r.record_type && r.receipt_date);

export interface ListFilter {
  types?: RecordType[];
  since?: string; // YYYY-MM-DD, inclusive, on receipt_date
  until?: string; // YYYY-MM-DD, inclusive, on receipt_date
  tenant?: string; // exact tenant_name
  latest?: number; // only the N newest rows (by receipt_date)
}

export const listReceipts = async (filter: ListFilter = {}): Promise<ReceiptRecord[]> => {
  const params = new URLSearchParams();
  if (filter.types?.length) params.set("types", filter.types.join(","));
  if (filter.since) params.set("since", filter.since);
  if (filter.until) params.set("until", filter.until);
  if (filter.tenant) params.set("tenant", filter.tenant);
  if (filter.latest) params.set("latest", String(filter.latest));
  const qs = params.toString();

  const cached = readCache(qs);
  if (cached) return cached;

  // Identical requests made at the same moment (e.g. two components mounting together)
  // share one network call instead of each missing the cache.
  const pending = inFlight.get(qs);
  if (pending) return pending;

  const fetching = request("GET", { query: qs })
    .then((rows: ReceiptRecord[]) => {
      const records = rows.filter(isCompleteReceipt);
      writeCache(qs, records);
      return records;
    })
    .finally(() => inFlight.delete(qs));
  inFlight.set(qs, fetching);
  return fetching;
};

export const listAllReceipts = (): Promise<ReceiptRecord[]> => listReceipts();

export const getReceiptById = (id: string): Promise<ReceiptRecord> => request("GET", { id });

export const insertReceipt = (fields: Partial<ReceiptData>): Promise<ReceiptRecord> =>
  request("POST", { body: fields });

export const patchReceipt = (id: string, fields: Partial<ReceiptData>): Promise<ReceiptRecord> =>
  request("PATCH", { id, body: fields });

export const removeReceipt = (id: string): Promise<{ success: boolean }> => request("DELETE", { id });
