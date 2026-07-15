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

// Fetches every row in the table, following Airtable's 100-record pagination.
const listAll = async () => {
  const records: ReturnType<typeof toRecord>[] = [];
  let offset: string | undefined;
  do {
    const query = offset ? `?offset=${encodeURIComponent(offset)}` : "";
    const page = await airtableRequest(query);
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
        const records = await listAll();
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
