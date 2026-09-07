'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../../lib/api';

export default function KeepLimitsPage() {
  const [keeps, setKeeps] = useState({
    '2บน': '5000', '2ล่าง': '5000', '2โต้ด': '5000',
    '3บน': '3000', '3ล่าง': '3000', '3โต้ด': '3000',
    'วิ่งบน': '2000', 'วิ่งล่าง': '2000'
  });
  
  const [specificLimits, setSpecificLimits] = useState<{ num: string, '2บน': string, '2ล่าง': string, '2โต้ด': string, '3บน': string, '3ล่าง': string, '3โต้ด': string }[]>([]);
  const [spNum, setSpNum] = useState('');
  const [sp2b, setSp2b] = useState('');
  const [sp2l, setSp2l] = useState('');
  const [sp2t, setSp2t] = useState('');
  const [sp3b, setSp3b] = useState('');
  const [sp3l, setSp3l] = useState('');
  const [sp3t, setSp3t] = useState('');
  const [lockSpLimits, setLockSpLimits] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSettings().then(data => {
      if (data.keeps_json) {
        try {
          const parsed = JSON.parse(data.keeps_json);
          setKeeps(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to parse keeps', e);
        }
      }
      if (data.specificLimits_json) {
        try {
          const parsed = JSON.parse(data.specificLimits_json);
          setSpecificLimits(parsed);
        } catch (e) {
          console.error('Failed to parse specificLimits', e);
        }
      }
    }).catch(err => console.error(err));
  }, []);

  const updateKeep = (key: string, val: string) => {
    setKeeps(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        keeps_json: JSON.stringify(keeps),
        specificLimits_json: JSON.stringify(specificLimits)
      });
      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSpecific = () => {
    if (!spNum.trim()) return;
    setSpecificLimits(prev => [...prev, {
      num: spNum, '2บน': sp2b, '2ล่าง': sp2l, '2โต้ด': sp2t,
      '3บน': sp3b, '3ล่าง': sp3l, '3โต้ด': sp3t
    }]);
    setSpNum(''); 
    if (!lockSpLimits) {
      setSp2b(''); setSp2l(''); setSp2t(''); setSp3b(''); setSp3l(''); setSp3t('');
    }
    document.getElementById('sp-num')?.focus();
  };

  const handleUpdateSpecific = (idx: number, key: string, val: string) => {
    setSpecificLimits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const handleRemoveSpecific = (idx: number) => {
    setSpecificLimits(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#89b4fa] mb-2">รายการเก็บ — วงเงินที่รับได้</h2>
      <div className="text-xs text-[#6c7086] mb-6">วงเงินเฉพาะเจาะจงรายตัวมีความสำคัญสูงกว่า — ถ้าไม่ได้กำหนดจะใช้วงเงินตามประเภท</div>
      
      <div className="text-xs text-[#6c7086] uppercase tracking-wide mb-3">วงเงินแบบรวมต่อประเภท (บาท/เลข)</div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mb-6">
        {Object.entries(keeps).map(([k, v]) => (
          <div key={k} className="bg-[#11151e] border border-[#2a3244] rounded p-3">
            <div className="text-xs text-[#6c7086] mb-2">{k}</div>
            <input 
              value={v} 
              onChange={e => updateKeep(k, e.target.value)}
              className="w-full bg-[#0a0e14] border border-[#2a3244] rounded px-2 py-1 text-[#a6e3a1] font-bold text-center outline-none focus:border-[#89b4fa]"
            />
          </div>
        ))}
      </div>

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded hover:bg-[#223f28] transition-colors disabled:opacity-50"
      >
        {isSaving ? 'กำลังบันทึก...' : 'บันทึกวงเงินรวม'}
      </button>

      <hr className="border-[#1e2433] my-8 max-w-3xl" />

      <h2 className="text-lg font-bold text-[#89b4fa] mb-2">วงเงินเฉพาะเจาะจงรายตัวเลข</h2>
      <div className="text-xs text-[#6c7086] mb-4">เว้นว่าง = ใช้วงเงินรวมของประเภทนั้น</div>
      
      <div className="bg-[#0a0e14] border border-[#1e2433] rounded-lg p-4 max-w-4xl overflow-x-auto mb-6 max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-[#6c7086] text-xs bg-[#0d1117] uppercase">
              <th className="font-normal py-2 px-2 text-left">เลข</th>
              <th className="font-normal py-2 px-2 text-center">2บน</th>
              <th className="font-normal py-2 px-2 text-center">2ล่าง</th>
              <th className="font-normal py-2 px-2 text-center">2โต้ด</th>
              <th className="font-normal py-2 px-2 text-center">3บน</th>
              <th className="font-normal py-2 px-2 text-center">3ล่าง</th>
              <th className="font-normal py-2 px-2 text-center">3โต้ด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {specificLimits.map((sp, idx) => (
              <tr key={idx} className="border-b border-[#13171f] hover:bg-[#11151e]">
                <td className="py-2 px-2 text-[#a6e3a1] font-mono font-bold">{sp.num}</td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '2บน', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['2บน']}/></td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '2ล่าง', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['2ล่าง']}/></td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '2โต้ด', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['2โต้ด']}/></td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '3บน', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['3บน']}/></td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '3ล่าง', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['3ล่าง']}/></td>
                <td className="py-2 px-2 text-center"><input onChange={(e) => handleUpdateSpecific(idx, '3โต้ด', e.target.value)} className="w-12 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none focus:border-[#89b4fa]" value={sp['3โต้ด']}/></td>
                <td className="py-2 px-2 text-right"><button onClick={() => handleRemoveSpecific(idx)} className="text-[#f38ba8] text-xs hover:underline">ลบ</button></td>
              </tr>
            ))}
            {specificLimits.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-[#6c7086] text-xs">ไม่มีการตั้งวงเงินเฉพาะ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-[#0a0e14] border border-[#1e2433] rounded-lg p-4 max-w-4xl relative">
        <label className="absolute top-4 right-4 text-[10px] text-[#89b4fa] flex items-center gap-1 cursor-pointer select-none bg-[#1e2d3d] px-2 py-1 rounded border border-[#2a4a6b]">
          <input type="checkbox" checked={lockSpLimits} onChange={(e) => setLockSpLimits(e.target.checked)} className="accent-[#89b4fa] w-3 h-3"/>
          ล็อคยอด
        </label>
        <div className="text-xs text-[#45475a] uppercase tracking-wide mb-3">เพิ่มวงเงินเฉพาะเลข</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">เลข</div>
            <input 
              id="sp-num" 
              value={spNum} 
              onChange={e => setSpNum(e.target.value.replace(/[^0-9]/g, ''))} 
              onKeyDown={e => { 
                if(e.key === 'Enter') {
                  if (lockSpLimits) {
                    handleAddSpecific();
                  } else {
                    document.getElementById('sp-2b')?.focus(); 
                  }
                } 
              }} 
              maxLength={3} 
              className="w-16 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#a6e3a1] font-mono text-sm font-bold outline-none focus:border-[#89b4fa]" 
              placeholder="00" 
            />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">2บน</div>
            <input id="sp-2b" value={sp2b} readOnly={lockSpLimits} onChange={e => setSp2b(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') document.getElementById('sp-2l')?.focus(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">2ล่าง</div>
            <input id="sp-2l" value={sp2l} readOnly={lockSpLimits} onChange={e => setSp2l(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') document.getElementById('sp-2t')?.focus(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">2โต้ด</div>
            <input id="sp-2t" value={sp2t} readOnly={lockSpLimits} onChange={e => setSp2t(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') document.getElementById('sp-3b')?.focus(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">3บน</div>
            <input id="sp-3b" value={sp3b} readOnly={lockSpLimits} onChange={e => setSp3b(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') document.getElementById('sp-3l')?.focus(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">3ล่าง</div>
            <input id="sp-3l" value={sp3l} readOnly={lockSpLimits} onChange={e => setSp3l(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') document.getElementById('sp-3t')?.focus(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <div>
            <div className="text-[10px] text-[#6c7086] mb-1">3โต้ด</div>
            <input id="sp-3t" value={sp3t} readOnly={lockSpLimits} onChange={e => setSp3t(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') handleAddSpecific(); }} className={`w-14 bg-[#11151e] border border-[#2a3244] rounded px-2 py-1.5 text-[#f9e2af] text-sm font-bold outline-none focus:border-[#89b4fa] ${lockSpLimits ? 'opacity-50' : ''}`} placeholder="-" />
          </div>
          <button onClick={handleAddSpecific} className="bg-[#1e2d3d] border border-[#2a4a6b] text-[#89b4fa] font-bold py-1.5 px-4 rounded hover:bg-[#2a4a6b] transition-colors mb-[1px] text-sm">
            + เพิ่ม
          </button>
        </div>
      </div>
      
      <div className="mt-8">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded hover:bg-[#223f28] transition-colors disabled:opacity-50"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกวงเงินรวม'}
        </button>
      </div>
    </div>
  );
}
