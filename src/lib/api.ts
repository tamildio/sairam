import { supabase, ReceiptData, ReceiptRecord } from './supabase';

// Helper function to handle Supabase errors
const handleSupabaseError = (error: any, operation: string) => {
  console.error(`Supabase ${operation} error:`, error);
  throw new Error(error.message || `Failed to ${operation}`);
};

export const fetchReceipts = async (limit?: number, tenant_name?: string) => {
  try {
    let query = supabase
      .from('rent_receipts')
      .select('*')
      .order('receipt_date', { ascending: false });

    if (tenant_name) {
      query = query.eq('tenant_name', tenant_name);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      handleSupabaseError(error, 'fetch receipts');
    }

    console.log('Fetched receipts:', data);

    // Ensure all months with tenant receipts have Tenant EB Used records
    try {
      console.log("🌐 Ensuring Tenant EB Used records exist for all months");
      await ensureTenantEbUsedRecords();
    } catch (ensureError) {
      console.error('❌ Error ensuring Tenant EB Used records:', ensureError);
      // Don't throw error here - fetching receipts was successful, ensuring records is secondary
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching receipts:', error);
    throw error;
  }
};

export const createReceipt = async (receipt: ReceiptData) => {
  try {
    console.log("🌐 createReceipt called with:", receipt);
    
    const { data, error } = await supabase
      .from('rent_receipts')
      .insert([receipt])
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'create receipt');
    }

    console.log("🌐 createReceipt response:", data);

    // Automatically create/update Tenant EB bill for ALL tenant receipts
    try {
      console.log("🌐 Auto-creating/updating Tenant EB bill for receipt date:", receipt.receipt_date);
      const tenantEbBill = await createOrUpdateTenantEbBill(receipt.receipt_date);
      if (tenantEbBill) {
        console.log("✅ Tenant EB bill created/updated successfully:", tenantEbBill);
      } else {
        console.log("ℹ️ No tenant receipts found for aggregation");
      }
    } catch (aggregationError) {
      console.error('❌ Error auto-creating Tenant EB bill:', aggregationError);
      console.error('❌ Aggregation error details:', {
        message: aggregationError instanceof Error ? aggregationError.message : 'Unknown error',
        stack: aggregationError instanceof Error ? aggregationError.stack : undefined
      });
      // Don't throw error here - receipt creation was successful, aggregation is secondary
    }

    // Automatically create/update Tenant EB Used for ALL tenant receipts
    try {
      console.log("🌐 Auto-creating/updating Tenant EB Used for receipt date:", receipt.receipt_date);
      const tenantEbUsed = await createOrUpdateTenantEbUsed(receipt.receipt_date);
      if (tenantEbUsed) {
        console.log("✅ Tenant EB Used created/updated successfully:", tenantEbUsed);
      } else {
        console.log("ℹ️ No tenant receipts found for EB Used aggregation");
      }
    } catch (aggregationError) {
      console.error('❌ Error auto-creating Tenant EB Used:', aggregationError);
      // Don't throw error here - receipt creation was successful, aggregation is secondary
    }

    return data;
  } catch (error) {
    console.error('Error creating receipt:', error);
    throw error;
  }
};

export const updateReceipt = async (id: string, updates: Partial<ReceiptData>) => {
  try {
    console.log("🌐 updateReceipt called with:", { id, updates });
    
    const { data, error } = await supabase
      .from('rent_receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      handleSupabaseError(error, 'update receipt');
    }

    console.log("🌐 updateReceipt response:", data);

    // Automatically update Tenant EB bill for ALL tenant receipt updates
    try {
      console.log("🌐 Auto-updating Tenant EB bill for updated receipt date:", data.receipt_date);
      await createOrUpdateTenantEbBill(data.receipt_date);
    } catch (aggregationError) {
      console.error('Error auto-updating Tenant EB bill:', aggregationError);
      // Don't throw error here - receipt update was successful, aggregation is secondary
    }

    // Automatically update Tenant EB Used for ALL tenant receipt updates
    try {
      console.log("🌐 Auto-updating Tenant EB Used for updated receipt date:", data.receipt_date);
      await createOrUpdateTenantEbUsed(data.receipt_date);
    } catch (aggregationError) {
      console.error('Error auto-updating Tenant EB Used:', aggregationError);
      // Don't throw error here - receipt update was successful, aggregation is secondary
    }

    return data;
  } catch (error) {
    console.error('Error updating receipt:', error);
    throw error;
  }
};

