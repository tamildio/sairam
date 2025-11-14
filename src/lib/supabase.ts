import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface ReceiptRecord {
  id: string
  receipt_date: string
  tenant_name: string
  eb_reading_last_month: number
  eb_reading_this_month: number
  eb_rate_per_unit: number
  units_consumed: number
  eb_charges: number
  rent_amount: number
  total_amount: number
  received_date: string | null
  payment_mode: string | null
  include_in_eb_used?: boolean | null
  created_at: string
}

export interface ReceiptData {
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
  payment_mode?: string | null;
  include_in_eb_used?: boolean | null;
}
