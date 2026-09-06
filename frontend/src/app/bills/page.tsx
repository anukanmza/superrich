'use client';

import { useState, useEffect } from 'react';
import { fetchBills, deleteBill, updateBill, fetchCustomers, Bill, Customer, EntryInput } from '../../lib/api';
import { generateEntries } from '../../lib/lotto';

type BillWithIndex = Bill & { customerBillIndex: number };

export default function BillsPage() {
  const [bills, setBills] = useState<BillWithIndex[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [selectedBill, setSelectedBill] = useState<BillWithIndex | null>(null);
  const [editEntries, setEditEntries] = useState<EntryInput[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Keying states for edit modal
  const [number, setNumber] = useState('');
  const [topAmt, setTopAmt] = useState('');
  const [botAmt, setBotAmt] = useState('');
  const [lockAmt, setLockAmt] = useState(false);

  const loadBills = () => {
    setIsLoading(true);
    fetchBills().then(data => {
      // Sort oldest first to calculate index correctly
      const sorted = data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const counts: Record<number, number> = {};
      const withIndex = sorted.map(b => {
        counts[b.customerId] = (counts[b.customerId] || 0) + 1;
        return { ...b, customerBillIndex: counts[b.customerId] };
      });
      // Sort back to newest first for display
      setBills(withIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }).catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCustomers().then(data => setCustomers(data)).catch(console.error);
    loadBills();
  }, []);

  const filteredBills = selectedCustomerId 
    ? bills.filter(b => b.customerId === selectedCustomerId)
    : bills;

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบบิลนี้?')) {
      try {
        await deleteBill(id);
        loadBills();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบบิล');
      }
    }
  };

  const handleBillClick = (bill: BillWithIndex) => {
    setSelectedBill(bill);
    setEditEntries(bill.entries.map(e => ({ number: e.number, type: e.type, amount: e.amount })));
    setNumber('');
    setTopAmt('');
    setBotAmt('');
  };

  const handleAddEntry = () => {
    const newEntries = generateEntries(number, topAmt, botAmt);
    if (newEntries.length > 0) {
      setEditEntries(prev => [...newEntries, ...prev]);
      setNumber('');
      if (!lockAmt) {
        setTopAmt('');
        setBotAmt('');
      }
      document.getElementById('edit-input-number')?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lockAmt) {
        handleAddEntry();
      } else if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      } else {
        handleAddEntry();
      }
    }
  };

  const handleRemoveEntry = (idx: number) => {
    setEditEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateBill = async () => {
    if (!selectedBill || isUpdating) return;
    setIsUpdating(true);
    try {
      await updateBill(selectedBill.id, { entries: editEntries });
      alert('บันทึกการแก้ไขสำเร็จ!');
      setSelectedBill(null);
      loadBills();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการแก้ไขบิล');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#cdd6f4]">บิล / โพย</h1>
          <div className="text-xs text-[#6c7086] mt-1">คลิกที่บิลเพื่อดูรายละเอียดหรือแก้ไข</div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedCustomerId} 
            onChange={(e) => setSelectedCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-[#11151e] border border-[#2a3244] rounded px-3 py-1 text-[#cdd6f4] text-sm outline-none focus:border-[#89b4fa]"
          >
            <option value="">-- ลูกค้าทั้งหมด --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="bg-[#1e2d3d] text-[#89b4fa] px-3 py-1 rounded-full text-xs font-bold border border-[#2a4a6b]">
            แสดง {filteredBills.length} บิล
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-[#6c7086]">กำลังโหลดข้อมูลบิล...</div>
      ) : filteredBills.length === 0 ? (
        <div className="text-center text-[#6c7086] mt-20">ไม่พบบิลของลูกค้าที่เลือก</div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {filteredBills.map(bill => (
            <div 
              key={bill.id} 
              onClick={() => handleBillClick(bill)}
              className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4 hover:border-[#89b4fa] transition-colors cursor-pointer glass"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-[#cdd6f4] font-bold" style={{ color: bill.customer?.tc || '#cdd6f4' }}>
                    {bill.customer?.name || 'ไม่ทราบชื่อ'} บิลที่ {bill.customerBillIndex}
                  </span>
                </div>
                <div className="text-[#6c7086] text-xs">
                  {new Date(bill.createdAt).toLocaleString('th-TH')}
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <div className="flex gap-4 text-xs text-[#6c7086]">
                  <div>รายการ: <span className="text-[#74c7ec] font-bold">{bill.entries.length}</span></div>
                  <div>สถานะ: <span className="text-[#a6e3a1] bg-[#1e3329] px-2 py-0.5 rounded-full border border-[#2d6b3b]">{bill.status === 'active' ? 'ปกติ' : bill.status}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xl font-bold text-[#a6e3a1]">
                    ฿{bill.total.toLocaleString()}
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, bill.id)}
                    className="bg-[#1e1215] text-[#f38ba8] hover:bg-[#f38ba8] hover:text-[#1e1215] border border-[#3a2a2a] px-3 py-1 rounded text-xs font-bold transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Bill Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1117] border border-[#2a4a6b] rounded-lg w-full max-w-2xl h-[90vh] shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-[#1e2433] flex justify-between items-center bg-[#11151e] rounded-t-lg">
              <div>
                <h2 className="text-lg font-bold text-[#89b4fa]">
                  รายละเอียด {selectedBill.customer?.name || 'ไม่ทราบชื่อ'} บิลที่ {selectedBill.customerBillIndex}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedBill(null)}
                className="text-[#6c7086] hover:text-[#f38ba8] transition-colors"
              >
                ✕ ปิด
              </button>
            </div>
            
            {/* Entry Form */}
            <div className="p-4 bg-[#11151e] border-b border-[#1e2433]">
              <div className="flex gap-2">
                <input 
                  id="edit-input-number"
                  type="text" 
                  maxLength={3}
                  placeholder="00"
                  value={number}
                  onChange={e => setNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => handleKeyDown(e, 'edit-input-top')}
                  className="w-24 bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-4 text-[#a6e3a1] font-mono text-2xl text-center outline-none focus:border-[#89b4fa] tracking-widest font-bold"
                />
                <div className="flex-1 flex flex-col gap-1 relative">
                  <label className="absolute -top-6 left-0 text-[10px] text-[#89b4fa] flex items-center gap-1 cursor-pointer select-none bg-[#1e2d3d] px-2 py-0.5 rounded border border-[#2a4a6b]">
                    <input type="checkbox" checked={lockAmt} onChange={(e) => setLockAmt(e.target.checked)} className="accent-[#89b4fa] w-3 h-3"/>
                    ล็อคยอด
                  </label>
                  <input 
                    id="edit-input-top"
                    type="text"
                    placeholder="บน"
                    value={topAmt}
                    readOnly={lockAmt}
                    onChange={e => setTopAmt(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => handleKeyDown(e, 'edit-input-bot')}
                    className={`w-full bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa] ${lockAmt ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <input 
                    id="edit-input-bot"
                    type="text"
                    placeholder="ล่าง/โต้ด"
                    value={botAmt}
                    readOnly={lockAmt}
                    onChange={e => setBotAmt(e.target.value.replace(/[^0-9*+]/g, ''))}
                    onKeyDown={e => handleKeyDown(e)}
                    className={`w-full bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa] ${lockAmt ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {editEntries.length === 0 ? (
                <div className="text-center text-[#6c7086] text-sm mt-10">บิลนี้ไม่มีรายการ (จะถูกลบหากบันทึก)</div>
              ) : (
                editEntries.map((entry, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-[#1e2433] px-4 py-3 rounded border border-[#2a3244]">
                    <div className="flex items-center gap-4">
                      <span className="text-[#a6e3a1] font-mono text-xl font-bold tracking-widest">{entry.number}</span>
                      <span className="text-[10px] bg-[#2a3244] px-2 py-1 rounded text-[#cdd6f4]">{entry.type}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#cdd6f4] font-bold">฿{entry.amount}</span>
                      <button 
                        onClick={() => handleRemoveEntry(idx)}
                        className="text-[#f38ba8] hover:bg-[#3b1e28] rounded px-3 py-1 text-xs transition-colors border border-transparent hover:border-[#f38ba8]"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-[#11151e] border-t border-[#1e2433] p-6 flex justify-between items-center rounded-b-lg">
              <div className="text-sm text-[#6c7086]">
                ยอดรวมใหม่: <span className="text-[#a6e3a1] text-2xl font-bold ml-2">฿{editEntries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSelectedBill(null)}
                  className="bg-[#1e1215] border border-[#3a2a2a] text-[#f38ba8] font-bold py-2 px-6 rounded hover:bg-[#3b1e28] transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleUpdateBill}
                  disabled={isUpdating}
                  className="bg-[#1a3a20] hover:bg-[#223f28] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(166,227,161,0.2)]"
                >
                  {isUpdating ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