export const deleteReceipt = async (id: string) => {
  try {
    console.log("🌐 deleteReceipt called with:", { id });

    const { error } = await supabase
    .from('rent_receipts')
    .delete()
    .eq('id', id);

    if (error) {
      handleSupabaseError(error, 'delete receipt');
    }

    console.log("🌐 deleteReceipt successful");
    return { success: true };
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
};

export const createOrUpdateTenantEbBill = async (receiptDate: string) => {
  try {
    console.log("🌐 createOrUpdateTenantEbBill called with:", { receiptDate });
    
    // Extract year and month from the receipt date
    const date = new Date(receiptDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Get all tenant receipts for the same month (excluding "EB bill paid" and existing "Tenant EB bill" records)
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    console.log("🌐 Looking for tenant receipts between:", startDate, "and", endDate);
    
    const { data: tenantReceipts, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('*')
      .not('tenant_name', 'in', ['Tenant EB bill']) // Exclude existing Tenant EB bill records
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);

    console.log("🌐 Found tenant receipts:", tenantReceipts);

    if (fetchError) {
      console.error("❌ Error fetching tenant receipts:", fetchError);
      handleSupabaseError(fetchError, 'fetch tenant receipts for aggregation');
    }

    if (!tenantReceipts || tenantReceipts.length === 0) {
      console.log("ℹ️ No tenant receipts found for aggregation in", startDate, "to", endDate);
      return null;
    }

    console.log("✅ Found", tenantReceipts.length, "tenant receipts for aggregation");

    // Aggregate the data
    const totalUnitsConsumed = tenantReceipts.reduce((sum, receipt) => sum + receipt.units_consumed, 0);
    const totalEbCharges = tenantReceipts.reduce((sum, receipt) => sum + receipt.eb_charges, 0);
    const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

    // Check if Tenant EB bill already exists for this month
    const { data: existingTenantEbBill, error: checkError } = await supabase
      .from('rent_receipts')
      .select('*')
      .eq('tenant_name', 'Tenant EB bill')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      handleSupabaseError(checkError, 'check existing tenant EB bill');
    }

    const tenantEbBillData = {
      receipt_date: `${year}-${month.toString().padStart(2, '0')}-01`, // First day of the month
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

    let result;
    if (existingTenantEbBill) {
      // Update existing Tenant EB bill
      console.log("🌐 Updating existing Tenant EB bill:", existingTenantEbBill.id);
      const { data, error } = await supabase
        .from('rent_receipts')
        .update(tenantEbBillData)
        .eq('id', existingTenantEbBill.id)
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'update tenant EB bill');
      }
      result = data;
    } else {
      // Create new Tenant EB bill
      console.log("🌐 Creating new Tenant EB bill:", tenantEbBillData);
      const { data, error } = await supabase
        .from('rent_receipts')
        .insert([tenantEbBillData])
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'create tenant EB bill');
      }
      result = data;
    }

    console.log("🌐 Tenant EB bill processed successfully:", result);
    return result;
  } catch (error) {
    console.error('Error creating/updating tenant EB bill:', error);
    throw error;
  }
};

