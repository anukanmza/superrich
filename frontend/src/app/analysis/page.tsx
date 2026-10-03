'use client';
console.log('AI page loaded');

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCustomers, fetchBills, getSettings, Customer, Bill } from '../../lib/api';
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

  const [analysisTab, setAnalysisTab] = useState<'risk' | 'ai'>('risk');
  const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);
  const [aiPredictedTop3, setAiPredictedTop3] = useState<string[]>([]);
  const [aiPredictedTop2, setAiPredictedTop2] = useState<string[]>([]);
  const [aiPredictedBot2, setAiPredictedBot2] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPredictedAt, setAiPredictedAt] = useState<string | null>(null);
  const [aiHistoryRecords, setAiHistoryRecords] = useState<any[]>([]);
  
  // AI Settings
  const [apiKeyOverride, setApiKeyOverride] = useState('');
  const [modelOverride, setModelOverride] = useState(''); // empty string means default
  const [showAiSettings, setShowAiSettings] = useState(false);
  
  const [aiStats, setAiStats] = useState<any>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showPastDataForm, setShowPastDataForm] = useState(false);
  const [newPeriod, setNewPeriod] = useState('');
  const [newTop3, setNewTop3] = useState('');
  const [newBot2, setNewBot2] = useState('');
  const [aiTop3, setAiTop3] = useState('');
  const [aiTop2, setAiTop2] = useState('');
  const [aiBot2, setAiBot2] = useState('');
  const [isAddingHistory, setIsAddingHistory] = useState(false);

  useEffect(() => {
    if (analysisTab === 'ai' && !aiStats) {
      loadAiStats();
    }
  }, [analysisTab]);

  useEffect(() => {
    // Load saved settings every time the settings panel is opened
    if (showAiSettings) {
      try {
        const savedKey = localStorage.getItem('lotto_ai_apikey');
        if (savedKey) setApiKeyOverride(savedKey);
        const savedModel = localStorage.getItem('lotto_ai_model');
        if (savedModel) setModelOverride(savedModel);
      } catch(e) {}
    }
  }, [showAiSettings]);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('lotto_ai_apikey', apiKeyOverride);
      localStorage.setItem('lotto_ai_model', modelOverride);
      alert('บันทึกการตั้งค่าลงในเครื่องของคุณเรียบร้อยแล้ว');
      setShowAiSettings(false);
    } catch(e: any) {
      alert('ไม่สามารถบันทึกได้: ' + e.message);
    }
  };

  const loadAiStats = async () => {
    try {
      const { getAiStats, getLatestPrediction, getAiHistory } = await import('../../lib/api');
      const [stats, latest, history] = await Promise.all([getAiStats(), getLatestPrediction(), getAiHistory()]);
      setAiStats(stats);
      setAiHistoryRecords(history || []);
      
      if (latest && latest.predictedTop3 && latest.predictedTop3.length > 0 && !aiPredictedTop3.length && !aiAnalysisText) {
        setAiAnalysisText(latest.analysis);
        setAiPredictedTop3(latest.predictedTop3);
        setAiPredictedTop2(latest.predictedTop2);
        setAiPredictedBot2(latest.predictedBot2);
        if (latest.createdAt) {
          setAiPredictedAt(new Date(latest.createdAt).toLocaleString('th-TH'));
        }
        
        // Auto-fill inputs for feedback form
        setAiTop3(latest.predictedTop3.join(', '));
        setAiTop2(latest.predictedTop2.join(', '));
        setAiBot2(latest.predictedBot2.join(', '));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunAi = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      // Need to use dynamic import or the api client if available
      const { getAnalysis } = await import('../../lib/api');
      const result = await getAnalysis({ apiKey: apiKeyOverride || undefined, model: modelOverride || undefined });
      setAiAnalysisText(result.analysis);
      setAiPredictedTop3(result.predictedTop3 || []);
      setAiPredictedTop2(result.predictedTop2 || []);
      setAiPredictedBot2(result.predictedBot2 || []);
      setAiPredictedAt(new Date().toLocaleString('th-TH'));
      
      // Auto-fill feedback form
      setAiTop3((result.predictedTop3 || []).join(', '));
      setAiTop2((result.predictedTop2 || []).join(', '));
      setAiBot2((result.predictedBot2 || []).join(', '));
      
      loadAiStats(); // reload stats
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddHistory = async () => {
    if (!newPeriod || !newTop3 || !newBot2) {
      setAiError('กรุณากรอกงวดและผลรางวัลให้ครบถ้วน');
      return;
    }
    setIsAddingHistory(true);
    try {
      const { addAiHistory } = await import('../../lib/api');
      
      const payload: any = { period: newPeriod, top3: newTop3, bot2: newBot2 };
      
      // Parse AI predictions if provided
      if (aiTop3) payload.aiTop3 = aiTop3.split(',').map(s => s.trim());
      if (aiTop2) payload.aiTop2 = aiTop2.split(',').map(s => s.trim());
      if (aiBot2) payload.aiBot2 = aiBot2.split(',').map(s => s.trim());

      await addAiHistory(payload);
      setShowFeedbackForm(false);
      setShowPastDataForm(false);
      setNewPeriod('');
      setNewTop3('');
      setNewBot2('');
      setAiTop3('');
      setAiTop2('');
      setAiBot2('');
      setAiError(null);
      loadAiStats();
      alert('บันทึกผลการทดสอบสำเร็จ!');
    } catch (err: any) {
      setAiError('ไม่สามารถเพิ่มข้อมูลได้: ' + err.message);
    } finally {
      setIsAddingHistory(false);
    }
  };

  const handleAddPastData = async () => {
    if (!newPeriod || !newTop3 || !newBot2) {
      setAiError('กรุณากรอกงวดและผลรางวัลให้ครบถ้วน');
      return;
    }
    setIsAddingHistory(true);
    try {
      const { addAiHistory } = await import('../../lib/api');
      
      // Explicitly only send the draw results, NO AI predictions
      const payload: any = { period: newPeriod, top3: newTop3, bot2: newBot2 };

      await addAiHistory(payload);
      setShowPastDataForm(false);
      setNewPeriod('');
      setNewTop3('');
      setNewBot2('');
      setAiError(null);
      loadAiStats();
      alert('เพิ่มข้อมูลประวัติสำเร็จ!');
    } catch (err: any) {
      setAiError('ไม่สามารถเพิ่มข้อมูลได้: ' + err.message);
    } finally {
      setIsAddingHistory(false);
    }
  };

  const handleResetStats = async () => {
    if (!confirm('ยืนยันที่จะล้างข้อมูลความแม่นยำของ AI ทั้งหมด? (ประวัติการออกรางวัลยังคงอยู่)')) return;
    try {
      const { resetAiStats } = await import('../../lib/api');
      await resetAiStats();
      alert('ล้างข้อมูลความแม่นยำเรียบร้อยแล้ว');
      loadAiStats();
    } catch (err: any) {
      alert('ไม่สามารถล้างข้อมูลได้: ' + err.message);
    }
  };

  if (isLoading) return <div className="p-8 text-[#cdd6f4]">กำลังโหลดโมเดลวิเคราะห์...</div>;

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-auto p-4">
      <div className="flex justify-between items-center mb-6 border-b border-[#1e2433] pb-4">
        <div className="flex gap-4">
          <button 
            onClick={() => setAnalysisTab('risk')}
            className={`text-xl font-bold pb-2 border-b-2 transition-colors ${analysisTab === 'risk' ? 'text-[#89b4fa] border-[#89b4fa]' : 'text-[#6c7086] border-transparent hover:text-[#cdd6f4]'}`}
          >
            📊 วิเคราะห์ความเสี่ยง (Risk)
          </button>
          <button 
            onClick={() => setAnalysisTab('ai')}
            className={`text-xl font-bold pb-2 border-b-2 transition-colors ${analysisTab === 'ai' ? 'text-[#cba6f7] border-[#cba6f7]' : 'text-[#6c7086] border-transparent hover:text-[#cdd6f4]'}`}
          >
            🤖 AI ช่วยวิเคราะห์หวย
          </button>
        </div>
        
        {analysisTab === 'risk' && (
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
        )}
      </div>

      {analysisTab === 'ai' ? (
        <div className="flex flex-col items-center mt-4 pb-12">
          
          {/* Top Panel: Stats & Controls */}
          <div className="w-full max-w-5xl flex gap-6 mb-8 items-start justify-center flex-wrap">
            
            {/* Stats Box */}
            {aiStats && (
              <div className="bg-[#11151e] border border-[#2a3244] rounded-xl p-4 flex-1 min-w-[300px] shadow-lg">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[#a6e3a1] font-bold text-lg flex items-center gap-2">
                    <span className="text-xl">🎯</span> สถิติความแม่นยำของ AI
                  </h3>
                  <button onClick={handleResetStats} className="text-[10px] text-[#f38ba8] hover:underline px-2 py-1 bg-[#f38ba8]/10 rounded border border-[#f38ba8]/30">
                    รีเซ็ตความแม่นยำ
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-[#cdd6f4]">
                  <div className="bg-[#1e1e2e] p-3 rounded-lg">
                    <div className="text-[#6c7086] text-xs mb-1">จำนวนครั้งที่ AI ให้หวย</div>
                    <div className="font-bold text-lg text-[#89b4fa]">{aiStats.totalPredictions} ครั้ง</div>
                  </div>
                  <div className="bg-[#1e1e2e] p-3 rounded-lg">
                    <div className="text-[#6c7086] text-xs mb-1">ประวัติการออกรางวัลจริง</div>
                    <div className="font-bold text-lg text-[#cba6f7]">{aiStats.totalHistorical} งวด</div>
                  </div>
                  <div className="bg-[#1e1e2e] p-3 rounded-lg col-span-2 flex justify-between items-center">
                    <div>
                      <div className="text-[#6c7086] text-xs mb-2">ความแม่นยำ (คำนวณจาก {aiStats.evaluatedCount} งวดที่มีการให้หวย)</div>
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="text-[#f9e2af]">3 ตัวบน: <span className="font-bold text-sm">{aiStats.top3Hits}/{aiStats.evaluatedCount}</span> ({aiStats.accuracyTop3})</span>
                        <span className="text-[#89dceb]">2 ตัวบน: <span className="font-bold text-sm">{aiStats.top2Hits}/{aiStats.evaluatedCount}</span> ({aiStats.accuracyTop2})</span>
                        <span className="text-[#f38ba8]">2 ตัวล่าง: <span className="font-bold text-sm">{aiStats.bot2Hits}/{aiStats.evaluatedCount}</span> ({aiStats.accuracyBot2})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Box */}
            <div className="bg-[#11151e] border border-[#2a3244] rounded-xl p-6 flex-1 min-w-[300px] shadow-lg flex flex-col justify-center items-center relative">
              <div className="absolute top-4 right-4">
                <button onClick={() => setShowAiSettings(!showAiSettings)} className="text-sm text-[#89b4fa] hover:underline bg-[#89b4fa]/10 px-3 py-1 rounded-full border border-[#89b4fa]/30 transition-colors">
                  ⚙️ ตั้งค่า AI
                </button>
              </div>

              <p className="text-[#6c7086] mb-6 mt-4 text-center text-sm px-4">
                ระบบใช้ AI อัจฉริยะวิเคราะห์ผลรางวัลย้อนหลัง ร่วมกับสถิติและการล็อคเลข เพื่อหาเลขที่มีโอกาสออกมากที่สุด 8 ชุด
              </p>

              {showAiSettings && (
                <div className="w-full bg-[#181825] border border-[#313244] rounded-lg p-4 mb-6 shadow-inner text-left">
                  <h4 className="text-[#cba6f7] font-bold text-sm mb-3">⚙️ ตั้งค่าการเชื่อมต่อ AI</h4>
                  <div className="mb-3">
                    <label className="text-xs text-[#a6adc8] block mb-1">API Key (ทับซ้อนค่าเริ่มต้นของระบบ)</label>
                    <input 
                      type="password" 
                      value={apiKeyOverride}
                      onChange={e => setApiKeyOverride(e.target.value)}
                      placeholder="วาง Gemini API Key ของคุณที่นี่ (เว้นว่างเพื่อใช้ค่าระบบ)" 
                      className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-xs focus:border-[#89b4fa] outline-none transition-colors"
                    />
                    <div className="text-[10px] text-[#6c7086] mt-1">รับฟรีได้ที่ Google AI Studio</div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-[#a6adc8] block mb-1">โมเดล AI (เวอร์ชัน)</label>
                    <select 
                      value={modelOverride} 
                      onChange={e => setModelOverride(e.target.value)}
                      className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-xs focus:border-[#89b4fa] outline-none"
                    >
                      <option value="">-- ใช้ค่ามาตรฐานของระบบ (แนะนำ) --</option>
                      <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                      <option value="gemini-3.7-flash">gemini-3.7-flash</option>
                      <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                      <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash (ใหม่ล่าสุด & เร็ว)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (เสถียร)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (ฉลาดที่สุดแต่อาจช้า)</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={handleSaveSettings}
                      className="bg-[#a6e3a1] text-[#11111b] px-4 py-2 rounded text-xs font-bold hover:opacity-90"
                    >
                      💾 บันทึกการตั้งค่า
                    </button>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleRunAi}
                disabled={isAiLoading}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-lg transition-all w-full justify-center ${
                  isAiLoading 
                    ? 'bg-[#181825] text-[#6c7086] cursor-not-allowed' 
                    : 'bg-gradient-to-r from-[#cba6f7] to-[#89b4fa] text-[#11111b] hover:opacity-90 shadow-[0_0_15px_rgba(203,166,247,0.3)]'
                }`}
              >
                {isAiLoading ? '⏳ กำลังประมวลผลข้อมูล...' : '✨ เริ่มการวิเคราะห์เชิงลึก'}
              </button>
              
              <div className="flex gap-4 mt-4 w-full">
                <button 
                  onClick={() => { setShowFeedbackForm(!showFeedbackForm); setShowPastDataForm(false); }}
                  className="flex-1 text-xs text-[#a6e3a1] bg-[#181825] border border-[#a6e3a1]/20 py-2 rounded hover:bg-[#a6e3a1]/10 transition-colors"
                >
                  🎯 ตรวจสอบความแม่นยำ (งวดล่าสุด)
                </button>
                <button 
                  onClick={() => { setShowPastDataForm(!showPastDataForm); setShowFeedbackForm(false); }}
                  className="flex-1 text-xs text-[#89b4fa] bg-[#181825] border border-[#89b4fa]/20 py-2 rounded hover:bg-[#89b4fa]/10 transition-colors"
                >
                  📚 เพิ่มข้อมูลผลรางวัลย้อนหลัง (สร้างฐานข้อมูล)
                </button>
              </div>
            </div>
          </div>

          {/* Past Data Form (No AI Preds) */}
          {showPastDataForm && (
            <div className="w-full max-w-4xl bg-[#1e1e2e] border border-[#89b4fa]/30 rounded-xl p-6 shadow-xl mb-8 transition-all animate-fadeIn">
              <h3 className="text-[#89b4fa] font-bold mb-4 flex items-center gap-2 border-b border-[#313244] pb-2">
                📚 เพิ่มข้อมูลผลรางวัลย้อนหลัง
              </h3>
              <p className="text-xs text-[#6c7086] mb-6">ใช้สำหรับสร้างฐานข้อมูลตั้งต้นให้ AI ได้เรียนรู้รูปแบบการออกรางวัลในอดีต (ไม่จำเป็นต้องกรอกเลขที่ AI ให้)</p>
              
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="text-xs text-[#6c7086] block mb-1">ชื่องวด (เช่น 1 พ.ย. 68)</label>
                  <input type="text" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-sm" placeholder="ชื่องวด..." />
                </div>
                <div>
                  <label className="text-xs text-[#6c7086] block mb-1">ผลรางวัล 3 ตัวบน</label>
                  <input type="text" value={newTop3} onChange={e => setNewTop3(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#a6e3a1] text-sm" placeholder="เช่น 123" />
                </div>
                <div>
                  <label className="text-xs text-[#6c7086] block mb-1">ผลรางวัล 2 ตัวล่าง</label>
                  <input type="text" value={newBot2} onChange={e => setNewBot2(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#a6e3a1] text-sm" placeholder="เช่น 45" />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#313244] pt-4">
                <button onClick={() => setShowPastDataForm(false)} className="px-6 py-2 rounded bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a] font-bold text-sm">ยกเลิก</button>
                <button onClick={handleAddPastData} disabled={isAddingHistory} className="px-6 py-2 rounded bg-[#89b4fa] text-[#11111b] hover:opacity-90 font-bold text-sm">
                  {isAddingHistory ? 'กำลังบันทึก...' : 'บันทึกฐานข้อมูล'}
                </button>
              </div>
            </div>
          )}

          {/* AI Feedback Form */}
          {showFeedbackForm && (
            <div className="w-full max-w-4xl bg-[#1e1e2e] border border-[#cba6f7]/30 rounded-xl p-6 shadow-xl mb-8 transition-all animate-fadeIn">
              <h3 className="text-[#cba6f7] font-bold mb-4 flex items-center gap-2 border-b border-[#313244] pb-2">
                📝 บันทึกประวัติและตรวจสอบความแม่นยำ AI
              </h3>
              
              <div className="grid grid-cols-2 gap-8 mb-6">
                {/* AI Input Section */}
                <div>
                  <h4 className="text-[#89b4fa] font-bold mb-3 text-sm">1. เลขที่ AI วิเคราะห์ได้ (คั่นด้วยลูกน้ำ)</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">AI 3 ตัวบน (เช่น 123, 456)</label>
                      <input type="text" value={aiTop3} onChange={e => setAiTop3(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#f9e2af] text-sm" placeholder="123, 456..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">AI 2 ตัวบน (เช่น 12, 34)</label>
                      <input type="text" value={aiTop2} onChange={e => setAiTop2(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#89dceb] text-sm" placeholder="12, 34..." />
                    </div>
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">AI 2 ตัวล่าง (เช่น 56, 78)</label>
                      <input type="text" value={aiBot2} onChange={e => setAiBot2(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#f38ba8] text-sm" placeholder="56, 78..." />
                    </div>
                  </div>
                </div>

                {/* Actual Result Section */}
                <div>
                  <h4 className="text-[#a6e3a1] font-bold mb-3 text-sm">2. ผลรางวัลที่ออกจริง</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">ชื่องวด</label>
                      <input type="text" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#cdd6f4] text-sm" placeholder="เช่น 16 พฤศจิกายน 2568" />
                    </div>
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">ผลรางวัล 3 ตัวบน (รางวัลที่ 1)</label>
                      <input type="text" value={newTop3} onChange={e => setNewTop3(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#a6e3a1] text-sm" placeholder="เช่น 123" />
                    </div>
                    <div>
                      <label className="text-xs text-[#6c7086] block mb-1">ผลรางวัล 2 ตัวล่าง</label>
                      <input type="text" value={newBot2} onChange={e => setNewBot2(e.target.value)} className="w-full bg-[#11111b] border border-[#313244] rounded p-2 text-[#a6e3a1] text-sm" placeholder="เช่น 45" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#313244] pt-4">
                <button onClick={() => setShowFeedbackForm(false)} className="px-6 py-2 rounded bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a] font-bold text-sm">ยกเลิก</button>
                <button onClick={handleAddHistory} disabled={isAddingHistory} className="px-6 py-2 rounded bg-gradient-to-r from-[#cba6f7] to-[#a6e3a1] text-[#11111b] hover:opacity-90 font-bold text-sm">
                  {isAddingHistory ? 'กำลังบันทึก...' : 'บันทึกข้อมูล & คำนวณความแม่นยำ'}
                </button>
              </div>
            </div>
          )}

          {aiError && (
            <div className="w-full max-w-3xl bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded-lg p-4 text-[#f38ba8] mb-6 text-center">
              {aiError}
            </div>
          )}

          {/* AI Result Sets */}
          {aiPredictedTop3.length > 0 && (
            <div className="w-full max-w-5xl mb-6">
              <h3 className="text-[#89b4fa] font-bold text-xl mb-4 border-b border-[#2a3244] pb-2">🎯 8 ชุดตัวเลขเด่นประจำงวด</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1e1e2e] border border-[#313244] rounded-lg p-4">
                  <div className="text-center font-bold text-[#f9e2af] mb-3">3 ตัวบน</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {aiPredictedTop3.map((num, i) => (
                      <span key={i} className="px-3 py-1 bg-[#f9e2af]/10 border border-[#f9e2af]/30 rounded text-[#f9e2af] text-lg font-mono">{num}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1e1e2e] border border-[#313244] rounded-lg p-4">
                  <div className="text-center font-bold text-[#89dceb] mb-3">2 ตัวบน</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {aiPredictedTop2.map((num, i) => (
                      <span key={i} className="px-3 py-1 bg-[#89dceb]/10 border border-[#89dceb]/30 rounded text-[#89dceb] text-lg font-mono">{num}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-[#1e1e2e] border border-[#313244] rounded-lg p-4">
                  <div className="text-center font-bold text-[#f38ba8] mb-3">2 ตัวล่าง</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {aiPredictedBot2.map((num, i) => (
                      <span key={i} className="px-3 py-1 bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded text-[#f38ba8] text-lg font-mono">{num}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Text */}
          {aiAnalysisText && (
            <div className="w-full max-w-5xl bg-[#11151e] border border-[#2a3244] rounded-xl p-6 shadow-xl text-[#cdd6f4] whitespace-pre-wrap leading-relaxed relative mb-8">
              <div className="absolute top-0 right-0 px-4 py-1 bg-[#2a3244] text-[#a6adc8] text-xs rounded-bl-lg rounded-tr-xl font-bold flex gap-4">
                <span>บทวิเคราะห์เชิงลึก</span>
                {aiPredictedAt && <span className="text-[#89b4fa]">🕒 อัปเดตล่าสุด: {aiPredictedAt}</span>}
              </div>
              <div className="pt-2">
                {aiAnalysisText}
              </div>
            </div>
          )}

          {/* AI Accuracy History Table */}
          {aiHistoryRecords.length > 0 && (
            <div className="w-full max-w-5xl bg-[#11151e] border border-[#2a3244] rounded-xl p-6 shadow-xl mt-4">
              <h3 className="text-[#cba6f7] font-bold text-lg mb-4 border-b border-[#313244] pb-2 flex items-center gap-2">
                <span className="text-xl">📜</span> ประวัติการตรวจสอบความแม่นยำ AI ย้อนหลัง
              </h3>
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto rounded-lg custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#11151e] z-10 shadow-md">
                    <tr className="text-[#6c7086] border-b border-[#313244] text-left">
                      <th className="py-2 px-2">งวด</th>
                      <th className="py-2 px-2">3 ตัวบน (ออกจริง)</th>
                      <th className="py-2 px-2">2 ตัวล่าง (ออกจริง)</th>
                      <th className="py-2 px-2">ผล AI ทาย 3 บน</th>
                      <th className="py-2 px-2">ผล AI ทาย 2 บน</th>
                      <th className="py-2 px-2">ผล AI ทาย 2 ล่าง</th>
                      <th className="py-2 px-2">วันที่บันทึก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiHistoryRecords.map((r, i) => {
                      const hasAi = r.aiPredictedTop3 != null;
                      return (
                        <tr key={i} className="border-b border-[#181825] hover:bg-[#181825] transition-colors">
                          <td className="py-3 px-2 text-[#cdd6f4]">{r.period}</td>
                          <td className="py-3 px-2 text-[#a6e3a1] font-mono">{r.top3}</td>
                          <td className="py-3 px-2 text-[#a6e3a1] font-mono">{r.bot2}</td>
                          {hasAi ? (
                            <>
                              <td className={`py-3 px-2 font-bold ${r.isHitTop3 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>{r.isHitTop3 ? '✅ ถูก' : '❌ ผิด'}</td>
                              <td className={`py-3 px-2 font-bold ${r.isHitTop2 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>{r.isHitTop2 ? '✅ ถูก' : '❌ ผิด'}</td>
                              <td className={`py-3 px-2 font-bold ${r.isHitBot2 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>{r.isHitBot2 ? '✅ ถูก' : '❌ ผิด'}</td>
                            </>
                          ) : (
                            <td colSpan={3} className="py-3 px-2 text-[#6c7086] text-center italic">ฐานข้อมูลตั้งต้น (ไม่มีการทาย)</td>
                          )}
                          <td className="py-3 px-2 text-[#6c7086] text-xs">{new Date(r.createdAt).toLocaleString('th-TH')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
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
      </>)}
    </div>
  );
}
