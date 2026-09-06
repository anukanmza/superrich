'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../../lib/api';

export default function RatesPage() {
  const [rates, setRates] = useState({
    '2บน': '70', '2ล่าง': '70', '2โต้ด': '10',
    '3บน': '500', '3ล่าง': '450', '3โต้ด': '80',
    'วิ่งบน': '3.2', 'วิ่งล่าง': '4.2'
  });
  
  const [annRates, setAnnRates] = useState<{ num: string, rb: string, rl: string, rt: string }[]>([]);
  const [anNum, setAnNum] = useState('');
  const [anRb, setAnRb] = useState('');
  const [anRl, setAnRl] = useState('');
  const [anRt, setAnRt] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSettings().then(data => {
      if (data.rates_json) {
        try {
          const parsed = JSON.parse(data.rates_json);
          setRates(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to parse rates', e);
        }
      }
      if (data.annRates_json) {
        try {
          const parsed = JSON.parse(data.annRates_json);
          setAnnRates(parsed);
        } catch (e) {
          console.error('Failed to parse annRates', e);
        }
      }
    }).catch(err => console.error(err));
  }, []);

  const updateRate = (key: string, val: string) => {
    setRates(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        rates_json: JSON.stringify(rates),
        annRates_json: JSON.stringify(annRates)
      });
      alert('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAnnRate = () => {
    if (!anNum.trim()) return;
    setAnnRates(prev => [...prev, { num: anNum, rb: anRb, rl: anRl, rt: anRt }]);
    setAnNum('');
    setAnRb('');
    setAnRl('');
    setAnRt('');
    document.getElementById('an-num')?.focus();
  };

  const handleRemoveAnnRate = (idx: number) => {
    setAnnRates(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#89b4fa] mb-4">อัตราจ่ายปกติ</h2>
      
      <div className="mb-6">
        <h3 className="text-xs text-[#6c7086] uppercase tracking-wide mb-3">2 ตัว</h3>
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          {['2บน', '2ล่าง', '2โต้ด'].map(k => (
            <div key={k} className="bg-[#11151e] border border-[#2a3244] rounded p-3">
              <div className="text-xs text-[#6c7086] mb-2">{k}</div>
              <input 
                value={rates[k as keyof typeof rates]} 
                onChange={e => updateRate(k, e.target.value)}
                className="w-full bg-[#0a0e14] border border-[#2a3244] rounded px-2 py-1 text-[#f9e2af] font-bold text-lg text-center outline-none focus:border-[#89b4fa]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs text-[#6c7086] uppercase tracking-wide mb-3">3 ตัว</h3>
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          {['3บน', '3ล่าง', '3โต้ด'].map(k => (
            <div key={k} className="bg-[#11151e] border border-[#2a3244] rounded p-3">
              <div className="text-xs text-[#6c7086] mb-2">{k}</div>
              <input 
                value={rates[k as keyof typeof rates]} 
                onChange={e => updateRate(k, e.target.value)}
                className="w-full bg-[#0a0e14] border border-[#2a3244] rounded px-2 py-1 text-[#f9e2af] font-bold text-lg text-center outline-none focus:border-[#89b4fa]"
              />
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded hover:bg-[#223f28] transition-colors disabled:opacity-50"
      >
        {isSaving ? 'กำลังบันทึก...' : 'บันทึกอัตราจ่าย'}
      </button>

      <hr className="border-[#1e2433] my-8 max-w-3xl" />

      <h2 className="text-lg font-bold text-[#89b4fa] mb-2">เลขอั้น — อัตราจ่ายพิเศษรายตัว</h2>
      <div className="text-xs text-[#6c7086] mb-4">เลขที่ต้องการจ่ายในอัตราแตกต่างจากปกติ</div>
      
      {/* List of Ann Rates */}
      {annRates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
          {annRates.map((ar, idx) => (
            <div key={idx} className="bg-[#11151e] border border-[#2a3244] rounded p-3 relative group">
              <button 
                onClick={() => handleRemoveAnnRate(idx)}
                className="absolute top-2 right-2 text-[#f38ba8] opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-[#2d1e1e] border border-[#6b2a2a] px-2 py-0.5 rounded"
              >
                ลบ
              </button>
              <div className="text-[#f9e2af] font-bold font-mono text-xl tracking-wider mb-2">{ar.num}</div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-[#6c7086]">บน</span>
                <span className="text-[#f9e2af]">{ar.rb || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-[#6c7086]">ล่าง</span>
                <span className="text-[#f9e2af]">{ar.rl || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6c7086]">โต้ด</span>
                <span className="text-[#f9e2af]">{ar.rt || '-'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#0a0e14] border border-[#1e2433] rounded-lg p-4 max-w-3xl">
        <div className="text-xs text-[#45475a] uppercase tracking-wide mb-3">เพิ่มเลขอั้น</div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <div className="text-xs text-[#6c7086] mb-1">เลข</div>
            <input 
              id="an-num"
              value={anNum}
              onChange={e => setAnNum(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => { if(e.key === 'Enter') document.getElementById('an-rb')?.focus(); }}
              maxLength={3}
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#a6e3a1] font-mono text-xl font-bold outline-none focus:border-[#89b4fa]" 
              placeholder="00" 
            />
          </div>
          <div>
            <div className="text-xs text-[#6c7086] mb-1">จ่ายบน</div>
            <input 
              id="an-rb"
              value={anRb}
              onChange={e => setAnRb(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter') document.getElementById('an-rl')?.focus(); }}
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#f9e2af] font-bold outline-none focus:border-[#89b4fa]" 
              placeholder="-" 
            />
          </div>
          <div>
            <div className="text-xs text-[#6c7086] mb-1">จ่ายล่าง</div>
            <input 
              id="an-rl"
              value={anRl}
              onChange={e => setAnRl(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter') document.getElementById('an-rt')?.focus(); }}
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#f9e2af] font-bold outline-none focus:border-[#89b4fa]" 
              placeholder="-" 
            />
          </div>
          <div>
            <div className="text-xs text-[#6c7086] mb-1">จ่ายโต้ด</div>
            <input 
              id="an-rt"
              value={anRt}
              onChange={e => setAnRt(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter') handleAddAnnRate(); }}
              className="w-20 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#f9e2af] font-bold outline-none focus:border-[#89b4fa]" 
              placeholder="-" 
            />
          </div>
          <button 
            onClick={handleAddAnnRate}
            className="bg-[#1e2d3d] border border-[#2a4a6b] text-[#89b4fa] font-bold py-2 px-6 rounded hover:bg-[#2a4a6b] transition-colors mb-[2px]"
          >
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
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกอัตราจ่าย'}
        </button>
      </div>
    </div>
  );
}