// New function to create/update "Tenant EB Used" records
export const createOrUpdateTenantEbUsed = async (receiptDate: string) => {
  try {
    console.log("🌐 createOrUpdateTenantEbUsed called with:", { receiptDate });
    
    // Extract year and month from the receipt date
    const date = new Date(receiptDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Get all tenant receipts for the same month (excluding system records)
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    console.log("🌐 Looking for tenant receipts for EB Used between:", startDate, "and", endDate);
    
    const { data: tenantReceipts, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('*')
      .not('tenant_name', 'in', ['EB bill paid', 'Tenant EB bill', 'Tenant EB Used']) // Exclude system records
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);

    console.log("🌐 Found tenant receipts for EB Used:", tenantReceipts);

    if (fetchError) {
      console.error("❌ Error fetching tenant receipts:", fetchError);
      handleSupabaseError(fetchError, 'fetch tenant receipts for EB Used aggregation');
    }

    if (!tenantReceipts || tenantReceipts.length === 0) {
      console.log("ℹ️ No tenant receipts found for EB Used aggregation in", startDate, "to", endDate);
      return null;
    }

    console.log("✅ Found", tenantReceipts.length, "tenant receipts for EB Used aggregation");

    // Aggregate the data
    const totalUnitsConsumed = tenantReceipts.reduce((sum, receipt) => sum + receipt.units_consumed, 0);
    const totalEbCharges = tenantReceipts.reduce((sum, receipt) => sum + receipt.eb_charges, 0);
    const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

    // Check if Tenant EB Used already exists for this month
    const { data: existingTenantEbUsed, error: checkError } = await supabase
      .from('rent_receipts')
      .select('*')
      .eq('tenant_name', 'Tenant EB Used')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      handleSupabaseError(checkError, 'check existing tenant EB Used');
    }

    const tenantEbUsedData = {
      receipt_date: `${year}-${month.toString().padStart(2, '0')}-01`, // First day of the month
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
    };

    let result;
    if (existingTenantEbUsed) {
      // Update existing Tenant EB Used
      console.log("🌐 Updating existing Tenant EB Used:", existingTenantEbUsed.id);
      const { data, error } = await supabase
        .from('rent_receipts')
        .update(tenantEbUsedData)
        .eq('id', existingTenantEbUsed.id)
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'update tenant EB Used');
      }
      result = data;
    } else {
      // Create new Tenant EB Used
      console.log("🌐 Creating new Tenant EB Used for", startDate, "to", endDate);
      const { data, error } = await supabase
        .from('rent_receipts')
        .insert([tenantEbUsedData])
        .select()
        .single();

      if (error) {
        handleSupabaseError(error, 'create tenant EB Used');
      }
      result = data;
    }

    console.log("🌐 Tenant EB Used processed successfully:", result);
    return result;
  } catch (error) {
    console.error('Error creating/updating tenant EB Used:', error);
    throw error;
  }
};

// Function to ensure all months with tenant receipts have Tenant EB Used records
export const ensureTenantEbUsedRecords = async () => {
  try {
    console.log("🌐 ensureTenantEbUsedRecords called");
    
    // Get all unique months that have tenant receipts
    const { data: allReceipts, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('receipt_date')
      .neq('tenant_name', 'EB bill paid')
      .neq('tenant_name', 'Tenant EB bill')
      .neq('tenant_name', 'Tenant EB Used')
      .order('receipt_date', { ascending: true });

    if (fetchError) {
      console.error("❌ Error fetching receipts:", fetchError);
      handleSupabaseError(fetchError, 'fetch receipts for Tenant EB Used check');
    }

    if (!allReceipts || allReceipts.length === 0) {
      console.log("ℹ️ No tenant receipts found for Tenant EB Used check");
      return [];
    }

    // Group receipts by month
    const monthsMap = new Map<string, string[]>();
    allReceipts.forEach(receipt => {
      const date = new Date(receipt.receipt_date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, []);
      }
      monthsMap.get(monthKey)!.push(receipt.receipt_date);
    });

    console.log("🌐 Found months with tenant receipts:", Array.from(monthsMap.keys()));

    const results = [];
    // Check and create Tenant EB Used for each month
    for (const [monthKey, dates] of monthsMap) {
      const firstDate = dates[0]; // Use first date of the month
      console.log(`🌐 Checking Tenant EB Used for ${monthKey} using date: ${firstDate}`);
      
      try {
        const result = await createOrUpdateTenantEbUsed(firstDate);
        if (result) {
          results.push(result);
          console.log(`✅ Ensured Tenant EB Used exists for ${monthKey}`);
        }
      } catch (error) {
        console.error(`❌ Error ensuring Tenant EB Used for ${monthKey}:`, error);
      }
    }

    console.log("🌐 Ensured Tenant EB Used records for all months:", results);
    return results;
  } catch (error) {
    console.error('Error ensuring Tenant EB Used records:', error);
    throw error;
  }
};
