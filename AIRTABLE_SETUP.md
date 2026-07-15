# Airtable + Netlify setup

This app stores data in a single Airtable table, accessed only through a Netlify
Function (`netlify/functions/records.ts`) so the Airtable token never reaches the browser.

## 1. Create the Airtable base

1. Sign up at airtable.com and create a new Base.
2. Create a table named `RentReceipts` (or pick your own name and set `AIRTABLE_TABLE_NAME` below)
   with these fields:

   | Field | Type |
   |---|---|
   | `tenant_name` | Single line text |
   | `receipt_date` | Date (ISO format `YYYY-MM-DD`) |
   | `eb_reading_last_month` | Number (decimal) |
   | `eb_reading_this_month` | Number (decimal) |
   | `eb_rate_per_unit` | Number (decimal) |
   | `units_consumed` | Number (decimal) |
   | `eb_charges` | Number (decimal) |
   | `rent_amount` | Number (decimal) |
   | `total_amount` | Number (decimal) |
   | `received_date` | Date, allow blank |
   | `payment_mode` | Single line text, allow blank |
   | `include_in_eb_used` | Checkbox (default checked) |
   | `receipts_count` | Number (integer), allow blank |

   `id` and `created_at` don't need fields - Airtable provides its own record ID
   and creation time automatically.

## 2. Create a Personal Access Token

Account → **Developer hub → Personal access tokens** → Create new token, scoped to this base, with:
- `data.records:read`
- `data.records:write`

Copy the token (starts with `pat...`) and the **Base ID** (starts with `app...`,
shown on the base's API documentation page).

## 3. Set environment variables

Locally, create `.env` (gitignored) at the repo root:

```
AIRTABLE_PAT=pat...
AIRTABLE_BASE_ID=app...
AIRTABLE_TABLE_NAME=RentReceipts
```

Run with `netlify dev` (not plain `vite dev`) so the Netlify Function has access
to these variables and `/api/records` resolves correctly.

In the Netlify dashboard for the deployed site, set the same three variables under
**Site configuration → Environment variables**.
