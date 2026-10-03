const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Retry wrapper to handle Render free-tier cold starts (server sleeps after 15 min idle)
async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      // Wait before retrying: 2s, 4s, 8s
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('fetchWithRetry: all retries failed');
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  disc?: number;
  color?: string;
  tc?: string;
}

export interface EntryInput {
  number: string;
  type: string;
  amount: number;
}

export interface Bill {
  id: number;
  customerId: number;
  customer: Customer;
  total: number;
  status: string;
  createdAt: string;
  entries: {
    id: number;
    number: string;
    type: string;
    amount: number;
  }[];
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetchWithRetry(`${API_BASE}/customers`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createCustomer(data: Partial<Customer>) {
  const res = await fetchWithRetry(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create customer');
  return res.json();
}

export async function updateCustomer(id: number, data: Partial<Customer>) {
  const res = await fetchWithRetry(`${API_BASE}/customers/${id}`, {
    method: 'PUT', // or PATCH depending on your NestJS controller
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update customer');
  return res.json();
}

export interface BillInput {
  customerId: number;
  entries: EntryInput[];
}

export async function fetchBills(): Promise<Bill[]> {
  const res = await fetchWithRetry(`${API_BASE}/bills`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch bills');
  return res.json();
}

export async function createBill(data: BillInput) {
  const res = await fetchWithRetry(`${API_BASE}/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create bill');
  return res.json();
}

export async function deleteBill(id: number) {
  const res = await fetchWithRetry(`${API_BASE}/bills/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete bill');
  return res.json();
}

export async function updateBill(id: number, data: { entries: EntryInput[] }) {
  const res = await fetchWithRetry(`${API_BASE}/bills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update bill');
  return res.json();
}

export async function getSettings() {
  const res = await fetchWithRetry(`${API_BASE}/settings`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(data: Record<string, any>) {
  const res = await fetchWithRetry(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let errMsg = 'Failed to update settings';
    try {
      const errBody = await res.json();
      if (errBody.message) errMsg = errBody.message;
    } catch (e) {}
    throw new Error(errMsg);
  }
  return res.json();
}

export async function getArchives() {
  const res = await fetchWithRetry(`${API_BASE}/bills/archives`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch archives');
  return res.json();
}

export async function getArchiveById(id: number) {
  const res = await fetchWithRetry(`${API_BASE}/bills/archives/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch archive');
  return res.json();
}

export async function archiveCurrentPeriod(periodName: string, cutoutsJson: string, resultsJson: string) {
  const res = await fetchWithRetry(`${API_BASE}/bills/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodName, cutoutsJson, resultsJson }),
  });
  if (!res.ok) throw new Error('Failed to archive period');
  return res.json();
}

export async function deleteCustomer(id: number) {
  const res = await fetchWithRetry(`${API_BASE}/customers/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete customer');
  return res.json();
}

export async function deleteArchive(id: number) {
  const res = await fetchWithRetry(`${API_BASE}/bills/archives/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete archive');
  return res.json();
}

export async function getAnalysis(options?: { apiKey?: string, model?: string }) {
  const res = await fetchWithRetry(`${API_BASE}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {})
  });
  if (!res.ok) {
    let errMessage = 'Failed to fetch analysis';
    try {
      const errData = await res.json();
      if (errData.message) errMessage = errData.message;
    } catch(e) {}
    throw new Error(errMessage);
  }
  return res.json();
}

export async function getAiHistory() {
  const res = await fetchWithRetry(`${API_BASE}/analysis/history`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch AI history');
  return res.json();
}

export async function getAiStats() {
  const res = await fetchWithRetry(`${API_BASE}/analysis/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch AI stats');
  return res.json();
}

export async function getLatestPrediction() {
  const res = await fetchWithRetry(`${API_BASE}/analysis/latest-prediction`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch latest prediction');
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function addAiHistory(data: { period: string, top3: string, bot2: string }) {
  const res = await fetchWithRetry(`${API_BASE}/analysis/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add AI history');
  return res.json();
}

export async function resetAiStats() {
  const res = await fetchWithRetry(`${API_BASE}/analysis/fix-db`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset AI stats');
  return res.json();
}
