// Test file to verify Supabase connection
import { supabase } from './supabase';

export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase
      .from('rent_receipts')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection failed:', error);
      return false;
    }

    console.log('✅ Supabase connection successful!');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
};

// Call this function to test the connection
// testSupabaseConnection();
