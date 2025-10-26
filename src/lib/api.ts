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
      .order('created_at', { ascending: false });

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
