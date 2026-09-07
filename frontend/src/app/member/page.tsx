'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchBills, getSettings, Bill } from '../../lib/api';
import { getLimit } from '../../lib/lotto';

const ALL_TYPES = ['3บน', '3โต้ด', '2บน', '2ล่าง', '3ล่าง'];

export default function MemberDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<any[]>([]);
  
  const [pinRequired, setPinRequired] = useState(false);
  const [correctPin, setCorrectPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('3บน');
  const [shopName, setShopName] = useState('แดชบอร์ดสมาชิก');
  const [period, setPeriod] = useState('');

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchBills(), getSettings()])
      .then(([billsData, settingsData]) => {
        setBills(billsData);
        if (settingsData.keeps_json) try { setKeeps(JSON.parse(settingsData.keeps_json)); } catch (e) {}
        if (settingsData.specificLimits_json) try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json)); } catch (e) {}
        if (settingsData.cutouts_json) try { setCutoutHistory(JSON.parse(settingsData.cutouts_json)); } catch (e) {}
        
        if (settingsData.general_shopName) setShopName(settingsData.general_shopName);
        if (settingsData.general_period) setPeriod(settingsData.general_period);

        if (settingsData.member_pin && settingsData.member_pin.trim() !== '') {
          setPinRequired(true);
          setCorrectPin(settingsData.member_pin);
          const savedAuth = sessionStorage.getItem('member_auth');
          if (savedAuth === 'true') {
            setIsAuthenticated(true);
          }
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin === correctPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem('member_auth', 'true');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const rows = useMemo(() => {
    const rawMap: Record<string, number> = {};
    bills.forEach(b => {
      (b.entries || []).forEach(e => {
        if (!e) return;
        const type = e.type || '';
        let numKey = e.number || '';
        if (type === '3โต้ด' && numKey.length === 3) {
          numKey = numKey.split('').sort().join('');
        }
        const k = `${numKey}|${type}`;
        rawMap[k] = (rawMap[k] || 0) + (e.amount || 0);
      });
    });

    const sentMap: Record<string, number> = {};
    cutoutHistory.forEach((r: any) => {
      let numKey = r.num || '';
      if (r.type === '3โต้ด' && numKey.length === 3) numKey = numKey.split('').sort().join('');
      const k = `${numKey}|${r.type}`;
      sentMap[k] = (sentMap[k] || 0) + (r.amount || 0);
    });

    const res = Object.keys(rawMap).map(k => {
      const [num, type] = k.split('|');
      const limit = getLimit(num, type, keeps, specificLimits);
      const rawTotal = rawMap[k] || 0;
      const sent = sentMap[k] || 0;
      const current = Math.max(0, rawTotal - sent);
      const keepAmt = Math.min(current, Math.max(0, limit));
      const available = Math.max(0, limit - keepAmt);

      return { num, type, keep: keepAmt, limit, available };
    });

    return res;
  }, [bills, keeps, specificLimits, cutoutHistory]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  if (pinRequired && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0e14] p-4">
        <form onSubmit={handleLogin} className="bg-[#11151e] border border-[#2a3244] p-8 rounded-xl shadow-lg max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-[#cdd6f4] mb-2">{shopName}</h1>
          <p className="text-sm text-[#6c7086] mb-6">กรุณาใส่รหัสผ่านเพื่อเข้าดูยอด</p>
          
          <input 
            type="password" 
            value={inputPin}
            onChange={e => setInputPin(e.target.value)}
            placeholder="รหัสผ่าน (PIN)"
            className="w-full bg-[#0d1117] border border-[#2a3244] rounded-lg px-4 py-3 text-center text-xl tracking-widest text-[#cdd6f4] outline-none focus:border-[#89b4fa] mb-4"
            autoFocus
          />
          {pinError && <p className="text-xs text-[#f38ba8] mb-4">รหัสผ่านไม่ถูกต้อง</p>}
          
          <button type="submit" className="w-full bg-[#89b4fa] text-[#0d1117] font-bold rounded-lg px-4 py-3 hover:bg-[#74c7ec] transition-colors">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    );
  }

  const filteredRows = rows
    .filter(r => r.type === activeTab)
    .filter(r => search ? r.num.includes(search) : true)
    .sort((a, b) => b.keep - a.keep || a.num.localeCompare(b.num));

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-hidden p-4 md:p-6 lg:max-w-4xl lg:mx-auto w-full">
      <div className="flex items-center justify-between bg-[#11151e] border border-[#2a3244] rounded-lg p-4 mb-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[#f9e2af]">📊 {shopName}</h1>
          {period && <p className="text-xs text-[#6c7086]">งวด: {period}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#a6e3a1]">อัปเดตล่าสุด: {new Date().toLocaleTimeString('th-TH')}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4 shrink-0">
        <div className="flex overflow-x-auto pb-1 gap-2 flex-1 scrollbar-hide">
          {ALL_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${activeTab === t ? 'bg-[#89b4fa] text-[#0d1117]' : 'bg-[#11151e] text-[#6c7086] border border-[#2a3244]'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input 
          type="text" 
          placeholder="ค้นหาเลข..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#11151e] border border-[#2a3244] rounded-lg px-4 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa] md:w-48"
        />
      </div>

      <div className="flex-1 overflow-auto bg-[#11151e] border border-[#2a3244] rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0d1117] shadow-sm">
            <tr>
              <th className="py-3 px-4 text-left text-[#6c7086] font-normal w-1/4">เลข</th>
              <th className="py-3 px-4 text-right text-[#a6e3a1] font-normal w-1/4">ยอดที่เก็บไว้</th>
              <th className="py-3 px-4 text-right text-[#f9e2af] font-normal w-1/4">ว่างรับได้อีก</th>
              <th className="py-3 px-4 text-right text-[#6c7086] font-normal w-1/4 hidden sm:table-cell">วงเงินเต็ม</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, i) => (
              <tr key={i} className="border-b border-[#1e2433] hover:bg-[#181825]">
                <td className="py-3 px-4 text-[#cdd6f4] font-bold text-lg font-mono">{r.num}</td>
                <td className="py-3 px-4 text-right text-[#a6e3a1] font-bold">฿{r.keep.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-[#f9e2af] font-bold">
                  {r.available > 0 ? `฿${r.available.toLocaleString()}` : <span className="text-[#f38ba8] text-xs">เต็มแล้ว</span>}
                </td>
                <td className="py-3 px-4 text-right text-[#6c7086] hidden sm:table-cell">฿{r.limit.toLocaleString()}</td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[#6c7086]">ไม่มีข้อมูลเลขในหมวดหมู่นี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-center mt-3 text-[10px] text-[#45475a]">
        Lotto Dealer Pro - Member Dashboard
      </div>
    </div>
  );
}
