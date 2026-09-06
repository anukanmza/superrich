'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchBills, getSettings, updateSettings, Bill } from '../../lib/api';

const ALL_TYPES = ['2บน', '2ล่าง', '2โต้ด', '3บน', '3ล่าง', '3โต้ด'];

interface CutoutRow {
  id: string; // num_type
  num: string;
  type: string;
  total: number;
  limit: number;
  keep: number;
  send: number; // total overage (total - limit)
  sent: number; // amount already sent out
  currentOverage: number; // send - sent
}

export default function CutoutPage() {
  const [activeTab, setActiveTab] = useState<'select' | 'send' | 'keep'>('select');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = () => {
    setIsLoading(true);
    Promise.all([fetchBills(), getSettings()])
      .then(([billsData, settingsData]) => {
        setBills(billsData);
        if (settingsData.keeps_json) {
          try { setKeeps(JSON.parse(settingsData.keeps_json)); } catch (e) {}
        }
        if (settingsData.specificLimits_json) {
          try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json)); } catch (e) {}
        }
        if (settingsData.cutouts_json) {
          try { setCutoutHistory(JSON.parse(settingsData.cutouts_json)); } catch (e) {}
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const getLimit = (num: string, type: string) => {
    let limit = parseFloat(keeps[type] || '0');
    const sp = specificLimits.find(x => x.num === num);
    if (sp && sp[type] && sp[type].trim() !== '') {
      limit = parseFloat(sp[type]);
    }
    return limit;
  };

  // Base aggregation
  const allRows = useMemo(() => {
    const agg: Record<string, Record<string, number>> = {};
    bills.forEach(b => b.entries.forEach(e => {
      if (!agg[e.number]) agg[e.number] = {};
      agg[e.number][e.type] = (agg[e.number][e.type] || 0) + e.amount;
    }));
    
    // Agg sent amounts
    const sentAgg: Record<string, Record<string, number>> = {};
    cutoutHistory.forEach(c => {
      if (!sentAgg[c.num]) sentAgg[c.num] = {};
      sentAgg[c.num][c.type] = (sentAgg[c.num][c.type] || 0) + c.amount;
    });

    const rows: CutoutRow[] = [];
    Object.keys(agg).forEach(num => {
      Object.keys(agg[num]).forEach(type => {
        const total = agg[num][type];
        const limit = getLimit(num, type);
        const keep = Math.min(total, limit);
        const send = Math.max(0, total - limit);
        const sent = sentAgg[num]?.[type] || 0;
        const currentOverage = Math.max(0, send - sent);
        
        rows.push({
          id: `${num}_${type}`,
          num,
          type,
          total,
          limit,
          keep,
          send,
          sent,
          currentOverage
        });
      });
    });
    
    return rows;
  }, [bills, keeps, specificLimits, cutoutHistory]);

  const filteredSelectRows = allRows.filter(r => r.currentOverage > 0 && selectedTypes.has(r.type));
  const filteredKeepRows = allRows.filter(r => r.keep > 0 && selectedTypes.has(r.type));
  const filteredHistoryRows = cutoutHistory.filter(r => selectedTypes.has(r.type)).reverse();

  // Stats for the select tab
  const totalRecv = allRows.reduce((sum, r) => sum + r.total, 0);
  const totalKeep = allRows.reduce((sum, r) => sum + r.keep, 0);
  const totalSendOverage = allRows.reduce((sum, r) => sum + r.send, 0);
  const overageCount = allRows.filter(r => r.currentOverage > 0).length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(filteredSelectRows.map(r => r.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendOut = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`ยืนยันการส่งออกเลขที่เลือก ${selectedRows.size} รายการ?`)) return;

    setIsSending(true);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-GB'); // HH:mm:ss
    const batchId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newCutouts: any[] = [];
    
    filteredSelectRows.forEach(r => {
      if (selectedRows.has(r.id)) {
        newCutouts.push({
          date: dateStr,
          time: timeStr,
          num: r.num,
          type: r.type,
          limit: r.limit,
          amount: r.currentOverage, // export remaining overage
          rawTotal: r.total,
          batchId
        });
      }
    });

    const updatedHistory = [...cutoutHistory, ...newCutouts];

    try {
      await updateSettings({ cutouts_json: JSON.stringify(updatedHistory) });
      setCutoutHistory(updatedHistory);
      setSelectedRows(new Set());
      alert('ส่งออกเลขเรียบร้อยแล้ว');
      setActiveTab('send');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งออก');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-[#cdd6f4]">กำลังโหลด...</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col bg-[#11151e]">
      
      {/* Header & Sub-tabs */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('select')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'select' ? 'bg-[#89b4fa] text-[#11151e]' : 'bg-[#1e2433] text-[#a6adc8] hover:bg-[#313244]'}`}
          >
            1. คัดเลขส่งออก
          </button>
          <button 
            onClick={() => setActiveTab('send')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'send' ? 'bg-[#89b4fa] text-[#11151e]' : 'bg-[#1e2433] text-[#a6adc8] hover:bg-[#313244]'}`}
          >
            2. รายงานเลขส่งออก
          </button>
          <button 
            onClick={() => setActiveTab('keep')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === 'keep' ? 'bg-[#89b4fa] text-[#11151e]' : 'bg-[#1e2433] text-[#a6adc8] hover:bg-[#313244]'}`}
          >
            3. รายงานเลขเก็บ
          </button>
        </div>
        
        {/* Checkbox Filters */}
        <div className="flex gap-4 items-center bg-[#0d1117] px-4 py-2 rounded-md border border-[#1e2433]">
          <span className="text-xs text-[#6c7086] font-bold">ประเภท:</span>
          {ALL_TYPES.map(type => (
            <label key={type} className="flex items-center gap-1 cursor-pointer text-sm text-[#cdd6f4] select-none hover:text-[#89b4fa]">
              <input 
                type="checkbox" 
                className="accent-[#89b4fa]"
                checked={selectedTypes.has(type)}
                onChange={() => toggleType(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[#1e2433] p-4 rounded-lg border border-[#2a3244]">
          <div className="text-xs text-[#6c7086] mb-1">ยอดรับทั้งหมด</div>
          <div className="text-xl font-bold text-[#a6e3a1]">฿{totalRecv.toLocaleString()}</div>
        </div>
        <div className="bg-[#1e2433] p-4 rounded-lg border border-[#2a3244]">
          <div className="text-xs text-[#6c7086] mb-1">ยอดเก็บตามวงเงิน</div>
          <div className="text-xl font-bold text-[#a6e3a1]">฿{totalKeep.toLocaleString()}</div>
        </div>
        <div className="bg-[#1e2433] p-4 rounded-lg border border-[#2a3244]">
          <div className="text-xs text-[#6c7086] mb-1">ยอดต้องส่งออก (Total)</div>
          <div className="text-xl font-bold text-[#f38ba8]">฿{totalSendOverage.toLocaleString()}</div>
        </div>
        <div className="bg-[#1e2433] p-4 rounded-lg border border-[#2a3244]">
          <div className="text-xs text-[#6c7086] mb-1">รายการที่รอส่งออก</div>
          <div className="text-xl font-bold text-[#f9e2af]">{overageCount} รายการ</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0d1117] rounded-lg border border-[#1e2433]">
        
        {/* TAB 1: SELECT */}
        {activeTab === 'select' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[#1e2433] flex justify-between items-center bg-[#181825]">
              <div>
                <h2 className="text-[#89b4fa] font-bold">คัดเลขส่งออก</h2>
                <div className="text-xs text-[#6c7086]">แสดงเฉพาะเลขที่ยอดรับเกินวงเงิน เลือกและกดส่งออกเพื่อตัดยอด</div>
              </div>
              <button 
                onClick={handleSendOut}
                disabled={selectedRows.size === 0 || isSending}
                className="bg-[#f38ba8] hover:bg-[#d20f39] text-[#11151e] px-4 py-2 rounded font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'กำลังประมวลผล...' : `📤 ส่งออก ${selectedRows.size} รายการ`}
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-[#1e2433] text-[#a6adc8] shadow">
                  <tr>
                    <th className="p-3 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={filteredSelectRows.length > 0 && selectedRows.size === filteredSelectRows.length}
                        onChange={handleSelectAll}
                        className="accent-[#89b4fa]"
                      />
                    </th>
                    <th className="p-3">เลข</th>
                    <th className="p-3 text-center">ประเภท</th>
                    <th className="p-3 text-right">ยอดรับสุทธิ</th>
                    <th className="p-3 text-right">วงเงินเก็บ</th>
                    <th className="p-3 text-right">ส่งออกแล้ว</th>
                    <th className="p-3 text-right text-[#f38ba8]">ยอดต้องส่งออก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSelectRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-[#6c7086]">ไม่มีเลขเกินวงเงินในประเภทที่เลือก</td></tr>
                  ) : (
                    filteredSelectRows.map(r => (
                      <tr key={r.id} className="border-b border-[#181825] hover:bg-[#181825] transition-colors cursor-pointer" onClick={() => handleSelectRow(r.id)}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedRows.has(r.id)}
                            onChange={() => {}} // handled by row click
                            className="accent-[#89b4fa] pointer-events-none"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-[#a6e3a1]">{r.num}</td>
                        <td className="p-3 text-center"><span className="bg-[#313244] text-[#cdd6f4] px-2 py-1 rounded text-xs">{r.type}</span></td>
                        <td className="p-3 text-right text-[#cdd6f4]">{r.total.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#a6adc8]">{r.limit.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#f9e2af]">{r.sent.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#f38ba8] font-bold">{(r.currentOverage).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SEND HISTORY */}
        {activeTab === 'send' && (
          <div className="flex flex-col h-full">
             <div className="p-4 border-b border-[#1e2433] bg-[#181825]">
                <h2 className="text-[#89b4fa] font-bold">รายงานเลขส่งออก</h2>
                <div className="text-xs text-[#6c7086]">ประวัติการตัดยอดส่งออก</div>
             </div>
             <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-[#1e2433] text-[#a6adc8] shadow">
                  <tr>
                    <th className="p-3">วันที่/เวลา</th>
                    <th className="p-3">รหัสรอบ</th>
                    <th className="p-3">เลข</th>
                    <th className="p-3 text-center">ประเภท</th>
                    <th className="p-3 text-right">ยอดรับก่อนส่ง</th>
                    <th className="p-3 text-right">วงเงินเก็บ</th>
                    <th className="p-3 text-right text-[#f38ba8]">ยอดส่งออก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-[#6c7086]">ยังไม่มีประวัติการส่งออก</td></tr>
                  ) : (
                    filteredHistoryRows.map((r, i) => (
                      <tr key={i} className="border-b border-[#181825] hover:bg-[#181825]">
                        <td className="p-3 text-[#a6adc8]">{r.date} {r.time}</td>
                        <td className="p-3 text-xs text-[#6c7086] font-mono">{r.batchId}</td>
                        <td className="p-3 font-mono font-bold text-[#a6e3a1]">{r.num}</td>
                        <td className="p-3 text-center"><span className="bg-[#313244] text-[#cdd6f4] px-2 py-1 rounded text-xs">{r.type}</span></td>
                        <td className="p-3 text-right text-[#cdd6f4]">{r.rawTotal?.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#a6adc8]">{r.limit?.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#f38ba8] font-bold">{r.amount?.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: KEEP REPORT */}
        {activeTab === 'keep' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-[#1e2433] bg-[#181825]">
                <h2 className="text-[#89b4fa] font-bold">รายงานเลขเก็บ</h2>
                <div className="text-xs text-[#6c7086]">รายการยอดที่เก็บไว้หลังตัดส่งออกแล้ว (เฉพาะยอดที่ไม่เกินวงเงิน)</div>
             </div>
             <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-[#1e2433] text-[#a6adc8] shadow">
                  <tr>
                    <th className="p-3">เลข</th>
                    <th className="p-3 text-center">ประเภท</th>
                    <th className="p-3 text-right">ยอดรับสุทธิ</th>
                    <th className="p-3 text-right">วงเงินเก็บ</th>
                    <th className="p-3 text-right text-[#a6e3a1]">ยอดเก็บ</th>
                    <th className="p-3 text-right">ส่งออกแล้ว</th>
                    <th className="p-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeepRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-[#6c7086]">ไม่มีรายการเลขเก็บ</td></tr>
                  ) : (
                    filteredKeepRows.map(r => (
                      <tr key={r.id} className="border-b border-[#181825] hover:bg-[#181825]">
                        <td className="p-3 font-mono font-bold text-[#a6e3a1]">{r.num}</td>
                        <td className="p-3 text-center"><span className="bg-[#313244] text-[#cdd6f4] px-2 py-1 rounded text-xs">{r.type}</span></td>
                        <td className="p-3 text-right text-[#cdd6f4]">{r.total.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#a6adc8]">{r.limit.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#a6e3a1] font-bold">{r.keep.toLocaleString()}</td>
                        <td className="p-3 text-right text-[#f9e2af]">{r.sent.toLocaleString()}</td>
                        <td className="p-3 text-center">
                           {r.currentOverage > 0 ? (
                             <span className="bg-[#3b1e28] text-[#f38ba8] px-2 py-1 rounded text-xs border border-[#f38ba8]">ยังเกินวงเงิน</span>
                           ) : (
                             <span className="text-[#a6e3a1] text-xs">อยู่ในวงเงิน</span>
                           )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
