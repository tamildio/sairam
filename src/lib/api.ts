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
    
    // Create a sanitized receipt object, excluding include_in_eb_used if it's undefined/null
    // This allows the code to work even if the database column doesn't exist yet
    const receiptToInsert: any = {
      receipt_date: receipt.receipt_date,
      tenant_name: receipt.tenant_name,
      eb_reading_last_month: receipt.eb_reading_last_month,
      eb_reading_this_month: receipt.eb_reading_this_month,
      eb_rate_per_unit: receipt.eb_rate_per_unit,
      units_consumed: receipt.units_consumed,
      eb_charges: receipt.eb_charges,
      rent_amount: receipt.rent_amount,
      total_amount: receipt.total_amount,
      received_date: receipt.received_date ?? null,
      payment_mode: receipt.payment_mode ?? null,
    };
    
    // Only include include_in_eb_used if it's explicitly set (not undefined/null)
    // This allows backward compatibility if the column doesn't exist yet
    if (receipt.include_in_eb_used !== undefined && receipt.include_in_eb_used !== null) {
      receiptToInsert.include_in_eb_used = receipt.include_in_eb_used;
    }
    
    let { data, error } = await supabase
      .from('rent_receipts')
      .insert([receiptToInsert])
      .select()
      .single();

    // If the error is about missing column, retry without include_in_eb_used
    if (error && (error.message?.includes('include_in_eb_used') || 
                  error.message?.includes('schema cache'))) {
      console.warn("⚠️ Column 'include_in_eb_used' not found in database. The 'Include Unit Consumed' feature requires a database migration. Retrying without it...");
      console.warn("⚠️ Please run migration: supabase/migrations/20250124000000_add_include_in_eb_used.sql");
      delete receiptToInsert.include_in_eb_used;
      const retryResult = await supabase
        .from('rent_receipts')
        .insert([receiptToInsert])
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

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
    
    // Create sanitized updates object
    const updatesToApply: any = { ...updates };
    
    // If include_in_eb_used is undefined/null, remove it from updates
    if (updates.include_in_eb_used === undefined || updates.include_in_eb_used === null) {
      delete updatesToApply.include_in_eb_used;
    }
    
    let { data, error } = await supabase
      .from('rent_receipts')
      .update(updatesToApply)
      .eq('id', id)
      .select()
      .single();

    // If the error is about missing column, retry without include_in_eb_used
    if (error && (error.message?.includes('include_in_eb_used') || 
                  error.message?.includes('schema cache'))) {
      console.log("⚠️ Column 'include_in_eb_used' not found, retrying without it...");
      delete updatesToApply.include_in_eb_used;
      const retryResult = await supabase
        .from('rent_receipts')
        .update(updatesToApply)
        .eq('id', id)
        .select()
        .single();
      data = retryResult.data;
      error = retryResult.error;
    }

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

    // First, fetch the receipt to get its receipt_date before deleting
    const { data: receiptToDelete, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('receipt_date, tenant_name')
      .eq('id', id)
      .single();

    if (fetchError) {
      handleSupabaseError(fetchError, 'fetch receipt before deletion');
    }

    if (!receiptToDelete) {
      throw new Error('Receipt not found');
    }

    const receiptDate = receiptToDelete.receipt_date;
    const tenantName = receiptToDelete.tenant_name;

    // Delete the receipt
    const { error } = await supabase
      .from('rent_receipts')
      .delete()
      .eq('id', id);

    if (error) {
      handleSupabaseError(error, 'delete receipt');
    }

    console.log("🌐 deleteReceipt successful");

    // Recalculate Tenant EB Used for the month if the deleted receipt was a tenant receipt
    // (not a system record like "EB bill paid", "Tenant EB bill", or "Tenant EB Used")
    if (tenantName && 
        tenantName !== 'EB bill paid' && 
        tenantName !== 'Tenant EB bill' && 
        tenantName !== 'Tenant EB Used') {
      try {
        console.log("🌐 Recalculating Tenant EB Used after receipt deletion for date:", receiptDate);
        await createOrUpdateTenantEbUsed(receiptDate);
        console.log("✅ Tenant EB Used recalculated successfully after deletion");
      } catch (recalcError) {
        console.error('❌ Error recalculating Tenant EB Used after deletion:', recalcError);
        // Don't throw error here - receipt deletion was successful, recalculation is secondary
      }
    }

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
    // Get the last day of the month properly
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    console.log("🌐 Looking for tenant receipts for EB Used between:", startDate, "and", endDate);
    
    const { data: allTenantReceipts, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('*')
      .neq('tenant_name', 'EB bill paid')
      .neq('tenant_name', 'Tenant EB bill')
      .neq('tenant_name', 'Tenant EB Used')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);

    // Filter out receipts where include_in_eb_used is false
    // If the column doesn't exist, all receipts will have undefined for this field, so we include them all (backward compatibility)
    // If the column exists and the value is explicitly false, exclude the receipt
    const tenantReceipts = allTenantReceipts?.filter(receipt => {
      // Check if the field exists in the receipt object (column exists in DB)
      const hasIncludeField = 'include_in_eb_used' in receipt;
      if (!hasIncludeField) {
        // Column doesn't exist - include all receipts for backward compatibility
        return true;
      }
      // Column exists - only include if value is not explicitly false
      return receipt.include_in_eb_used !== false;
    }) || [];
    
    console.log("🌐 Filtered tenant receipts for EB Used:", {
      total: allTenantReceipts?.length || 0,
      included: tenantReceipts.length,
      excluded: (allTenantReceipts?.length || 0) - tenantReceipts.length
    });
    
    console.log("🌐 Found tenant receipts for EB Used:", tenantReceipts);

    if (fetchError) {
      console.error("❌ Error fetching tenant receipts:", fetchError);
      handleSupabaseError(fetchError, 'fetch tenant receipts for EB Used aggregation');
    }

    if (!tenantReceipts || tenantReceipts.length === 0) {
      console.log("ℹ️ No tenant receipts found for EB Used aggregation in", startDate, "to", endDate);
      
      // If no tenant receipts exist, delete any existing Tenant EB Used record for this month
      const { data: existingTenantEbUsedRecords, error: checkError } = await supabase
        .from('rent_receipts')
        .select('*')
        .eq('tenant_name', 'Tenant EB Used')
        .gte('receipt_date', startDate)
        .lte('receipt_date', endDate);

      if (checkError) {
        console.error('❌ Error checking for existing Tenant EB Used records:', checkError);
      } else if (existingTenantEbUsedRecords && existingTenantEbUsedRecords.length > 0) {
        console.log("🌐 Deleting Tenant EB Used record(s) as no tenant receipts exist for this month");
        for (const record of existingTenantEbUsedRecords) {
          const { error: deleteError } = await supabase
            .from('rent_receipts')
            .delete()
            .eq('id', record.id);
          if (deleteError) {
            console.error('❌ Error deleting Tenant EB Used record:', deleteError);
          } else {
            console.log(`✅ Deleted Tenant EB Used record: ${record.id}`);
          }
        }
      }
      
      return null;
    }

    console.log("✅ Found", tenantReceipts.length, "tenant receipts for EB Used aggregation");

    // Aggregate the data
    const totalUnitsConsumed = tenantReceipts.reduce((sum, receipt) => sum + receipt.units_consumed, 0);
    const totalEbCharges = tenantReceipts.reduce((sum, receipt) => sum + receipt.eb_charges, 0);
    const averageRatePerUnit = totalUnitsConsumed > 0 ? totalEbCharges / totalUnitsConsumed : 0;

    // Check if Tenant EB Used already exists for this month
    const { data: existingTenantEbUsedRecords, error: checkError } = await supabase
      .from('rent_receipts')
      .select('*')
      .eq('tenant_name', 'Tenant EB Used')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);

    if (checkError) {
      handleSupabaseError(checkError, 'check existing tenant EB Used');
    }

    // Get the first existing record (if any)
    const existingTenantEbUsed = existingTenantEbUsedRecords && existingTenantEbUsedRecords.length > 0 
      ? existingTenantEbUsedRecords[0] 
      : null;

    // If there are multiple records, delete duplicates and keep only the first one
    if (existingTenantEbUsedRecords && existingTenantEbUsedRecords.length > 1) {
      console.log(`🌐 Found ${existingTenantEbUsedRecords.length} duplicate Tenant EB Used records, cleaning up...`);
      const recordsToDelete = existingTenantEbUsedRecords.slice(1); // Keep first, delete rest
      for (const duplicate of recordsToDelete) {
        const { error: deleteError } = await supabase
          .from('rent_receipts')
          .delete()
          .eq('id', duplicate.id);
        if (deleteError) {
          console.error('❌ Error deleting duplicate Tenant EB Used record:', deleteError);
        } else {
          console.log(`✅ Deleted duplicate Tenant EB Used record: ${duplicate.id}`);
        }
      }
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
      // receipts_count: tenantReceipts.length, // TODO: Add this field to database schema
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
    
    // Get all unique months that have tenant receipts (only those included in EB Used)
    const { data: allReceipts, error: fetchError } = await supabase
      .from('rent_receipts')
      .select('receipt_date, include_in_eb_used')
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

    // Filter out receipts where include_in_eb_used is false
    const includedReceipts = allReceipts?.filter(receipt => {
      const hasIncludeField = 'include_in_eb_used' in receipt;
      if (!hasIncludeField) {
        // Column doesn't exist - include all receipts for backward compatibility
        return true;
      }
      // Column exists - only include if value is not explicitly false
      return receipt.include_in_eb_used !== false;
    }) || [];

    // Group receipts by month
    const monthsMap = new Map<string, string[]>();
    includedReceipts.forEach(receipt => {
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

// Function to get receipts count for a specific month
export const getReceiptsCountForMonth = async (receiptDate: string) => {
  try {
    // Extract year and month from the receipt date
    const date = new Date(receiptDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Get the date range for the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    // Get all tenant receipts for the month (excluding system records)
    const { data: allTenantReceipts, error } = await supabase
      .from('rent_receipts')
      .select('*')
      .neq('tenant_name', 'EB bill paid')
      .neq('tenant_name', 'Tenant EB bill')
      .neq('tenant_name', 'Tenant EB Used')
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate);

    if (error) {
      handleSupabaseError(error, 'fetch receipts count');
    }

    // Filter out receipts where include_in_eb_used is false
    const tenantReceipts = allTenantReceipts?.filter(receipt => {
      const hasIncludeField = 'include_in_eb_used' in receipt;
      if (!hasIncludeField) {
        // Column doesn't exist - include all receipts for backward compatibility
        return true;
      }
      // Column exists - only include if value is not explicitly false
      return receipt.include_in_eb_used !== false;
    }) || [];

    return tenantReceipts.length;
  } catch (error) {
    console.error('Error in getReceiptsCountForMonth:', error);
    throw error;
  }
};
