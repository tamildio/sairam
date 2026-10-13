import type { Handler } from "@netlify/functions";

// Thin proxy in front of a single Airtable table. Keeps the Personal Access
// Token server-side; the browser only ever talks to this function.
const AIRTABLE_API_URL = "https://api.airtable.com/v0";

const airtableRequest = async (path: string, init: RequestInit = {}) => {
  const pat = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "RentReceipts";

  if (!pat || !baseId) {
    throw new Error("Missing AIRTABLE_PAT or AIRTABLE_BASE_ID environment variables");
  }

  const res = await fetch(`${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(table)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message || `Airtable request failed (${res.status})`);
  }
  return body;
};

const toRecord = (r: { id: string; fields: Record<string, unknown>; createdTime: string }) => ({
  id: r.id,
  created_at: r.createdTime,
  ...r.fields,
});

const RECORD_TYPES = ["receipt", "eb_bill_paid", "eb_bill_aggregate", "eb_used_aggregate"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Optional server-side narrowing so the browser doesn't have to download (and
// Airtable doesn't have to paginate through) the whole table:
//   types=receipt,eb_bill_paid   since=YYYY-MM-DD   until=YYYY-MM-DD (both inclusive, on receipt_date)
const buildFilter = (params: Record<string, string | undefined>) => {
  const clauses: string[] = [];

  const types = params.types?.split(",").filter((t) => RECORD_TYPES.includes(t)) ?? [];
  if (types.length > 0) {
    clauses.push(`OR(${types.map((t) => `{record_type}='${t}'`).join(",")})`);
  }
  if (params.since && ISO_DATE.test(params.since)) {
    clauses.push(`NOT(IS_BEFORE({receipt_date},'${params.since}'))`);
  }
  if (params.until && ISO_DATE.test(params.until)) {
    clauses.push(`NOT(IS_AFTER({receipt_date},'${params.until}'))`);
  }

  return clauses.length > 0 ? `AND(${clauses.join(",")})` : undefined;
};

// Fetches matching rows, following Airtable's 100-record pagination.
const listAll = async (filterByFormula?: string) => {
  const records: ReturnType<typeof toRecord>[] = [];
  let offset: string | undefined;
  do {
    const query = new URLSearchParams();
    if (filterByFormula) query.set("filterByFormula", filterByFormula);
    if (offset) query.set("offset", offset);
    const qs = query.toString();
    const page = await airtableRequest(qs ? `?${qs}` : "");
    records.push(...page.records.map(toRecord));
    offset = page.offset;
  } while (offset);
  return records;
};

export const handler: Handler = async (event) => {
  const id = event.queryStringParameters?.id;

  try {
    switch (event.httpMethod) {
      case "GET": {
        if (id) {
          const record = await airtableRequest(`/${id}`);
          return { statusCode: 200, body: JSON.stringify(toRecord(record)) };
        }
        const records = await listAll(buildFilter(event.queryStringParameters ?? {}));
        return { statusCode: 200, body: JSON.stringify(records) };
      }

      case "POST": {
        const fields = JSON.parse(event.body || "{}");
        const record = await airtableRequest("", {
          method: "POST",
          body: JSON.stringify({ fields }),
        });
        return { statusCode: 201, body: JSON.stringify(toRecord(record)) };
      }

      case "PATCH": {
        if (!id) return { statusCode: 400, body: "Missing id" };
        const fields = JSON.parse(event.body || "{}");
        const record = await airtableRequest(`/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ fields }),
        });
        return { statusCode: 200, body: JSON.stringify(toRecord(record)) };
      }

      case "DELETE": {
        if (!id) return { statusCode: 400, body: "Missing id" };
        await airtableRequest(`/${id}`, { method: "DELETE" });
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }

      default:
        return { statusCode: 405, body: "Method not allowed" };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
    };
  }
};
