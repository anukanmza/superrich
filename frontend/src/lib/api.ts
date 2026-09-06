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

export interface BillInput {
  customerId: number;
  entries: EntryInput[];
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/customers`);
  if (!res.ok) throw new Error('Failed to fetch customers');
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
