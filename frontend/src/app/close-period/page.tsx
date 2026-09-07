'use client';

import { useState, useEffect } from 'react';
import { getSettings, fetchBills, archiveCurrentPeriod, updateSettings } from '../../lib/api';

export default function ClosePeriodPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [billsCount, setBillsCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  
  const [masterPin, setMasterPin] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [cutoutsJson, setCutoutsJson] = useState('[]');
  const [resultsJson, setResultsJson] = useState('{}');

  useEffect(() => {
    Promise.all([getSettings(), fetchBills()])
      .then(([settings, billsData]) => {
        if (settings.general_period) setPeriod(settings.general_period);
        if (settings.master_pin) setMasterPin(settings.master_pin);
        
        if (settings.cutouts_json) setCutoutsJson(settings.cutouts_json);
        if (settings.results_json) setResultsJson(settings.results_json);

        setBillsCount(billsData.length);
        
        let total = 0;
        billsData.forEach(b => {
          (b.entries || []).forEach(e => {
            total += (e.amount || 0);
          });
        });
        setTotalAmount(total);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleArchive = async () => {
    if (masterPin && inputPin !== masterPin) {
      setPinError(true);
      return;
    }
    setPinError(false);
    
    if (!confirm('ยืนยันการจัดเก็บและล้างข้อมูลปัจจุบัน?')) return;
    
    setIsProcessing(true);
    try {
      // 1. Create Archive Snapshot
      await archiveCurrentPeriod(period, cutoutsJson, resultsJson);
      
      // 2. Clear Active Results and Cutouts from settings
      await updateSettings({
        cutouts_json: '[]',
        results_json: '{}'
      });
      
      alert('จัดเก็บข้อมูลเรียบร้อยแล้ว! ระบบพร้อมสำหรับงวดถัดไป');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการจัดเก็บข้อมูล');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-xl font-bold text-[#89b4fa] mb-6">💾 ปิดงวดและจัดเก็บข้อมูล (Close Period)</h1>
      
      <div className="bg-[#11151e] border border-[#f38ba8] rounded-lg p-6 max-w-2xl">
        <h2 className="text-[#f38ba8] text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">⚠️</span> โซนอันตราย (Danger Zone)
        </h2>
        
        <p className="text-[#cdd6f4] mb-6">
          การทำงานนี้จะทำการ <b className="text-[#f9e2af]">ถ่ายรูปและจัดเก็บข้อมูลบิล, การส่งออก, และผลรางวัลของงวดนี้</b> ลงในตู้เซฟ (เมนูงวดย้อนหลัง) <br/>
          และจากนั้นจะ <b className="text-[#f38ba8]">ล้างข้อมูลในหน้าจอทำงานปัจจุบันทั้งหมดให้ว่างเปล่า</b> เพื่อเตรียมพร้อมสำหรับงวดถัดไป
        </p>

        <div className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4 mb-6">
          <h3 className="text-[#89b4fa] font-bold mb-3">สรุปข้อมูลที่จะถูกจัดเก็บสำหรับงวด "{period}"</h3>
          <ul className="text-sm text-[#a6adc8] space-y-2">
            <li>จำนวนบิลทั้งหมด: <b className="text-[#cdd6f4]">{billsCount} บิล</b></li>
            <li>ยอดรับแทงรวมทั้งหมด: <b className="text-[#a6e3a1]">฿{totalAmount.toLocaleString()}</b></li>
            <li>ประวัติการตัดส่งออก: <b className="text-[#f38ba8]">{JSON.parse(cutoutsJson).length} รายการ</b></li>
            <li>ผลรางวัลประจำงวด: <b className="text-[#f9e2af]">{Object.keys(JSON.parse(resultsJson)).length} หมวดหมู่</b></li>
          </ul>
        </div>

        {masterPin && (
          <div className="mb-6">
            <label className="block text-sm text-[#f38ba8] mb-2 font-bold">ยืนยันตัวตนด้วย Master PIN ก่อนดำเนินการ</label>
            <input 
              type="password" 
              value={inputPin}
              onChange={e => setInputPin(e.target.value)}
              placeholder="รหัสผ่านเจ้ามือ (Master PIN)"
              className="w-full bg-[#0d1117] border border-[#f38ba8] rounded px-4 py-3 text-center text-xl tracking-widest text-[#cdd6f4] outline-none focus:border-[#f38ba8]"
            />
            {pinError && <p className="text-xs text-[#f38ba8] mt-2">รหัสผ่านไม่ถูกต้อง</p>}
          </div>
        )}

        <button 
          onClick={handleArchive}
          disabled={isProcessing || (masterPin !== '' && inputPin === '')}
          className="w-full bg-[#f38ba8] hover:bg-[#eba0b8] text-[#11151e] font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-xl">📥</span> {isProcessing ? 'กำลังจัดเก็บข้อมูล...' : 'ยืนยันการจัดเก็บและเริ่มงวดใหม่'}
        </button>
      </div>
    </div>
  );
}
