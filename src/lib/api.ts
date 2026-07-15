import {
  listAllReceipts,
  getReceiptById,
  insertReceipt,
  patchReceipt,
  removeReceipt,
  ReceiptData,
  ReceiptRecord,
} from "./airtable";

// tenant_name values that are aggregated system records rather than real tenant receipts.
const SYSTEM_RECORD_NAMES = ["EB bill paid", "Tenant EB bill", "Tenant EB Used"];

const monthRange = (receiptDate: string) => {
  const date = new Date(receiptDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    year,
    month,
    startDate: `${year}-${month.toString().padStart(2, "0")}-01`,
    endDate: `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`,
  };
};

const inMonth = (receipt: ReceiptRecord, startDate: string, endDate: string) =>
  receipt.receipt_date >= startDate && receipt.receipt_date <= endDate;

const includedInEbUsed = (receipt: ReceiptRecord) => receipt.include_in_eb_used !== false;

export const fetchReceipts = async (limit?: number, tenant_name?: string) => {
  let receipts = await listAllReceipts();

  if (tenant_name) {
    receipts = receipts.filter((r) => r.tenant_name === tenant_name);
  }

  receipts.sort((a, b) => b.receipt_date.localeCompare(a.receipt_date));

  if (limit) {
    receipts = receipts.slice(0, limit);
  }

  // Ensure all months with tenant receipts have Tenant EB Used records
  try {
    await ensureTenantEbUsedRecords();
  } catch (ensureError) {
    console.error("Error ensuring Tenant EB Used records:", ensureError);
    // Don't throw - fetching receipts was successful, ensuring records is secondary
  }

  return receipts;
};

export const createReceipt = async (receipt: ReceiptData) => {
  const data = await insertReceipt(receipt);

  // Automatically create/update Tenant EB bill and Tenant EB Used for the month
  try {
    await createOrUpdateTenantEbBill(receipt.receipt_date);
  } catch (aggregationError) {
    console.error("Error auto-creating Tenant EB bill:", aggregationError);
  }

  try {
    await createOrUpdateTenantEbUsed(receipt.receipt_date);
  } catch (aggregationError) {
    console.error("Error auto-creating Tenant EB Used:", aggregationError);
  }

  return data;
};

export const updateReceipt = async (id: string, updates: Partial<ReceiptData>) => {
  const data = await patchReceipt(id, updates);

  try {
    await createOrUpdateTenantEbBill(data.receipt_date);
  } catch (aggregationError) {
    console.error("Error auto-updating Tenant EB bill:", aggregationError);
  }

  try {
    await createOrUpdateTenantEbUsed(data.receipt_date);
  } catch (aggregationError) {
    console.error("Error auto-updating Tenant EB Used:", aggregationError);
  }

  return data;
};

export const deleteReceipt = async (id: string) => {
  const receiptToDelete = await getReceiptById(id);
  if (!receiptToDelete) {
    throw new Error("Receipt not found");
  }

  const { receipt_date: receiptDate, tenant_name: tenantName } = receiptToDelete;

  await removeReceipt(id);

  // Recalculate Tenant EB Used for the month, unless the deleted receipt was itself a system record
  if (tenantName && !SYSTEM_RECORD_NAMES.includes(tenantName)) {
    try {
      await createOrUpdateTenantEbUsed(receiptDate);
    } catch (recalcError) {
      console.error("Error recalculating Tenant EB Used after deletion:", recalcError);
    }
  }

  return { success: true };
};

export const createOrUpdateTenantEbBill = async (receiptDate: string) => {
  const { year, month, startDate, endDate } = monthRange(receiptDate);
  const allReceipts = await listAllReceipts();

  const tenantReceipts = allReceipts.filter(
    (r) => r.tenant_name !== "Tenant EB bill" && inMonth(r, startDate, endDate)
  );

  if (tenantReceipts.length === 0) {
    return null;
  }

  const totalUnitsConsumed = tenantReceipts.reduce((sum, r) => sum + r.units_consumed, 0);
  const totalEbCharges = tenantReceipts.reduce((sum, r) => sum + r.eb_charges, 0);
  const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

  const existing = allReceipts.find(
    (r) => r.tenant_name === "Tenant EB bill" && inMonth(r, startDate, endDate)
  );

  const tenantEbBillData: Partial<ReceiptData> = {
    receipt_date: `${year}-${month.toString().padStart(2, "0")}-01`,
    tenant_name: "Tenant EB bill",
    eb_reading_last_month: 0,
    eb_reading_this_month: totalUnitsConsumed,
    eb_rate_per_unit: averageRatePerUnit,
    units_consumed: totalUnitsConsumed,
    eb_charges: totalEbCharges,
    rent_amount: 0,
    total_amount: totalEbCharges,
    received_date: null,
    payment_mode: "aggregated",
  };

  return existing ? patchReceipt(existing.id, tenantEbBillData) : insertReceipt(tenantEbBillData);
};

