'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCustomers, fetchBills, getSettings, fetchAiPredictions, Customer, Bill } from '../../lib/api';
import { getPerms, getLimit, getPrizeRate } from '../../lib/lotto';

type AnalyzedEntry = {
  num: string;
  type: string;
  rawAmt: number;
  netAmt: number;
  keepRaw: number;
  keepNet: number;
};

type OutcomeResult = {
  outcome: string;
  profit: number;
  payout: number;
};

export default function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'gross' | 'keep'>('keep');
  
  // AI State
  const [aiData, setAiData] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>('');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [specificRates, setSpecificRates] = useState<any[]>([]);

  // What-if config
  const [simDiscount, setSimDiscount] = useState<number | null>(null);
  const [simRateAdjust, setSimRateAdjust] = useState<number>(0);
  
  // Specific limit adjusters
  const [simLimitTop3, setSimLimitTop3] = useState<number>(0);
  const [simLimitTod3, setSimLimitTod3] = useState<number>(0);
  const [simLimitTop2, setSimLimitTop2] = useState<number>(0);
  const [simLimitBot2, setSimLimitBot2] = useState<number>(0);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchCustomers(), fetchBills(), getSettings()])
      .then(([customersData, billsData, settingsData]) => {
        setCustomers(customersData);
        setBills(billsData);
        if (settingsData.keeps_json) try { setKeeps(JSON.parse(settingsData.keeps_json)); } catch (e) {}
        if (settingsData.specificLimits_json) try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json)); } catch (e) {}
        if (settingsData.cutouts_json) try { setCutoutHistory(JSON.parse(settingsData.cutouts_json)); } catch (e) {}
        if (settingsData.rates_json) try { setRates(JSON.parse(settingsData.rates_json)); } catch (e) {}
        if (settingsData.specificRates_json) try { setSpecificRates(JSON.parse(settingsData.specificRates_json)); } catch (e) {}
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleFetchAi = async () => {
    setIsAiLoading(true);
    setAiError('');
    try {
      const data = await fetchAiPredictions();
      if (data.error) {
        setAiError(data.error);
      } else {
        setAiData(data);
      }
    } catch (e: any) {
      setAiError(e.message || 'Error fetching AI');
    } finally {
      setIsAiLoading(false);
    }
  };

  const engine = useMemo(() => {
    const discMap: Record<number, number> = {};
    customers.forEach(c => discMap[c.id] = c.disc || 0);

    const sentMap: Record<string, number> = {};
    cutoutHistory.forEach((r: any) => {
      let numKey = r.num || '';
      if (r.type === '3โต้ด' && numKey.length === 3) numKey = numKey.split('').sort().join('');
      const k = `${numKey}|${r.type}`;
      sentMap[k] = (sentMap[k] || 0) + (r.amount || 0);
    });

    const entryMap: Record<string, AnalyzedEntry> = {};
    
    bills.forEach(b => {
      const disc = simDiscount !== null ? simDiscount : (discMap[b.customerId] || 0);
      const discFactor = 1 - (disc / 100);
      
      (b.entries || []).forEach(e => {
        if (!e) return;
        const type = e.type || '';
        let numKey = e.number || '';
        if (type === '3โต้ด' && numKey.length === 3) numKey = numKey.split('').sort().join('');
        const k = `${numKey}|${type}`;
        
        if (!entryMap[k]) {
          entryMap[k] = { num: numKey, type, rawAmt: 0, netAmt: 0, keepRaw: 0, keepNet: 0 };
        }
        
        entryMap[k].rawAmt += (e.amount || 0);
        entryMap[k].netAmt += (e.amount || 0) * discFactor;
      });
    });

    Object.keys(entryMap).forEach(k => {
      const e = entryMap[k];
      
      let limitAdj = 0;
      if (e.type === '3บน') limitAdj = simLimitTop3 || 0;
      else if (e.type === '3โต้ด') limitAdj = simLimitTod3 || 0;
      else if (e.type === '2บน') limitAdj = simLimitTop2 || 0;
      else if (e.type === '2ล่าง') limitAdj = simLimitBot2 || 0;

      let limit = getLimit(e.num, e.type, keeps, specificLimits) + limitAdj;
      if (limit < 0) limit = 0;
      
      const sent = sentMap[k] || 0;
      const current = Math.max(0, e.rawAmt - sent);
      e.keepRaw = Math.min(current, limit);
      e.keepNet = e.rawAmt > 0 ? e.keepRaw * (e.netAmt / e.rawAmt) : 0;
    });

    const entries = Object.values(entryMap);
    
    const runSim = (typeFilter: string[], outLen: number, permsSupport: boolean = false) => {
      const subset = entries.filter(e => typeFilter.includes(e.type));
      let totalPremium = 0;
      subset.forEach(e => {
        totalPremium += viewMode === 'gross' ? e.netAmt : e.keepNet;
      });

      const results: OutcomeResult[] = [];
      const maxOut = Math.pow(10, outLen);
      
      for (let i = 0; i < maxOut; i++) {
        const outStr = i.toString().padStart(outLen, '0');
        let payout = 0;
        
        subset.forEach(e => {
          let isWin = false;
          if (e.type === '3โต้ด' && permsSupport) {
            isWin = getPerms(outStr).includes(e.num);
          } else {
            isWin = outStr === e.num;
          }
          
          if (isWin) {
            const amt = viewMode === 'gross' ? e.rawAmt : e.keepRaw;
            let rate = getPrizeRate({ number: e.num, type: e.type }, rates, specificRates) + (simRateAdjust || 0);
            if (rate < 0) rate = 0;
            payout += amt * rate;
          }
        });

        results.push({
          outcome: outStr,
          profit: totalPremium - payout,
          payout
        });
      }

      results.sort((a, b) => a.profit - b.profit);
      
      return {
        totalPremium,
        maxLoss: results[0].profit,
        maxProfit: results[results.length - 1].profit,
        riskPercent: results.length > 0 ? (results.filter(r => r.profit < 0).length / results.length) * 100 : 0,
        hotspots: results.slice(0, 10).filter(r => r.profit < 0)
      };
    };

    return {
      top3: runSim(['3บน'], 3, false),
      tod3: runSim(['3โต้ด'], 3, true),
      top2: runSim(['2บน'], 2, false),
      bot2: runSim(['2ล่าง'], 2, false),
      bot3: runSim(['3ล่าง'], 3, false)
    };
  }, [customers, bills, keeps, specificLimits, cutoutHistory, rates, specificRates, viewMode, simDiscount, simRateAdjust, simLimitTop3, simLimitTod3, simLimitTop2, simLimitBot2]);

  if (isLoading) return <div className="p-8 text-[#cdd6f4]">กำลังโหลดโมเดลวิเคราะห์...</div>;

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#89b4fa]">📊 วิเคราะห์ความเสี่ยง (Risk Analysis)</h2>
          <div className="text-xs text-[#6c7086] mt-1">จำลองผลหวยทุกรูปแบบ เพื่อดูความเสี่ยงและจุดที่ต้องระวัง</div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode('gross')}
            className={`px-4 py-2 rounded text-sm font-bold border transition-colors ${viewMode === 'gross' ? 'bg-[#1e2d3d] text-[#89b4fa] border-[#2a4a6b]' : 'bg-[#11151e] text-[#6c7086] border-[#2a3244]'}`}
          >
            วิเคราะห์ยอดรวม (Gross)
          </button>
          <button 
            onClick={() => setViewMode('keep')}
            className={`px-4 py-2 rounded text-sm font-bold border transition-colors ${viewMode === 'keep' ? 'bg-[#1e2d3d] text-[#89b4fa] border-[#2a4a6b]' : 'bg-[#11151e] text-[#6c7086] border-[#2a3244]'}`}
          >
            วิเคราะห์ยอดที่เก็บจริง (Keep)
          </button>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-[#11151e] border border-[#cba6f7] rounded-lg p-4 mb-4 flex flex-col gap-3 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#cba6f7]"></div>
        <div className="flex justify-between items-center border-b border-[#2a3244] pb-2">
          <div>
            <span className="text-[14px] text-[#cba6f7] font-bold mb-1 flex items-center gap-2">✨ AI วิเคราะห์ความน่าจะเป็น (จากสถิติย้อนหลัง 5 ปี)</span>
            <span className="text-[10px] text-[#cdd6f4]">ระบบจะวิเคราะห์แพทเทิร์นเลขเด่นจากข้อมูลประวัติการออกรางวัล 155 งวดล่าสุด</span>
          </div>
          <button 
            onClick={handleFetchAi}
            disabled={isAiLoading}
            className="bg-[#cba6f7] text-[#11111b] px-4 py-2 rounded font-bold text-sm hover:bg-[#b4befe] transition-colors disabled:opacity-50"
          >
            {isAiLoading ? 'กำลังวิเคราะห์...' : 'เรียก AI วิเคราะห์งวดนี้'}
          </button>
        </div>

        {aiError && <div className="text-[#f38ba8] text-sm p-2 bg-[#f38ba8]/10 rounded border border-[#f38ba8]/20">{aiError}</div>}
        
        {aiData && !aiError && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="text-[#cdd6f4] text-sm bg-[#1e1e2e] p-3 rounded border border-[#313244]">
              <span className="font-bold text-[#f9e2af] mr-2">📌 สรุปภาพรวมจาก AI:</span>
              {aiData.summary}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1e1e2e] p-3 rounded border border-[#313244]">
                <h4 className="text-[#a6e3a1] font-bold mb-2 text-sm border-b border-[#313244] pb-1">3 ตัวบน</h4>
                <div className="flex flex-col gap-2 h-40 overflow-y-auto pr-1">
                  {(aiData.top3 || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-[#181825] p-2 rounded">
                      <span className="text-lg font-bold tracking-widest text-[#cdd6f4]">{item.number}</span>
                      <span className="text-[#6c7086] text-right ml-2 leading-tight">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1e1e2e] p-3 rounded border border-[#313244]">
                <h4 className="text-[#89b4fa] font-bold mb-2 text-sm border-b border-[#313244] pb-1">2 ตัวบน</h4>
                <div className="flex flex-col gap-2 h-40 overflow-y-auto pr-1">
                  {(aiData.top2 || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-[#181825] p-2 rounded">
                      <span className="text-lg font-bold tracking-widest text-[#cdd6f4]">{item.number}</span>
                      <span className="text-[#6c7086] text-right ml-2 leading-tight">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1e1e2e] p-3 rounded border border-[#313244]">
                <h4 className="text-[#f38ba8] font-bold mb-2 text-sm border-b border-[#313244] pb-1">2 ตัวล่าง</h4>
                <div className="flex flex-col gap-2 h-40 overflow-y-auto pr-1">
                  {(aiData.bottom2 || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-[#181825] p-2 rounded">
                      <span className="text-lg font-bold tracking-widest text-[#cdd6f4]">{item.number}</span>
                      <span className="text-[#6c7086] text-right ml-2 leading-tight">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Sandbox */}
      <div className="bg-[#11151e] border border-[#2a4a6b] rounded-lg p-4 mb-4 flex flex-col gap-3 shrink-0">
        <div className="flex flex-col border-b border-[#2a3244] pb-2">
          <span className="text-[12px] text-[#89b4fa] font-bold mb-1">🛠 Simulation Config (ลองปรับค่า)</span>
          <span className="text-[10px] text-[#6c7086]">ค่าเหล่านี้ใช้จำลองเท่านั้น ไม่กระทบระบบจริง</span>
        </div>
        
        <div className="flex flex-wrap gap-6 items-center">
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            ส่วนลดเฉลี่ย (%):
            <input 
              type="number" 
              className="w-16 bg-[#0d1117] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#a6e3a1]"
              value={simDiscount === null ? '' : simDiscount}
              onChange={e => setSimDiscount(e.target.value === '' ? null : Number(e.target.value))}
              placeholder="ดึงจากลค."
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            ปรับเรทจ่าย (ทุกตัว):
            <input 
              type="number" 
              className="w-16 bg-[#0d1117] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#f9e2af]"
              value={simRateAdjust}
              onChange={e => setSimRateAdjust(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 items-center bg-[#0d1117] p-3 rounded border border-[#2a3244]">
          <span className="text-xs text-[#cdd6f4] mr-2">ปรับวงเงินเก็บ (+/-):</span>
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            3บน:
            <input 
              type="number" 
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#f38ba8]"
              value={simLimitTop3}
              onChange={e => setSimLimitTop3(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            3โต้ด:
            <input 
              type="number" 
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#f38ba8]"
              value={simLimitTod3}
              onChange={e => setSimLimitTod3(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            2บน:
            <input 
              type="number" 
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#f38ba8]"
              value={simLimitTop2}
              onChange={e => setSimLimitTop2(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#cdd6f4]">
            2ล่าง:
            <input 
              type="number" 
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1 outline-none text-[#f38ba8]"
              value={simLimitBot2}
              onChange={e => setSimLimitBot2(Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { title: 'กลุ่ม 3 บน', data: engine.top3 },
          { title: 'กลุ่ม 3 โต้ด', data: engine.tod3 },
          { title: 'กลุ่ม 2 บน', data: engine.top2 },
          { title: 'กลุ่ม 2 ล่าง', data: engine.bot2 },
          { title: 'กลุ่ม 3 ล่าง', data: engine.bot3 }
        ].map((g, i) => (
          <div key={i} className="bg-[#11151e] border border-[#1e2433] rounded-lg p-3 flex flex-col">
            <h3 className="font-bold text-[#cdd6f4] mb-3 border-b border-[#1e2433] pb-2 text-center">{g.title}</h3>
            
            <div className="flex flex-col gap-2 mb-3">
              <div className="bg-[#0d1117] p-2 rounded border border-[#1e2433] flex justify-between items-center">
                <span className="text-[10px] text-[#6c7086]">พรีเมียม</span>
                <span className="text-xs font-bold text-[#89b4fa]">฿{g.data.totalPremium ? g.data.totalPremium.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'}</span>
              </div>
              <div className="bg-[#0d1117] p-2 rounded border border-[#1e2433] flex justify-between items-center">
                <span className="text-[10px] text-[#6c7086]">ความเสี่ยง</span>
                <span className={`text-xs font-bold ${g.data.riskPercent > 20 ? 'text-[#f38ba8]' : g.data.riskPercent > 0 ? 'text-[#f9e2af]' : 'text-[#a6e3a1]'}`}>
                  {g.data.riskPercent ? g.data.riskPercent.toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="bg-[#0d1117] p-2 rounded border border-[#1e2433] flex flex-col items-center">
                <span className="text-[10px] text-[#6c7086]">เสียสูงสุด (Max Loss)</span>
                <span className={`text-base font-bold ${g.data.maxLoss && g.data.maxLoss < 0 ? 'text-[#f38ba8]' : 'text-[#a6e3a1]'}`}>
                  ฿{g.data.maxLoss ? g.data.maxLoss.toLocaleString(undefined, {maximumFractionDigits:0}) : '0'}
                </span>
              </div>
            </div>

            <div className="mt-auto">
              <div className="text-[10px] font-bold text-[#f38ba8] mb-1 flex items-center justify-center">
                ⚠️ Hotspots (ขาดทุน)
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-[#6c7086] border-b border-[#1e2433]">
                      <th className="text-left font-normal py-1">เลข</th>
                      <th className="text-right font-normal py-1">กำไร/ขาดทุน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.data.hotspots.map((h, j) => (
                      <tr key={j} className="border-b border-[#13171f] hover:bg-[#181825]">
                        <td className="py-1 text-[#cdd6f4] font-mono tracking-widest">{h.outcome}</td>
                        <td className={`py-1 text-right font-bold ${h.profit < 0 ? 'text-[#f38ba8]' : 'text-[#a6e3a1]'}`}>
                          ฿{h.profit.toLocaleString(undefined, {maximumFractionDigits:0})}
                        </td>
                      </tr>
                    ))}
                    {g.data.hotspots.length === 0 && (
                      <tr><td colSpan={2} className="py-2 text-center text-[#45475a]">ไม่มีความเสี่ยง</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
