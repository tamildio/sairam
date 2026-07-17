import {
  listAllReceipts,
  getReceiptById,
  insertReceipt,
  patchReceipt,
  removeReceipt,
  ReceiptData,
  ReceiptRecord,
} from "./airtable";

const isRealReceipt = (r: ReceiptRecord) => r.record_type === "receipt";

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
  const data = await insertReceipt({ record_type: "receipt", ...receipt });

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

  const { receipt_date: receiptDate } = receiptToDelete;

  await removeReceipt(id);

  // Recalculate Tenant EB Used for the month, unless the deleted receipt was itself an aggregate/system record
  if (isRealReceipt(receiptToDelete)) {
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

  const tenantReceipts = allReceipts.filter((r) => isRealReceipt(r) && inMonth(r, startDate, endDate));

  if (tenantReceipts.length === 0) {
    return null;
  }

  const totalUnitsConsumed = tenantReceipts.reduce((sum, r) => sum + r.units_consumed, 0);
  const totalEbCharges = tenantReceipts.reduce((sum, r) => sum + r.eb_charges, 0);
  const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

  const existing = allReceipts.find(
    (r) => r.record_type === "eb_bill_aggregate" && inMonth(r, startDate, endDate)
  );

  const tenantEbBillData: Partial<ReceiptData> = {
    receipt_date: `${year}-${month.toString().padStart(2, "0")}-01`,
    tenant_name: "Tenant EB bill",
    record_type: "eb_bill_aggregate",
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
    (r) => isRealReceipt(r) && inMonth(r, startDate, endDate) && includedInEbUsed(r)
  );

  const existingTenantEbUsedRecords = allReceipts.filter(
    (r) => r.record_type === "eb_used_aggregate" && inMonth(r, startDate, endDate)
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
    record_type: "eb_used_aggregate",
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

  const includedReceipts = allReceipts.filter((r) => isRealReceipt(r) && includedInEbUsed(r));

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
    (r) => isRealReceipt(r) && inMonth(r, startDate, endDate) && includedInEbUsed(r)
  ).length;
};

export interface EbReconciliationRound {
  periodKey: string; // YYYY-MM of the billing round
  billCount: number; // how many of the EB services reported a bill this round
  totalPaid: number; // sum of all EB service bills for this round
  totalCharged: number; // sum of Tenant EB Used for the 2 calendar months this round covers
  variance: number; // totalPaid - totalCharged (positive = paid more than collected from tenants)
}

type ReconciliationInput = Pick<ReceiptRecord, "record_type" | "receipt_date" | "total_amount">;

// Reconciles what was actually paid across all EB service connections against what
// was collected from tenants over the same ~2-month billing window. EB bills across
// the different consumer numbers land in the same calendar month even when a few
// days apart, so bills are grouped by month rather than exact date.
export const computeEbReconciliation = (receipts: ReconciliationInput[]): EbReconciliationRound[] => {
  const ebBills = receipts.filter((r) => r.record_type === "eb_bill_paid");
  const ebUsed = receipts.filter((r) => r.record_type === "eb_used_aggregate");

  const monthKeyOf = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  const usedByMonth = new Map<string, number>();
  ebUsed.forEach((r) => {
    const key = monthKeyOf(r.receipt_date);
    usedByMonth.set(key, (usedByMonth.get(key) || 0) + r.total_amount);
  });

  const billsByMonth = new Map<string, ReconciliationInput[]>();
  ebBills.forEach((r) => {
    const key = monthKeyOf(r.receipt_date);
    if (!billsByMonth.has(key)) billsByMonth.set(key, []);
    billsByMonth.get(key)!.push(r);
  });

  const rounds: EbReconciliationRound[] = Array.from(billsByMonth.entries()).map(([key, bills]) => {
    const [year, month] = key.split("-").map(Number);
    const totalPaid = bills.reduce((sum, b) => sum + b.total_amount, 0);

    const prevDate = new Date(year, month - 2, 1); // the calendar month before this round
    const prevKey = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;
    const totalCharged = (usedByMonth.get(key) || 0) + (usedByMonth.get(prevKey) || 0);

    return {
      periodKey: key,
      billCount: bills.length,
      totalPaid,
      totalCharged,
      variance: totalPaid - totalCharged,
    };
  });

  rounds.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  return rounds;
};
