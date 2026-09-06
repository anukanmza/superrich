const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
  const res = await fetch(`${API_BASE}/customers`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function createCustomer(data: Partial<Customer>) {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create customer');
  return res.json();
}

export async function updateCustomer(id: number, data: Partial<Customer>) {
  const res = await fetch(`${API_BASE}/customers/${id}`, {
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
  const res = await fetch(`${API_BASE}/bills`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch bills');
  return res.json();
}

export async function createBill(data: BillInput) {
  const res = await fetch(`${API_BASE}/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create bill');
  return res.json();
}

export async function deleteBill(id: number) {
  const res = await fetch(`${API_BASE}/bills/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete bill');
  return res.json();
}

export async function updateBill(id: number, data: { entries: EntryInput[] }) {
  const res = await fetch(`${API_BASE}/bills/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update bill');
  return res.json();
}

export async function getSettings() {
  const res = await fetch(`${API_BASE}/settings`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(data: Record<string, any>) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}
