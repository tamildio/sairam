const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  payment_mode?: string | null;
}

// Helper function to make API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`Making API call to: ${url}`, options);
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  console.log(`API response status: ${response.status}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('API error:', errorData);
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log('API response data:', data);
  return data;
};

export const fetchReceipts = async (limit?: number, tenant_name?: string) => {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (tenant_name) params.append('tenant_name', tenant_name);
  
  const queryString = params.toString();
  const endpoint = `/api/receipts${queryString ? `?${queryString}` : ''}`;
  
  const data = await apiCall(endpoint);
  return data.data;
};

export const createReceipt = async (receipt: ReceiptData) => {
  console.log("🌐 createReceipt called with:", receipt);
  const data = await apiCall('/api/receipts', {
    method: 'POST',
    body: JSON.stringify(receipt),
  });
  console.log("🌐 createReceipt response:", data);
  return data.data;
};

export const updateReceipt = async (id: string, updates: Partial<ReceiptData>) => {
  const data = await apiCall(`/api/receipts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return data.data;
};

export const deleteReceipt = async (id: string) => {
  const data = await apiCall(`/api/receipts/${id}`, {
    method: 'DELETE',
  });
  return data.data;
};
