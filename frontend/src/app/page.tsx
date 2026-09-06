'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import { fetchCustomers, createBill, Customer, EntryInput } from '../lib/api';

export default function KeyingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  
  const [number, setNumber] = useState('');
  const [topAmt, setTopAmt] = useState('');
  const [botAmt, setBotAmt] = useState('');
  
  const [entries, setEntries] = useState<EntryInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCustomers().then(data => {
      setCustomers(data);
      if (data.length > 0) setSelectedCustomerId(data[0].id);
    }).catch(err => console.error(err));
  }, []);

  const addEntry = () => {
    if (!number) return;
    
    const newEntries: EntryInput[] = [];
    
    // Auto-detect type based on length
    if (number.length === 2) {
      if (topAmt) newEntries.push({ number, type: '2บน', amount: parseInt(topAmt) });
      if (botAmt) newEntries.push({ number, type: '2ล่าง', amount: parseInt(botAmt) });
    } else if (number.length === 3) {
      if (topAmt) newEntries.push({ number, type: '3บน', amount: parseInt(topAmt) });
      if (botAmt) newEntries.push({ number, type: '3โต้ด', amount: parseInt(botAmt) });
    }
    
    if (newEntries.length > 0) {
      setEntries([...newEntries, ...entries]); // Add to top of list
      setNumber('');
      setTopAmt('');
      setBotAmt('');
      document.getElementById('input-number')?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      } else {
        addEntry();
      }
    } else if (e.key === 'F4') {
      e.preventDefault();
      saveBill();
    }
  };

  const saveBill = async () => {
    if (entries.length === 0 || !selectedCustomerId) return;
    setIsSaving(true);
    try {
      await createBill({
        customerId: Number(selectedCustomerId),
        entries: entries,
      });
      alert('บันทึกบิลสำเร็จ!');
      setEntries([]);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกบิล');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut listener for F4 on window level
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        saveBill();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [entries, selectedCustomerId]);

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex h-full">
      {/* Left Panel: Keying */}
      <div className="w-1/2 p-4 border-r border-[#1e2433] flex flex-col">
        <div className="mb-6">
          <label className="block text-xs text-[#6c7086] mb-2 uppercase tracking-wide">ลูกค้า</label>
          <select 
            value={selectedCustomerId} 
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
            className="w-full bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
          >
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-xs text-[#6c7086] mb-2 uppercase tracking-wide">คีย์รายการ</label>
          <div className="flex gap-2">
            <input 
              id="input-number"
              type="text" 
              maxLength={3}
              placeholder="00"
              value={number}
              onChange={e => setNumber(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => handleKeyDown(e, 'input-top')}
              className="w-24 bg-[#11151e] border border-[#2a3244] rounded px-3 py-4 text-[#a6e3a1] font-mono text-2xl text-center outline-none focus:border-[#89b4fa] tracking-widest font-bold"
            />
            <input 
              id="input-top"
              type="text"
              placeholder="บน"
              value={topAmt}
              onChange={e => setTopAmt(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => handleKeyDown(e, 'input-bot')}
              className="flex-1 bg-[#11151e] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa]"
            />
            <input 
              id="input-bot"
              type="text"
              placeholder="ล่าง/โต้ด"
              value={botAmt}
              onChange={e => setBotAmt(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => handleKeyDown(e)}
              className="flex-1 bg-[#11151e] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa]"
            />
          </div>
        </div>

        <div className="mt-auto bg-[#1e2433] rounded-md p-3 text-sm text-[#a6e3a1] glass">
          <span className="font-bold text-[#89b4fa]">เคล็ดลับ:</span> กด Enter เพื่อเลื่อนช่อง ถ้ายู่ช่องสุดท้ายจะเพิ่มรายการ กด <span className="bg-[#0a0e14] px-2 py-0.5 rounded border border-[#2a3244]">F4</span> เพื่อบันทึกบิล
        </div>
      </div>

      {/* Right Panel: List & Sum */}
      <div className="w-1/2 flex flex-col bg-[#0d1117]">
        <div className="px-4 py-3 border-b border-[#1e2433] flex justify-between items-center bg-[#11151e]">
          <span className="text-sm text-[#cdd6f4] font-bold">รายการ ({entries.length})</span>
          <span className="text-xs text-[#6c7086]">F4 = บันทึกบิล</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center text-[#6c7086] text-sm mt-10">ยังไม่มีรายการ</div>
          ) : (
            entries.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-center bg-[#1e2433] px-4 py-2 rounded border border-[#2a3244]">
                <div className="flex items-center gap-4">
                  <span className="text-[#a6e3a1] font-mono text-lg font-bold tracking-widest">{entry.number}</span>
                  <span className="text-[10px] bg-[#2a3244] px-2 py-1 rounded text-[#cdd6f4]">{entry.type}</span>
                </div>
                <div className="text-[#cdd6f4] font-bold">฿{entry.amount}</div>
              </div>
            ))
          )}
        </div>

        <div className="bg-[#11151e] border-t border-[#1e2433] p-4 flex justify-between items-center">
          <div className="text-sm text-[#6c7086]">
            ยอดรวม: <span className="text-[#a6e3a1] text-xl font-bold ml-2">฿{totalAmount}</span>
          </div>
          <button 
            onClick={saveBill}
            disabled={isSaving || entries.length === 0}
            className="bg-[#1a3a20] hover:bg-[#223f28] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกบิล [F4]'}
          </button>
        </div>
      </div>
    </div>
  );
}
