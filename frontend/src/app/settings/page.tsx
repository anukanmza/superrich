'use client';

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../lib/api';

export default function GeneralSettingsPage() {
  const [name, setName] = useState('เจ้ามือหวยของฉัน');
  const [period, setPeriod] = useState('16/06/68');
  const [disc, setDisc] = useState('20');
  const [memberPin, setMemberPin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSettings().then(data => {
      if (data.general_shopName) setName(data.general_shopName);
      if (data.general_period) setPeriod(data.general_period);
      if (data.general_disc) setDisc(data.general_disc);
      if (data.member_pin) setMemberPin(data.member_pin);
    }).catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        general_shopName: name,
        general_period: period,
        general_disc: disc,
        member_pin: memberPin
      });
      alert('บันทึกการตั้งค่าสำเร็จ');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

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

        <div className="flex items-center gap-4 border-b border-[#2a3244] pb-4">
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

        <h3 className="text-md font-bold text-[#f9e2af] pt-2">แดชบอร์ดสมาชิก (Member View)</h3>
        
        <div className="flex items-center gap-4">
          <label className="text-sm text-[#6c7086] w-32 flex-shrink-0">รหัสผ่าน (PIN)</label>
          <div className="flex-1 flex flex-col gap-2">
            <input 
              type="text" 
              value={memberPin}
              onChange={e => setMemberPin(e.target.value)}
              placeholder="ปล่อยว่างเพื่อปิดรหัสผ่าน"
              className="bg-[#11151e] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#f9e2af] tracking-widest"
            />
            {typeof window !== 'undefined' && (
              <div className="text-xs text-[#89b4fa] mt-1 flex items-center gap-2">
                <span>ลิงก์เข้าดู:</span>
                <code className="bg-[#181825] px-2 py-1 rounded select-all">{window.location.origin}/member</code>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="mt-6 bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 px-6 rounded hover:bg-[#223f28] transition-colors disabled:opacity-50"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </div>
  );
}
