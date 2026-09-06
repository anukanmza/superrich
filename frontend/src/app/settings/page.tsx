'use client';

import { useState, useEffect } from 'react';

export default function GeneralSettingsPage() {
  const [name, setName] = useState('เจ้ามือหวยของฉัน');
  const [period, setPeriod] = useState('16/06/68');
  const [disc, setDisc] = useState('20');

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#89b4fa] mb-6">ข้อมูลร้าน / เจ้ามือ</h2>
      
      <div className="max-w-md space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-[#6c7086] w-32 flex-shrink-0">ชื่อร้าน/เจ้ามือ</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-[#6c7086] w-32 flex-shrink-0">งวดปัจจุบัน</label>
          <input 
            type="text" 
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="flex-1 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm text-[#6c7086] w-32 flex-shrink-0">% ส่งออก (default)</label>
          <div className="flex-1 flex items-center gap-3">
            <input 
              type="number" 
              value={disc}
              onChange={e => setDisc(e.target.value)}
              className="w-24 bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa] text-center"
            />
            <span className="text-xs text-[#6c7086]">สำหรับลูกค้าที่ไม่ได้กำหนด</span>
          </div>
        </div>

        <button className="mt-6 bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded hover:bg-[#223f28] transition-colors">
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}
