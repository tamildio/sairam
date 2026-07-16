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
}

const request = async (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  { id, body }: { id?: string; body?: unknown } = {}
) => {
  const url = id ? `${RECORDS_ENDPOINT}?id=${encodeURIComponent(id)}` : RECORDS_ENDPOINT;
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error || `Request failed (${res.status})`);
  }
  if (res.status === 200 && method === "DELETE") return res.json();
  return res.json();
};

// Airtable tables can end up with stray blank rows (e.g. default rows left over
// from table creation). Every real row - receipt or aggregate - always has both
// of these fields, so use that to filter out junk rows before they reach any
// sorting/aggregation logic.
const isCompleteReceipt = (r: ReceiptRecord) => Boolean(r.record_type && r.receipt_date);

export const listAllReceipts = async (): Promise<ReceiptRecord[]> => {
  const records = await request("GET");
  return records.filter(isCompleteReceipt);
};

export const getReceiptById = (id: string): Promise<ReceiptRecord> => request("GET", { id });

export const insertReceipt = (fields: Partial<ReceiptData>): Promise<ReceiptRecord> =>
  request("POST", { body: fields });

export const patchReceipt = (id: string, fields: Partial<ReceiptData>): Promise<ReceiptRecord> =>
  request("PATCH", { id, body: fields });

export const removeReceipt = (id: string): Promise<{ success: boolean }> => request("DELETE", { id });