export const createOrUpdateTenantEbUsed = async (receiptDate: string) => {
  const { year, month, startDate, endDate } = monthRange(receiptDate);
  const allReceipts = await listAllReceipts();

  const tenantReceipts = allReceipts.filter(
    (r) =>
      !SYSTEM_RECORD_NAMES.includes(r.tenant_name) &&
      inMonth(r, startDate, endDate) &&
      includedInEbUsed(r)
  );

  const existingTenantEbUsedRecords = allReceipts.filter(
    (r) => r.tenant_name === "Tenant EB Used" && inMonth(r, startDate, endDate)
  );

  if (tenantReceipts.length === 0) {
    // No tenant receipts left for this month - remove any stale Tenant EB Used record(s)
    for (const record of existingTenantEbUsedRecords) {
      try {
        await removeReceipt(record.id);
      } catch (deleteError) {
        console.error("Error deleting Tenant EB Used record:", deleteError);
      }
    }
    return null;
  }

  const totalUnitsConsumed = tenantReceipts.reduce((sum, r) => sum + r.units_consumed, 0);
  const totalEbCharges = tenantReceipts.reduce((sum, r) => sum + r.eb_charges, 0);
  const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

  const [existingTenantEbUsed, ...duplicates] = existingTenantEbUsedRecords;

  for (const duplicate of duplicates) {
    try {
      await removeReceipt(duplicate.id);
    } catch (deleteError) {
      console.error("Error deleting duplicate Tenant EB Used record:", deleteError);
    }
  }

  const tenantEbUsedData: Partial<ReceiptData> = {
    receipt_date: `${year}-${month.toString().padStart(2, "0")}-01`,
    tenant_name: "Tenant EB Used",
    eb_reading_last_month: 0,
    eb_reading_this_month: totalUnitsConsumed,
    eb_rate_per_unit: averageRatePerUnit,
    units_consumed: totalUnitsConsumed,
    eb_charges: totalEbCharges,
    rent_amount: 0,
    total_amount: totalEbCharges,
    received_date: null,
    payment_mode: "aggregated",
    receipts_count: tenantReceipts.length,
  };

  return existingTenantEbUsed
    ? patchReceipt(existingTenantEbUsed.id, tenantEbUsedData)
    : insertReceipt(tenantEbUsedData);
};

// Ensures every month that has tenant receipts also has a Tenant EB Used record.
export const ensureTenantEbUsedRecords = async () => {
  const allReceipts = await listAllReceipts();

  const includedReceipts = allReceipts.filter(
    (r) => !SYSTEM_RECORD_NAMES.includes(r.tenant_name) && includedInEbUsed(r)
  );

  if (includedReceipts.length === 0) {
    return [];
  }

  const monthsMap = new Map<string, string>();
  includedReceipts.forEach((receipt) => {
    const date = new Date(receipt.receipt_date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, receipt.receipt_date);
    }
  });

  const results = [];
  for (const firstDateOfMonth of monthsMap.values()) {
    try {
      const result = await createOrUpdateTenantEbUsed(firstDateOfMonth);
      if (result) results.push(result);
    } catch (error) {
      console.error(`Error ensuring Tenant EB Used for ${firstDateOfMonth}:`, error);
    }
  }

  return results;
};

export const getReceiptsCountForMonth = async (receiptDate: string) => {
  const { startDate, endDate } = monthRange(receiptDate);
  const allReceipts = await listAllReceipts();

  return allReceipts.filter(
    (r) =>
      !SYSTEM_RECORD_NAMES.includes(r.tenant_name) &&
      inMonth(r, startDate, endDate) &&
      includedInEbUsed(r)
  ).length;
};
