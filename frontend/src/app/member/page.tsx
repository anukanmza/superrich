'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchBills, getSettings, Bill } from '../../lib/api';
import { getLimit, isWinning, getPrizeRate } from '../../lib/lotto';

const ALL_TYPES = ['3บน', '3โต้ด', '2บน', '2ล่าง', '3ล่าง'];

export default function MemberDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<any[]>([]);
  const [rewards, setRewards] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [specificRates, setSpecificRates] = useState<any[]>([]);
  
  const [pinRequired, setPinRequired] = useState(false);
  const [correctPin, setCorrectPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['3บน']));
  const [shopName, setShopName] = useState('แดชบอร์ดสมาชิก');
  const [period, setPeriod] = useState('');
  const [activeMenu, setActiveMenu] = useState<'keep' | 'rewards'>('keep');

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchBills(), getSettings()])
      .then(([billsData, settingsData]) => {
        setBills(billsData);
        if (settingsData.keeps_json) try { setKeeps(JSON.parse(settingsData.keeps_json) || {}); } catch (e) {}
        if (settingsData.specificLimits_json) try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json) || []); } catch (e) {}
        if (settingsData.cutouts_json) try { setCutoutHistory(JSON.parse(settingsData.cutouts_json) || []); } catch (e) {}
        if (settingsData.results_json) try { setRewards(JSON.parse(settingsData.results_json) || {}); } catch (e) {}
        if (settingsData.rates_json) try { setRates(JSON.parse(settingsData.rates_json) || {}); } catch (e) {}
        if (settingsData.specificRates_json) try { setSpecificRates(JSON.parse(settingsData.specificRates_json) || []); } catch (e) {}
        
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

  const toggleType = (t: string) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(t)) newSet.delete(t);
    else newSet.add(t);
    setSelectedTypes(newSet);
  };
  const setAllTypes = () => {
    if (selectedTypes.size === ALL_TYPES.length) setSelectedTypes(new Set());
    else setSelectedTypes(new Set(ALL_TYPES));
  };

  const { totalKeepGlobal, totalPayoutGlobal, netProfitGlobal } = useMemo(() => {
    let tKeep = 0;
    let tPayout = 0;
    
    rows.forEach(r => {
      tKeep += r.keep;
      if (isWinning({ number: r.num, type: r.type }, rewards)) {
        const rate = getPrizeRate({ number: r.num, type: r.type }, rates, specificRates);
        tPayout += (r.keep * rate);
      }
    });
    
    return {
      totalKeepGlobal: tKeep,
      totalPayoutGlobal: tPayout,
      netProfitGlobal: tKeep - tPayout
    };
  }, [rows, rewards, rates, specificRates]);

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
    .filter(r => selectedTypes.has(r.type))
    .filter(r => search ? r.num.includes(search) : true)
    .sort((a, b) => b.keep - a.keep || a.num.localeCompare(b.num));

  const totalKeep = rows.reduce((s, r) => s + r.keep, 0);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);

  const filterTotalKeep = filteredRows.reduce((s, r) => s + r.keep, 0);
  const filterTotalLimit = filteredRows.reduce((s, r) => s + r.limit, 0);
  const filterTotalAvailable = filteredRows.reduce((s, r) => s + r.available, 0);

  const hasRewards = Object.keys(rewards).length > 0;

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

      <div className="flex gap-4 border-b border-[#2a3244] mb-4 shrink-0 px-2">
        <button 
          onClick={() => setActiveMenu('keep')}
          className={`pb-2 px-2 text-sm font-bold border-b-2 transition-colors ${activeMenu === 'keep' ? 'border-[#89b4fa] text-[#89b4fa]' : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'}`}
        >
          ยอดที่เก็บ / สถานะ
        </button>
        <button 
          onClick={() => setActiveMenu('rewards')}
          className={`pb-2 px-2 text-sm font-bold border-b-2 transition-colors ${activeMenu === 'rewards' ? 'border-[#f9e2af] text-[#f9e2af]' : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'}`}
        >
          ผลรางวัล
        </button>
      </div>

      {activeMenu === 'keep' ? (
        <>
          <div className="flex flex-col md:flex-row gap-3 mb-4 shrink-0 items-start md:items-center">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-[10px] text-[#6c7086]">ประเภท:</span>
              <button 
                onClick={setAllTypes}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${selectedTypes.size === ALL_TYPES.length ? 'bg-[#1e2d3d] text-[#89b4fa] border-[#2a4a6b]' : 'bg-[#11151e] text-[#cdd6f4] border-[#2a3244]'}`}
              >
                ทุกประเภท
              </button>
              {ALL_TYPES.map(t => (
                <label key={t} className="flex items-center gap-1 text-[10px] text-[#cdd6f4] bg-[#11151e] border border-[#2a3244] rounded px-2 py-1 cursor-pointer select-none hover:bg-[#181825]">
                  <input 
                    type="checkbox" 
                    checked={selectedTypes.has(t)}
                    onChange={() => toggleType(t)}
                    className="accent-[#89b4fa]"
                  />
                  {t}
                </label>
              ))}
            </div>
            <input 
              type="text" 
              placeholder="ค้นหาเลข..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#11151e] border border-[#2a3244] rounded-lg px-4 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa] w-full md:w-48"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 shrink-0">
            <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-2 flex justify-between items-center md:col-span-2">
              <div className="text-[10px] text-[#6c7086]">ยอดเลขเก็บรวม (ทั้งหมด)</div>
              <div className="text-[13px] font-bold text-[#cdd6f4]">฿{totalKeep.toLocaleString()}</div>
            </div>
            <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-2 flex justify-between items-center md:col-span-2">
              <div className="text-[10px] text-[#6c7086]">ยอดว่างรับได้ (ทั้งหมด)</div>
              <div className="text-[13px] font-bold text-[#f9e2af]">฿{totalAvailable.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 shrink-0">
            <div className="bg-[#11151e] border border-[#89b4fa] rounded-lg p-3 md:col-span-2">
              <div className="text-[10px] text-[#89b4fa] mb-1">ยอดเลขเก็บรวม (ที่เลือก)</div>
              <div className="text-[17px] font-bold text-[#a6e3a1]">฿{filterTotalKeep.toLocaleString()}</div>
            </div>
            <div className="bg-[#11151e] border border-[#89b4fa] rounded-lg p-3 md:col-span-2">
              <div className="text-[10px] text-[#89b4fa] mb-1">ยอดว่างรับได้ (ที่เลือก)</div>
              <div className="text-[17px] font-bold text-[#f9e2af]">฿{filterTotalAvailable.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[#11151e] border border-[#2a3244] rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0d1117] shadow-sm">
                <tr>
                  <th className="py-3 px-4 text-left text-[#6c7086] font-normal">เลข <span className="text-[10px] ml-1">(ประเภท)</span></th>
                  <th className="py-3 px-4 text-right text-[#a6e3a1] font-normal w-1/4">ยอดเก็บ</th>
                  <th className="py-3 px-4 text-right text-[#f9e2af] font-normal w-1/4">ว่างรับได้</th>
                  <th className="py-3 px-4 text-right text-[#6c7086] font-normal w-1/4 hidden sm:table-cell">วงเงิน</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={i} className="border-b border-[#1e2433] hover:bg-[#181825]">
                    <td className="py-3 px-4 text-[#cdd6f4] font-bold text-lg font-mono">
                      {r.num} <span className="text-[10px] text-[#6c7086] ml-2 font-sans">{r.type}</span>
                    </td>
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
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center overflow-auto pb-4">
          {hasRewards ? (
            <div className="w-full max-w-md space-y-6">
              <div className="bg-[#11151e] border border-[#f9e2af] rounded-lg p-6 text-center shadow-lg">
                <h2 className="text-xl font-bold text-[#f9e2af] mb-6">🏆 ผลรางวัลประจำงวด</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg col-span-2">
                    <div className="text-sm text-[#6c7086] mb-1">3 ตัวบน</div>
                    <div className="text-4xl font-bold text-[#cdd6f4] tracking-[0.2em]">{rewards['3บน'] || '-'}</div>
                  </div>
                  
                  <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg">
                    <div className="text-sm text-[#6c7086] mb-1">3 ตัวโต้ด</div>
                    <div className="text-xl font-bold text-[#f9e2af] tracking-[0.1em]">{rewards['3โต้ด'] || '-'}</div>
                  </div>

                  <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg">
                    <div className="text-sm text-[#6c7086] mb-1">2 ตัวบน</div>
                    <div className="text-2xl font-bold text-[#a6e3a1] tracking-[0.2em]">{rewards['2บน'] || '-'}</div>
                  </div>
                  
                  <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg col-span-2">
                    <div className="text-sm text-[#6c7086] mb-1">2 ตัวล่าง</div>
                    <div className="text-3xl font-bold text-[#f38ba8] tracking-[0.2em]">{rewards['2ล่าง'] || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-6 shadow-lg">
                <h2 className="text-lg font-bold text-[#89b4fa] mb-4 text-center">💰 สรุปผลประกอบการสุทธิ</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-[#0d1117] px-4 py-3 rounded-lg border border-[#2a3244]">
                    <span className="text-sm text-[#6c7086]">ยอดรับสุทธิ (ยอดเก็บ)</span>
                    <span className="font-bold text-[#a6e3a1]">฿{totalKeepGlobal.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-[#0d1117] px-4 py-3 rounded-lg border border-[#2a3244]">
                    <span className="text-sm text-[#6c7086]">ยอดถูกรางวัลรวม</span>
                    <span className="font-bold text-[#f38ba8]">฿{totalPayoutGlobal.toLocaleString()}</span>
                  </div>

                  <div className={`flex justify-between items-center px-4 py-4 rounded-lg border-2 ${netProfitGlobal >= 0 ? 'bg-[#1a3a20] border-[#2d6b36]' : 'bg-[#3d1820] border-[#6b2a36]'}`}>
                    <span className={`text-sm font-bold ${netProfitGlobal >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                      {netProfitGlobal >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}
                    </span>
                    <span className={`text-xl font-bold tracking-wider ${netProfitGlobal >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                      {netProfitGlobal >= 0 ? '+' : ''}{netProfitGlobal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 bg-[#11151e] border border-[#2a3244] rounded-lg max-w-md w-full mt-10">
              <div className="text-4xl mb-4">⏳</div>
              <h2 className="text-xl font-bold text-[#cdd6f4] mb-2">ผลรางวัลยังไม่ออก</h2>
              <p className="text-[#6c7086] text-sm">กรุณากลับมาตรวจสอบอีกครั้งในภายหลัง</p>
            </div>
          )}
        </div>
      )}

      <div className="text-center mt-3 text-[10px] text-[#45475a] shrink-0">
        Lotto Dealer Pro - Member Dashboard
      </div>
    </div>
  );
}
