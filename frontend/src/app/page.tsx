'use client';

import React, { useState, useEffect, KeyboardEvent, useMemo } from 'react';
import { fetchCustomers, fetchBills, createBill, Customer, EntryInput, getSettings, Bill } from '../lib/api';
import { generateEntries, checkLimit } from '../lib/lotto';

export default function KeyingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  
  const [number, setNumber] = useState('');
  const [topAmt, setTopAmt] = useState('');
  const [botAmt, setBotAmt] = useState('');
  
  const [entries, setEntries] = useState<EntryInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lockAmt, setLockAmt] = useState(false);
  const isSavingRef = React.useRef(false);
  
  // Base Aggregation for limits
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lotto_keying_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.entries) setEntries(state.entries);
        if (state.number) setNumber(state.number);
        if (state.topAmt) setTopAmt(state.topAmt);
        if (state.botAmt) setBotAmt(state.botAmt);
        if (state.lockAmt) setLockAmt(state.lockAmt);
        if (state.selectedCustomerId) setSelectedCustomerId(state.selectedCustomerId);
      }
    } catch (e) {
      console.error('Failed to load from local storage', e);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('lotto_keying_state', JSON.stringify({
      entries, number, topAmt, botAmt, lockAmt, selectedCustomerId
    }));
  }, [entries, number, topAmt, botAmt, lockAmt, selectedCustomerId]);

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchBills(), getSettings()])
      .then(([customersData, billsData, settingsData]) => {
        setCustomers(customersData);
        if (customersData.length > 0 && !selectedCustomerId) setSelectedCustomerId(customersData[0].id);
        
        setBills(billsData);
        if (settingsData.keeps_json) {
          try { setKeeps(JSON.parse(settingsData.keeps_json)); } catch (e) {}
        }
        if (settingsData.specificLimits_json) {
          try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json)); } catch (e) {}
        }
      }).catch(err => console.error(err));
  }, []);

  const baseAgg = useMemo(() => {
    const agg: Record<string, Record<string, number>> = {};
    bills.forEach(b => b.entries.forEach(e => {
      if (!agg[e.number]) agg[e.number] = {};
      agg[e.number][e.type] = (agg[e.number][e.type] || 0) + e.amount;
    }));
    return agg;
  }, [bills]);

  // Create an array mapping each entry to whether it exceeds limits
  const entryExceedsLimit = useMemo(() => {
    const currentAgg: Record<string, Record<string, number>> = {};
    const result: boolean[] = [];
    
    // Process backwards since new entries are unshifted to the start of the array
    // Wait, the entries array is [newest, ...oldest].
    // To correctly calculate running total from oldest to newest, we iterate from right to left.
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      const baseVal = baseAgg[e.number]?.[e.type] || 0;
      if (!currentAgg[e.number]) currentAgg[e.number] = {};
      const currentVal = currentAgg[e.number][e.type] || 0;
      
      const newTotal = baseVal + currentVal + e.amount;
      currentAgg[e.number][e.type] = currentVal + e.amount;
      
      result[i] = checkLimit(e.number, e.type, newTotal, keeps, specificLimits);
    }
    return result;
  }, [entries, baseAgg, keeps, specificLimits]);

  const addEntry = () => {
    const newEntries = generateEntries(number, topAmt, botAmt);
    
    if (newEntries.length > 0) {
      setEntries(prev => [...newEntries, ...prev]);
      setNumber('');
      if (!lockAmt) {
        setTopAmt('');
        setBotAmt('');
      }
      document.getElementById('input-number')?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lockAmt) {
        addEntry();
      } else if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      } else {
        addEntry();
      }
    }
  };

  const handleSaveClick = () => {
    if (entries.length === 0 || !selectedCustomerId || isSavingRef.current) return;
    setShowConfirmModal(true);
  };

  const confirmSaveBill = async () => {
    if (entries.length === 0 || !selectedCustomerId || isSavingRef.current) return;
    setIsSaving(true);
    isSavingRef.current = true;
    try {
      await createBill({
        customerId: Number(selectedCustomerId),
        entries: entries,
      });
      alert('บันทึกบิลสำเร็จ!');
      setEntries([]);
      setNumber('');
      setTopAmt('');
      setBotAmt('');
      setShowConfirmModal(false);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกบิล');
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  // Keyboard shortcut listener for F4 on window level
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (!showConfirmModal) {
          handleSaveClick();
        } else {
          confirmSaveBill();
        }
      } else if (e.key === 'Escape' && showConfirmModal) {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [entries, selectedCustomerId, showConfirmModal]);

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
            <div className="flex-1 flex flex-col gap-1 relative">
              <label className="absolute -top-6 left-0 text-[10px] text-[#89b4fa] flex items-center gap-1 cursor-pointer select-none bg-[#1e2d3d] px-2 py-0.5 rounded border border-[#2a4a6b]">
                <input type="checkbox" checked={lockAmt} onChange={(e) => setLockAmt(e.target.checked)} className="accent-[#89b4fa] w-3 h-3"/>
                ล็อคยอด
              </label>
              <input 
                id="input-top"
                type="text"
                placeholder="บน"
                value={topAmt}
                readOnly={lockAmt}
                onChange={e => setTopAmt(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => handleKeyDown(e, 'input-bot')}
                className={`w-full bg-[#11151e] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa] ${lockAmt ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <input 
                id="input-bot"
                type="text"
                placeholder="ล่าง/โต้ด"
                value={botAmt}
                readOnly={lockAmt}
                onChange={e => setBotAmt(e.target.value.replace(/[^0-9*+]/g, ''))}
                onKeyDown={e => handleKeyDown(e)}
                className={`w-full bg-[#11151e] border border-[#2a3244] rounded px-3 py-4 text-[#cdd6f4] text-xl text-center outline-none focus:border-[#89b4fa] ${lockAmt ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="bg-[#1e2433] rounded-md p-3 text-sm text-[#a6e3a1] glass">
            <span className="font-bold text-[#89b4fa]">เคล็ดลับ:</span> กด Enter เพื่อเลื่อนช่อง ถ้ายู่ช่องสุดท้ายจะเพิ่มรายการ กด <span className="bg-[#0a0e14] px-2 py-0.5 rounded border border-[#2a3244]">F4</span> เพื่อบันทึกบิล
          </div>
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
                <div className="flex items-center gap-4">
                  <span className={`font-bold ${entryExceedsLimit[idx] ? 'text-[#f38ba8]' : 'text-[#cdd6f4]'}`}>
                    ฿{entry.amount} {entryExceedsLimit[idx] && <span className="text-xs ml-1">(เกิน)</span>}
                  </span>
                  <button 
                    onClick={() => setEntries(prev => prev.filter((_, i) => i !== idx))}
                    className="text-[#f38ba8] hover:bg-[#3b1e28] rounded px-2 py-1 text-xs transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-[#11151e] border-t border-[#1e2433] p-4 flex justify-between items-center">
          <div className="text-sm text-[#6c7086]">
            ยอดรวม: <span className="text-[#a6e3a1] text-xl font-bold ml-2">฿{totalAmount}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                if(window.confirm('คุณต้องการล้างรายการที่คีย์มาทั้งหมดใช่หรือไม่?')) setEntries([]);
              }}
              disabled={entries.length === 0}
              className="bg-[#1e1215] border border-[#3a2a2a] text-[#f38ba8] font-bold py-2 px-4 rounded hover:bg-[#3b1e28] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ล้างทั้งหมด
            </button>
            <button 
              onClick={handleSaveClick}
              disabled={isSaving || entries.length === 0}
              className="bg-[#1a3a20] hover:bg-[#223f28] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              บันทึกบิล [F4]
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#11151e] border border-[#2a4a6b] rounded-lg p-6 w-[400px] shadow-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold text-[#89b4fa] mb-2">ยืนยันการบันทึกบิล</h2>
              <div className="text-[#cdd6f4] text-sm">
                ลูกค้า: <span className="font-bold text-[#a6e3a1]">{customers.find(c => c.id === selectedCustomerId)?.name || 'ไม่ทราบชื่อ'}</span>
              </div>
              <div className="text-[#cdd6f4] text-sm mt-1">
                จำนวน: <span className="font-bold text-[#74c7ec]">{entries.length} รายการ</span>
              </div>
              <div className="text-[#cdd6f4] text-sm mt-1">
                ยอดรวม: <span className="font-bold text-[#f9e2af] text-xl">฿{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-[#1e1215] border border-[#3a2a2a] text-[#f38ba8] font-bold py-3 rounded hover:bg-[#3b1e28] transition-colors"
              >
                ยกเลิก (Esc)
              </button>
              <button 
                onClick={confirmSaveBill}
                disabled={isSaving}
                autoFocus
                className="flex-1 bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-3 rounded hover:bg-[#223f28] transition-colors shadow-[0_0_15px_rgba(166,227,161,0.2)]"
              >
                {isSaving ? 'กำลังบันทึก...' : 'ยืนยัน (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
