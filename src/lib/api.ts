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

export interface EbRoundTenantCharge {
  tenantName: string;
  unitsConsumed: number;
  amount: number;
}

export interface EbRoundMonthlyCharge {
  monthKey: string; // YYYY-MM
  amount: number;
  unitsConsumed: number;
  tenants: EbRoundTenantCharge[]; // the individual receipts that make up this month's total
}

export interface EbRoundBill {
  consumerNumber: string | null;
  amount: number;
  unitsConsumed: number;
  receiptNo: string | null;
  paidDate: string | null;
}

export interface EbReconciliationRound {
  periodKey: string; // YYYY-MM of the billing round
  billCount: number; // how many of the EB services reported a bill this round (0 if pending)
  totalPaid: number; // sum of all EB service bills for this round
  totalCharged: number; // sum of Tenant EB Used for the 2 calendar months this round covers
  variance: number; // totalPaid - totalCharged (positive = paid more than collected from tenants)
  isPending: boolean; // true if tenants have been charged but no EB bill has arrived yet
  monthlyCharges: EbRoundMonthlyCharge[]; // tenant EB Used broken out per calendar month
  bills: EbRoundBill[]; // EB bill paid broken out per consumer number/service
}

type ReconciliationInput = Pick<
  ReceiptRecord,
  | "record_type"
  | "receipt_date"
  | "total_amount"
  | "units_consumed"
  | "consumer_number"
  | "receipt_no"
  | "received_date"
  | "tenant_name"
  | "eb_charges"
  | "include_in_eb_used"
>;

const monthKeyOf = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
};

const prevMonthKeyOf = (year: number, month: number) => {
  const prevDate = new Date(year, month - 2, 1); // month is 1-indexed, so month-2 (0-indexed) is the previous month
  return `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, "0")}`;
};

// Reconciles what was actually paid across all EB service connections against what
// was collected from tenants over the same ~2-month billing window. EB bills across
// the different consumer numbers land in the same calendar month even when a few
// days apart, so bills are grouped by month rather than exact date.
export const computeEbReconciliation = (receipts: ReconciliationInput[]): EbReconciliationRound[] => {
  const ebBills = receipts.filter((r) => r.record_type === "eb_bill_paid");
  const ebUsed = receipts.filter((r) => r.record_type === "eb_used_aggregate");

  const usedByMonth = new Map<string, { amount: number; units: number }>();
  ebUsed.forEach((r) => {
    const key = monthKeyOf(r.receipt_date);
    const existing = usedByMonth.get(key) || { amount: 0, units: 0 };
    usedByMonth.set(key, { amount: existing.amount + r.total_amount, units: existing.units + r.units_consumed });
  });

  // The individual tenant receipts behind each month's Tenant EB Used total.
  const tenantReceiptsByMonth = new Map<string, EbRoundTenantCharge[]>();
  receipts
    .filter((r) => r.record_type === "receipt" && r.include_in_eb_used !== false)
    .forEach((r) => {
      const key = monthKeyOf(r.receipt_date);
      if (!tenantReceiptsByMonth.has(key)) tenantReceiptsByMonth.set(key, []);
      tenantReceiptsByMonth.get(key)!.push({
        tenantName: r.tenant_name,
        unitsConsumed: r.units_consumed,
        amount: r.eb_charges,
      });
    });

  const monthlyChargesFor = (...keys: string[]): EbRoundMonthlyCharge[] =>
    keys
      .filter((key) => usedByMonth.has(key))
      .map((key) => ({
        monthKey: key,
        amount: usedByMonth.get(key)!.amount,
        unitsConsumed: usedByMonth.get(key)!.units,
        tenants: tenantReceiptsByMonth.get(key) || [],
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const billsByMonth = new Map<string, ReconciliationInput[]>();
  ebBills.forEach((r) => {
    const key = monthKeyOf(r.receipt_date);
    if (!billsByMonth.has(key)) billsByMonth.set(key, []);
    billsByMonth.get(key)!.push(r);
  });

  const coveredMonths = new Set<string>();

  const rounds: EbReconciliationRound[] = Array.from(billsByMonth.entries()).map(([key, bills]) => {
    const [year, month] = key.split("-").map(Number);
    const totalPaid = bills.reduce((sum, b) => sum + b.total_amount, 0);

    const prevKey = prevMonthKeyOf(year, month);
    coveredMonths.add(key);
    coveredMonths.add(prevKey);
    const totalCharged = (usedByMonth.get(key)?.amount || 0) + (usedByMonth.get(prevKey)?.amount || 0);

    return {
      periodKey: key,
      billCount: bills.length,
      totalPaid,
      totalCharged,
      variance: totalPaid - totalCharged,
      isPending: false,
      monthlyCharges: monthlyChargesFor(prevKey, key),
      bills: bills.map((b) => ({
        consumerNumber: b.consumer_number ?? null,
        amount: b.total_amount,
        unitsConsumed: b.units_consumed,
        receiptNo: b.receipt_no ?? null,
        paidDate: b.received_date ?? null,
      })),
    };
  });

  // Bills always land in an odd-numbered month, covering that month plus the
  // even-numbered month before it. So an uncovered even month belongs to the
  // same upcoming (not-yet-billed) round as the odd month right after it.
  const upcomingRoundKeyFor = (year: number, month: number) => {
    if (month % 2 === 1) return `${year}-${month.toString().padStart(2, "0")}`;
    const next = new Date(year, month, 1); // month is 1-indexed here, so this is next month
    return `${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  // Months already charged to tenants but not yet claimed by any bill's window -
  // the EB bill for that period just hasn't arrived yet. Grouped into the same
  // 2-month window a real bill for that period would eventually cover.
  const pendingByRound = new Map<string, string[]>();
  usedByMonth.forEach((_value, key) => {
    if (coveredMonths.has(key)) return;
    const [year, month] = key.split("-").map(Number);
    const roundKey = upcomingRoundKeyFor(year, month);
    if (!pendingByRound.has(roundKey)) pendingByRound.set(roundKey, []);
    pendingByRound.get(roundKey)!.push(key);
  });

  pendingByRound.forEach((monthKeys, key) => {
    const monthlyCharges = monthlyChargesFor(...monthKeys);
    const totalCharged = monthlyCharges.reduce((sum, m) => sum + m.amount, 0);
    rounds.push({
      periodKey: key,
      billCount: 0,
      totalPaid: 0,
      totalCharged,
      variance: -totalCharged,
      isPending: true,
      monthlyCharges,
      bills: [],
    });
  });

  rounds.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
  return rounds;
};
