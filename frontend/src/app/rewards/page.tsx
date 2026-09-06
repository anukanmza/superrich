'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCustomers, fetchBills, getSettings, updateSettings, Customer, Bill } from '../../lib/api';
import { isWinning, getPrizeRate } from '../../lib/lotto';

interface CutoutShipment {
  id: string;
  date: string;
  time: string;
  period: string;
  total: number;
  rows: Array<{
    num: string;
    displayNum?: string;
    type: string;
    amount: number;
    rawTotal: number;
    limit: number;
  }>;
}

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<'draw' | 'overall' | 'split'>('draw');
  const [isLoading, setIsLoading] = useState(true);

  // State Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [results, setResults] = useState<Record<string, string>>({
    '2บน': '', '2ล่าง': '', '3บน': '', '3โต้ด': ''
  });
  const [rates, setRates] = useState<Record<string, string>>({});
  const [specificRates, setSpecificRates] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<CutoutShipment[]>([]);

  // Local tab states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  
  // Input states for draw tab
  const [drawInputs, setDrawInputs] = useState<Record<string, string>>({
    '2บน': '', '2ล่าง': '', '3บน': '', '3โต้ด': ''
  });

  const loadData = () => {
    setIsLoading(true);
    Promise.all([fetchCustomers(), fetchBills(), getSettings()])
      .then(([customersData, billsData, settingsData]) => {
        setCustomers(customersData);
        setBills(billsData);
        
        if (settingsData.results_json) {
          try {
            const parsed = JSON.parse(settingsData.results_json);
            setResults(parsed);
            setDrawInputs(parsed);
          } catch (e) {}
        }
        
        if (settingsData.rates_json) {
          try { setRates(JSON.parse(settingsData.rates_json)); } catch (e) {}
        }
        if (settingsData.specificRates_json) {
          try { setSpecificRates(JSON.parse(settingsData.specificRates_json)); } catch (e) {}
        }
        
        if (settingsData.cutouts_json) {
          try { setCutoutHistory(JSON.parse(settingsData.cutouts_json)); } catch (e) {}
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDraw = async () => {
    try {
      await updateSettings({ results_json: JSON.stringify(drawInputs) });
      setResults(drawInputs);
      alert('บันทึกผลรางวัลเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกผลรางวัล');
    }
  };

  const handleClearDraw = async () => {
    if (!confirm('ยืนยันล้างผลรางวัล?')) return;
    const empty = { '2บน': '', '2ล่าง': '', '3บน': '', '3โต้ด': '' };
    try {
      await updateSettings({ results_json: JSON.stringify(empty) });
      setResults(empty);
      setDrawInputs(empty);
      alert('ล้างผลรางวัลเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
    }
  };

  // Pre-calculate winning entries and split logic
  const winningData = useMemo(() => {
    // 1. Calculate Sent Totals grouped by logical number and type
    const sentMap: Record<string, number> = {};
    cutoutHistory.forEach(batch => {
      batch.rows.forEach(r => {
        let numKey = r.num;
        if (r.type === '3โต้ด') numKey = r.num.split('').sort().join('');
        const k = `${numKey}|${r.type}`;
        sentMap[k] = (sentMap[k] || 0) + r.amount;
      });
    });

    // 2. Calculate Raw Totals (Total received) grouped by logical number and type
    const rawMap: Record<string, number> = {};
    bills.forEach(b => {
      b.entries.forEach(e => {
        let numKey = e.number;
        if (e.type === '3โต้ด') numKey = e.number.split('').sort().join('');
        const k = `${numKey}|${e.type}`;
        rawMap[k] = (rawMap[k] || 0) + e.amount;
      });
    });

    // 3. Evaluate winning entries
    const wins: any[] = [];
    bills.forEach(b => {
      b.entries.forEach(e => {
        if (isWinning({ number: e.number, type: e.type }, results)) {
          let numKey = e.number;
          if (e.type === '3โต้ด') numKey = e.number.split('').sort().join('');
          const k = `${numKey}|${e.type}`;
          
          const rate = getPrizeRate(e, rates, specificRates);
          const amt = e.amount;
          const payout = amt * rate;
          
          const raw = rawMap[k] || 0;
          const sent = sentMap[k] || 0;
          const ratio = raw > 0 ? Math.min(1, sent / raw) : 0;
          
          const sentAmt = amt * ratio;
          const keepAmt = amt - sentAmt;
          
          const payoutSent = sentAmt * rate;
          const payoutKeep = keepAmt * rate;

          wins.push({
            bill: b,
            customer: customers.find(c => c.id === b.customerId),
            entry: e,
            rate,
            amt,
            payout,
            sentAmt,
            keepAmt,
            payoutSent,
            payoutKeep
          });
        }
      });
    });
    
    return wins;
  }, [bills, results, cutoutHistory, rates, specificRates, customers]);

  // Overall Tab Data Grouped by Bill
  const overallSummary = useMemo(() => {
    let filteredWins = winningData;
    if (selectedCustomerId !== 'all') {
      filteredWins = filteredWins.filter(w => w.bill.customerId === parseInt(selectedCustomerId));
    }
    
    const billMap: Record<number, any> = {};
    filteredWins.forEach(w => {
      if (!billMap[w.bill.id]) {
        billMap[w.bill.id] = {
          bill: w.bill,
          customer: w.customer,
          count: 0,
          amt: 0,
          payout: 0,
          items: []
        };
      }
      billMap[w.bill.id].count += 1;
      billMap[w.bill.id].amt += w.amt;
      billMap[w.bill.id].payout += w.payout;
      billMap[w.bill.id].items.push(w);
    });
    
    return Object.values(billMap).sort((a, b) => b.payout - a.payout);
  }, [winningData, selectedCustomerId]);

  // Split Tab Data Grouped by Type
  const splitSummary = useMemo(() => {
    const typeMap: Record<string, any> = {
      '2บน': { count: 0, amt: 0, payout: 0, sentAmt: 0, payoutSent: 0, keepAmt: 0, payoutKeep: 0 },
      '2ล่าง': { count: 0, amt: 0, payout: 0, sentAmt: 0, payoutSent: 0, keepAmt: 0, payoutKeep: 0 },
      '3บน': { count: 0, amt: 0, payout: 0, sentAmt: 0, payoutSent: 0, keepAmt: 0, payoutKeep: 0 },
      '3โต้ด': { count: 0, amt: 0, payout: 0, sentAmt: 0, payoutSent: 0, keepAmt: 0, payoutKeep: 0 }
    };
    
    winningData.forEach(w => {
      const t = w.entry.type;
      if (typeMap[t]) {
        typeMap[t].count += 1;
        typeMap[t].amt += w.amt;
        typeMap[t].payout += w.payout;
        typeMap[t].sentAmt += w.sentAmt;
        typeMap[t].payoutSent += w.payoutSent;
        typeMap[t].keepAmt += w.keepAmt;
        typeMap[t].payoutKeep += w.payoutKeep;
      }
    });
    
    return ['2บน', '2ล่าง', '3บน', '3โต้ด'].map(t => ({ type: t, ...typeMap[t] })).filter(t => t.count > 0);
  }, [winningData]);


  if (isLoading) {
    return <div className="p-8 text-center text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14]">
      {/* Sub-Navigation */}
      <div className="flex border-b border-[#1e2433] bg-[#0d1117] p-2 gap-2">
        <button 
          onClick={() => setActiveTab('draw')}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors ${activeTab === 'draw' ? 'bg-[#1e2d3d] text-[#89b4fa] border border-[#2a4a6b]' : 'text-[#6c7086] hover:bg-[#11151e]'}`}
        >
          1. เลขรางวัลที่ออก
        </button>
        <button 
          onClick={() => setActiveTab('overall')}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors ${activeTab === 'overall' ? 'bg-[#1e2d3d] text-[#89b4fa] border border-[#2a4a6b]' : 'text-[#6c7086] hover:bg-[#11151e]'}`}
        >
          2. สรุปผลรางวัลได้เสียรวม
        </button>
        <button 
          onClick={() => setActiveTab('split')}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors ${activeTab === 'split' ? 'bg-[#1e2d3d] text-[#89b4fa] border border-[#2a4a6b]' : 'text-[#6c7086] hover:bg-[#11151e]'}`}
        >
          3. สรุปแยกส่งออก/เก็บไว้
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* TAB 1: DRAW */}
        {activeTab === 'draw' && (
          <div className="max-w-2xl mx-auto mt-8">
            <h2 className="text-xl font-bold text-[#89b4fa] mb-6 text-center">กรอกเลขรางวัลที่ออกงวดนี้</h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
              {['2บน', '2ล่าง', '3บน', '3โต้ด'].map(t => (
                <div key={t} className="bg-[#11151e] border border-[#2a3244] p-6 rounded-xl flex flex-col items-center">
                  <div className="text-sm text-[#6c7086] mb-2 font-bold">{t}</div>
                  <input 
                    type="text" 
                    maxLength={t.includes('2') ? 2 : 3}
                    value={drawInputs[t]}
                    onChange={(e) => setDrawInputs({...drawInputs, [t]: e.target.value.replace(/[^0-9]/g, '')})}
                    className="bg-[#181825] border border-[#313244] rounded p-3 w-32 text-center text-3xl font-mono text-[#a6e3a1] outline-none focus:border-[#89b4fa] font-bold"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mb-6">
              <button 
                onClick={handleSaveDraw}
                className="bg-[#1a3a20] hover:bg-[#223f28] border border-[#2d6b36] text-[#a6e3a1] font-bold py-3 px-8 rounded shadow-lg transition-colors"
              >
                บันทึกเลขรางวัล
              </button>
              <button 
                onClick={handleClearDraw}
                className="bg-[#1e1215] hover:bg-[#3b1e28] border border-[#3a2a2a] text-[#f38ba8] font-bold py-3 px-8 rounded transition-colors"
              >
                ล้างเลขรางวัล
              </button>
            </div>
            <div className="bg-[#1e2433] text-[#a6e3a1] p-4 rounded text-sm text-center border border-[#2d6b36]">
              <span className="font-bold text-[#f9e2af]">💡 หมายเหตุ: </span>
              3โต้ดจะตรวจแบบชุดกลับเดียวกัน เช่น ออก 123 จะถือว่า 132/213/231/312/321 ถูกรางวัล 3โต้ดด้วยอัตโนมัติ
            </div>
          </div>
        )}

        {/* TAB 2: OVERALL */}
        {activeTab === 'overall' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#89b4fa]">สรุปผลรางวัลได้เสียรวม</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6c7086]">กรองตามลูกค้า:</span>
                <select 
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="bg-[#11151e] border border-[#2a3244] rounded px-3 py-1.5 text-sm text-[#cdd6f4] outline-none"
                >
                  <option value="all">ลูกค้าทั้งหมด</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded">
                <div className="text-xs text-[#6c7086] mb-1">บิลที่ถูกรางวัล</div>
                <div className="text-2xl font-bold text-[#f9e2af]">{overallSummary.length}</div>
              </div>
              <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded">
                <div className="text-xs text-[#6c7086] mb-1">ยอดแทงที่ถูก</div>
                <div className="text-2xl font-bold text-[#a6e3a1]">฿{overallSummary.reduce((s, b) => s + b.amt, 0).toLocaleString()}</div>
              </div>
              <div className="bg-[#1e1215] border border-[#3a2a2a] p-4 rounded">
                <div className="text-xs text-[#f38ba8] mb-1 font-bold">ยอดเงินที่ต้องจ่าย (รวม)</div>
                <div className="text-2xl font-bold text-[#f38ba8]">฿{overallSummary.reduce((s, b) => s + b.payout, 0).toLocaleString()}</div>
              </div>
              <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded">
                <div className="text-xs text-[#6c7086] mb-1">เลขรางวัลที่ออกงวดนี้</div>
                <div className="text-sm text-[#cdd6f4]">
                  {Object.entries(results).map(([k, v]) => (
                    <div key={k}>{k}: <span className="font-bold text-[#a6e3a1]">{v || '-'}</span></div>
                  ))}
                </div>
              </div>
            </div>

            {overallSummary.length === 0 ? (
              <div className="text-center p-10 bg-[#11151e] border border-[#2a3244] rounded text-[#6c7086]">
                ไม่มีบิลที่ถูกรางวัล
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#11151e] border border-[#2a3244] rounded">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#181825] text-[#a6adc8] border-b border-[#2a3244]">
                    <tr>
                      <th className="p-3">รหัสบิล</th>
                      <th className="p-3">ลูกค้า</th>
                      <th className="p-3 text-center">จำนวนรายการถูก</th>
                      <th className="p-3 text-right">ยอดแทงที่ถูก</th>
                      <th className="p-3 text-right text-[#f38ba8]">ยอดเงินที่ต้องจ่าย</th>
                      <th className="p-3">รายละเอียด (เลขที่ถูก)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overallSummary.map((row, i) => (
                      <tr key={i} className="border-b border-[#1e2433] hover:bg-[#1e2433]">
                        <td className="p-3 font-mono text-[#89b4fa]">#{row.bill.id}</td>
                        <td className="p-3">{row.customer?.name || 'ไม่ทราบชื่อ'}</td>
                        <td className="p-3 text-center">{row.count}</td>
                        <td className="p-3 text-right">฿{row.amt.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-[#f38ba8]">฿{row.payout.toLocaleString()}</td>
                        <td className="p-3 text-xs text-[#a6adc8]">
                          {row.items.map((it: any, idx: number) => (
                            <div key={idx}>
                              <span className="font-bold text-[#a6e3a1]">{it.entry.number}</span> <span className="text-[#6c7086]">({it.entry.type})</span> : แทง {it.amt} จ่าย <span className="text-[#f38ba8]">฿{it.payout.toLocaleString()}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SPLIT */}
        {activeTab === 'split' && (
          <div>
            <h2 className="text-xl font-bold text-[#89b4fa] mb-4">สรุปแยกส่งออก/เก็บไว้ (Split Summary)</h2>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded">
                <div className="text-xs text-[#6c7086] mb-1">ยอดจ่ายรวมทั้งหมด</div>
                <div className="text-2xl font-bold text-[#f38ba8]">฿{splitSummary.reduce((s, r) => s + r.payout, 0).toLocaleString()}</div>
              </div>
              <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded">
                <div className="text-xs text-[#6c7086] mb-1">ยอดจ่ายส่วนที่เราส่งออก (เจ้าอื่นจ่าย)</div>
                <div className="text-2xl font-bold text-[#74c7ec]">฿{splitSummary.reduce((s, r) => s + r.payoutSent, 0).toLocaleString()}</div>
              </div>
              <div className="bg-[#1e1215] border border-[#3a2a2a] p-4 rounded">
                <div className="text-xs text-[#f38ba8] mb-1 font-bold">ยอดจ่ายส่วนที่เราเก็บไว้ (เราจ่าย)</div>
                <div className="text-2xl font-bold text-[#f38ba8]">฿{splitSummary.reduce((s, r) => s + r.payoutKeep, 0).toLocaleString()}</div>
              </div>
              <div className="bg-[#1a3a20] border border-[#2d6b36] p-4 rounded shadow-[0_0_15px_rgba(166,227,161,0.1)]">
                <div className="text-xs text-[#a6e3a1] mb-1 font-bold">ผลสุทธิที่ต้องควักเนื้อ (เราจ่ายจริง)</div>
                <div className="text-2xl font-bold text-[#a6e3a1]">฿{splitSummary.reduce((s, r) => s + r.payoutKeep, 0).toLocaleString()}</div>
              </div>
            </div>

            {splitSummary.length === 0 ? (
              <div className="text-center p-10 bg-[#11151e] border border-[#2a3244] rounded text-[#6c7086]">
                ไม่มีรายการที่ถูกรางวัล
              </div>
            ) : (
              <div className="overflow-x-auto bg-[#11151e] border border-[#2a3244] rounded">
                <table className="w-full text-right text-sm">
                  <thead className="bg-[#181825] text-[#a6adc8] border-b border-[#2a3244]">
                    <tr>
                      <th className="p-3 text-left">ประเภท</th>
                      <th className="p-3 text-center">จำนวนถูก</th>
                      <th className="p-3">ยอดแทงรวม</th>
                      <th className="p-3 text-[#f38ba8]">ยอดจ่ายรวม</th>
                      <th className="p-3">ยอดแทงส่งออก</th>
                      <th className="p-3 text-[#74c7ec]">ยอดจ่ายส่งออก</th>
                      <th className="p-3">ยอดแทงเก็บไว้</th>
                      <th className="p-3 font-bold text-[#f38ba8]">ยอดจ่ายเก็บไว้ (เราจ่าย)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {splitSummary.map((r, i) => (
                      <tr key={i} className="border-b border-[#1e2433] hover:bg-[#1e2433]">
                        <td className="p-3 text-left font-bold text-[#cdd6f4]">{r.type}</td>
                        <td className="p-3 text-center">{r.count}</td>
                        <td className="p-3">฿{r.amt.toLocaleString()}</td>
                        <td className="p-3 text-[#f38ba8]">฿{r.payout.toLocaleString()}</td>
                        <td className="p-3 text-[#6c7086]">฿{r.sentAmt.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="p-3 text-[#74c7ec]">฿{r.payoutSent.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="p-3 text-[#6c7086]">฿{r.keepAmt.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="p-3 font-bold text-[#f38ba8]">฿{r.payoutKeep.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 text-xs text-[#6c7086]">
              * การแยกส่งออก/เก็บไว้ จะอิงประวัติในเมนูคัดส่งออก และเฉลี่ยสัดส่วนเปอร์เซ็นต์ตามยอดรับแทงของเลขและประเภทนั้นๆ อย่างแม่นยำ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
