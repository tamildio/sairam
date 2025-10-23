import { supabase } from "@/integrations/supabase/client";
import { getSession } from "./auth";

interface ReceiptData {
  receipt_date: string;
  tenant_name: string;
  eb_reading_last_month: number;
  eb_reading_this_month: number;
  eb_rate_per_unit: number;
  units_consumed: number;
  eb_charges: number;
  rent_amount: number;
  total_amount: number;
  received_date?: string | null;
}

export const fetchReceipts = async (limit?: number) => {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('receipts-list', {
    body: { token: session.token, limit }
  });

  if (error) throw error;
  return data.data;
};

export const createReceipt = async (receipt: ReceiptData) => {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('receipts-create', {
    body: { token: session.token, receipt }
  });

  if (error) throw error;
  return data.data;
};

export const updateReceipt = async (id: string, updates: Partial<ReceiptData>) => {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('receipts-update', {
    body: { token: session.token, id, updates }
  });

  if (error) throw error;
  return data.data;
};
