'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchBills, getSettings, Bill } from '../../lib/api';
import { getPerms, getLimit } from '../../lib/lotto';
import * as XLSX from 'xlsx';

const ALL_TYPES = ['2บน', '2ล่าง', '2โต้ด', '3บน', '3ล่าง', '3โต้ด'];

type OverviewRow = {
  num: string;
  displayNum: string;
  type: string;
  rawTotal: number;
  limit: number;
  sent: number;
  current: number;
  keep: number;
  pending: number;
};

export default function OverviewPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [keeps, setKeeps] = useState<Record<string, string>>({});
  const [specificLimits, setSpecificLimits] = useState<any[]>([]);
  const [cutoutHistory, setCutoutHistory] = useState<any[]>([]);

  // UI States
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchBills(), getSettings()])
      .then(([billsData, settingsData]) => {
        setBills(billsData);
        if (settingsData.keeps_json) {
          try { setKeeps(JSON.parse(settingsData.keeps_json) || {}); } catch (e) {}
        }
        if (settingsData.specificLimits_json) {
          try { setSpecificLimits(JSON.parse(settingsData.specificLimits_json) || []); } catch (e) {}
        }
        if (settingsData.cutouts_json) {
          try { setCutoutHistory(JSON.parse(settingsData.cutouts_json) || []); } catch (e) {}
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const { rows, baseRows } = useMemo(() => {
    const sentMap: Record<string, number> = {};
    (cutoutHistory || []).forEach((r: any) => {
      if (!r) return;
      let numKey = r.num || '';
      if (r.type === '3โต้ด' && numKey.length === 3) numKey = numKey.split('').sort().join('');
      const k = `${numKey}|${r.type}`;
      sentMap[k] = (sentMap[k] || 0) + (r.amount || 0);
    });

    const map: Record<string, OverviewRow> = {};
    (bills || []).forEach(b => {
      (b.entries || []).forEach(e => {
        if (!e) return;
        const type = e.type || '';
        let numKey = e.number || '';
        if (type === '3โต้ด' && numKey.length === 3) numKey = numKey.split('').sort().join('');
        const k = `${numKey}|${type}`;
        
        if (!map[k]) {
          let displayNum = numKey;
          if (type === '3โต้ด' && numKey.length === 3) {
            displayNum = getPerms(numKey).sort().join('/');
          }
          
          map[k] = {
            num: numKey,
            displayNum,
            type,
            rawTotal: 0,
            limit: getLimit(numKey, type, keeps, specificLimits),
            sent: 0,
            current: 0,
            keep: 0,
            pending: 0
          };
        }
        map[k].rawTotal += (e.amount || 0);
      });
    });

    Object.keys(map).forEach(k => {
      const r = map[k];
      r.sent = sentMap[k] || 0;
      r.current = Math.max(0, r.rawTotal - r.sent);
      r.keep = Math.min(r.current, r.limit);
      r.pending = Math.max(0, r.current - r.limit);
    });

    const allBaseRows = Object.values(map);
    
    let filteredRows = allBaseRows;
    if (selectedTypes.size !== ALL_TYPES.length) {
      filteredRows = filteredRows.filter(r => selectedTypes.has(r.type));
    }
    
    filteredRows.sort((a, b) => {
      const aNum = parseInt(a.num) || 0;
      const bNum = parseInt(b.num) || 0;
      if (sortAsc) {
        return (aNum - bNum) || a.type.localeCompare(b.type);
      }
      return (b.rawTotal - a.rawTotal) || (aNum - bNum) || a.type.localeCompare(b.type);
    });

    return { rows: filteredRows, baseRows: allBaseRows };
  }, [bills, cutoutHistory, keeps, specificLimits, selectedTypes, sortAsc]);

  const toggleType = (t: string) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(t)) newSet.delete(t);
    else newSet.add(t);
    setSelectedTypes(newSet);
  };

  const setAllTypes = () => {
    setSelectedTypes(new Set(ALL_TYPES));
  };

  const exportExcel = () => {
    const data: any[][] = [
      ['ภาพรวม', `ส่งออกวันที่ ${new Date().toLocaleDateString('en-CA')}`],
      [],
      ['#', 'เลข/ชุดกลับ', 'ประเภท', 'ยอดรับรวม', 'ยอดรับจริง', 'ยอดรอส่งออก', 'ยอดส่งออกแล้ว']
    ];

    rows.forEach((r, i) => {
      data.push([
        i + 1,
        r.displayNum,
        r.type,
        r.rawTotal,
        r.keep,
        r.pending,
        r.sent
      ]);
    });

    data.push([]);
    data.push([
      'รวม', '', '', 
      rows.reduce((s, r) => s + r.rawTotal, 0),
      rows.reduce((s, r) => s + r.keep, 0),
      rows.reduce((s, r) => s + r.pending, 0),
      rows.reduce((s, r) => s + r.sent, 0)
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:5}, {wch:28}, {wch:10}, {wch:14}, {wch:14}, {wch:14}, {wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ภาพรวม');
    XLSX.writeFile(wb, `lotto_ภาพรวม_${new Date().toLocaleDateString('en-CA')}.xlsx`);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#cdd6f4]">กำลังโหลดข้อมูลภาพรวม...</div>;
  }

  const totalRaw = baseRows.reduce((s, r) => s + r.rawTotal, 0);
  const totalKeep = baseRows.reduce((s, r) => s + r.keep, 0);
  const totalSent = baseRows.reduce((s, r) => s + r.sent, 0);
  const totalPending = baseRows.reduce((s, r) => s + r.pending, 0);
  
  const counts: Record<string, number> = {};
  ALL_TYPES.forEach(t => counts[t] = 0);
  rows.forEach(r => { if (counts[r.type] !== undefined) counts[r.type]++; });

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-hidden">
      {/* Toolbar */}
      <div className="bg-[#0d1117] border-b border-[#1e2433] px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
        <h2 className="text-[13px] font-bold text-[#cdd6f4] mr-2">📌 ภาพรวม</h2>
        
        <div className="flex items-center gap-2 flex-wrap">
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

        <div className="w-px h-5 bg-[#2a3244] mx-2"></div>

        <label className="flex items-center gap-1 text-[10px] text-[#f9e2af] bg-[#141008] border border-[#6b5929] rounded px-2 py-1 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={sortAsc}
            onChange={(e) => setSortAsc(e.target.checked)}
            className="accent-[#f9e2af]"
          />
          เรียงเลขน้อย → มาก
        </label>

        <div className="ml-auto flex gap-2">
          <button 
            onClick={exportExcel}
            className="bg-[#1a3a20] hover:bg-[#223f28] text-[#a6e3a1] border border-[#2d6b36] px-3 py-1.5 rounded text-[11px] font-bold transition-colors"
          >
            📥 ส่งออก Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col">
        {/* Note */}
        <div className="text-[10px] text-[#6c7086] mb-3">
          ยอดรับจริง = ยอดที่เก็บไว้ตามวงเงินหลังหักส่งออกแล้ว | ยอดรอส่งออก = ส่วนที่ยังเกินวงเงินและยังไม่ได้กดส่งออก | 3โต้ดรวมเป็นชุดกลับเดียวกัน
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 shrink-0">
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-3">
            <div className="text-[10px] text-[#6c7086] mb-1">ยอดรับรวม</div>
            <div className="text-[17px] font-bold text-[#a6e3a1]">฿{totalRaw.toLocaleString()}</div>
          </div>
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-3">
            <div className="text-[10px] text-[#6c7086] mb-1">ยอดเลขเก็บรวม</div>
            <div className="text-[17px] font-bold text-[#a6e3a1]">฿{totalKeep.toLocaleString()}</div>
          </div>
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-3">
            <div className="text-[10px] text-[#6c7086] mb-1">ยอดส่งออกรวม</div>
            <div className="text-[17px] font-bold text-[#f38ba8]">฿{totalSent.toLocaleString()}</div>
          </div>
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-3">
            <div className="text-[10px] text-[#6c7086] mb-1">ยอดรอส่งออก</div>
            <div className="text-[17px] font-bold text-[#f9e2af]">฿{totalPending.toLocaleString()}</div>
          </div>
        </div>

        {/* Counts Pill */}
        <div className="bg-[#11151e] border border-[#1e2433] rounded-lg p-2.5 mb-3 flex flex-wrap gap-2 items-center shrink-0">
          <span className="text-[10px] text-[#6c7086] mr-1">จำนวนเลขที่มียอดแยกตามประเภท:</span>
          {ALL_TYPES.map(t => (
            <span key={t} className="inline-block px-2 py-1 rounded text-[10px] font-bold border border-[#2a3244] bg-[#0d1117] text-[#cdd6f4]">
              {t} : {counts[t]}
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="border border-[#1e2433] rounded-lg bg-[#0d1117] overflow-auto flex-1 min-h-0">
          <table className="w-full text-xs min-w-[800px] border-collapse">
            <thead className="sticky top-0 bg-[#11151e] z-10 shadow">
              <tr>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-center w-12">#</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-left">เลข/ชุดกลับ</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-right">ประเภท</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-right">ยอดรับรวม</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-right">ยอดรับจริง</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-right">ยอดรอส่งออก</th>
                <th className="p-2 border-b border-[#1e2433] text-[#6c7086] font-normal text-right">ยอดส่งออกแล้ว</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-[#45475a] border border-dashed border-[#2a3244] m-4 rounded bg-[#0d1117]">
                    ยังไม่มีข้อมูลตามเงื่อนไขนี้
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.num}-${r.type}`} className="border-b border-[#13171f] hover:bg-[#11151e]">
                    <td className="p-2 text-center text-[#cdd6f4]">{i + 1}</td>
                    <td className="p-2 text-left">
                      <span className="text-[#a6e3a1] font-bold tracking-widest font-mono text-[13px]">{r.displayNum}</span>
                    </td>
                    <td className="p-2 text-right">
                      <span className="bg-[#313244] text-[#cdd6f4] px-1.5 py-0.5 rounded text-[10px]">{r.type}</span>
                    </td>
                    <td className="p-2 text-right text-[#cdd6f4]">{r.rawTotal.toLocaleString()}</td>
                    <td className="p-2 text-right text-[#a6e3a1] font-bold">{r.keep.toLocaleString()}</td>
                    <td className="p-2 text-right text-[#f9e2af] font-bold">
                      {r.pending.toLocaleString()}
                      {r.pending > 0 && <span className="text-[#f38ba8] font-black ml-1">*</span>}
                    </td>
                    <td className="p-2 text-right text-[#f38ba8] font-bold">{r.sent.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
