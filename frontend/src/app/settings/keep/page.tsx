'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../../lib/api';

export default function KeepLimitsPage() {
  const [keeps, setKeeps] = useState({
    '2บน': '5000', '2ล่าง': '5000', '2โต้ด': '5000',
    '3บน': '3000', '3ล่าง': '3000', '3โต้ด': '3000',
    'วิ่งบน': '2000', 'วิ่งล่าง': '2000'
  });
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
    }).catch(err => console.error(err));
  }, []);

  const updateKeep = (key: string, val: string) => {
    setKeeps(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        keeps_json: JSON.stringify(keeps)
      });
      alert('บันทึกวงเงินรวมสำเร็จ');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
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
      <div className="text-xs text-[#6c7086] mb-4">เว้นว่าง = ใช้วงเงินรวมของประเภทนั้น (กำลังพัฒนาระบบบันทึก)</div>
      
      <div className="bg-[#0a0e14] border border-[#1e2433] rounded-lg p-4 max-w-4xl overflow-x-auto">
        <table className="w-full text-sm">
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
            <tr className="border-b border-[#13171f]">
              <td className="py-2 px-2 text-[#a6e3a1] font-mono font-bold">89</td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="500" readOnly/></td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="500" readOnly/></td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="" readOnly/></td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="" readOnly/></td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="" readOnly/></td>
              <td className="py-2 px-2 text-center"><input className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#f9e2af] text-center text-xs py-1 outline-none" value="" readOnly/></td>
              <td className="py-2 px-2 text-right"><button className="text-[#f38ba8] text-xs hover:underline">ลบ</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
