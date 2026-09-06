'use client';

import { useState, useEffect } from 'react';
import { fetchBills, deleteBill, Bill } from '../../lib/api';

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBills = () => {
    setIsLoading(true);
    fetchBills().then(data => {
      // Sort by newest first
      setBills(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }).catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBills();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบบิลนี้?')) {
      try {
        await deleteBill(id);
        loadBills();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบบิล');
      }
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#cdd6f4]">บิล / โพย</h1>
          <div className="text-xs text-[#6c7086] mt-1">คลิกที่บิลเพื่อดูรายละเอียด (ระบบกำลังพัฒนา)</div>
        </div>
        <div className="bg-[#1e2d3d] text-[#89b4fa] px-3 py-1 rounded-full text-xs font-bold border border-[#2a4a6b]">
          ทั้งหมด {bills.length} บิล
        </div>
      </div>

      {isLoading ? (
        <div className="text-[#6c7086]">กำลังโหลดข้อมูลบิล...</div>
      ) : bills.length === 0 ? (
        <div className="text-center text-[#6c7086] mt-20">ยังไม่มีบิลในระบบ</div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {bills.map(bill => (
            <div key={bill.id} className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4 hover:border-[#89b4fa] transition-colors cursor-pointer glass">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-[#6c7086] text-xs font-mono">#{bill.id.toString().padStart(4, '0')}</span>
                  <span className="text-[#cdd6f4] font-bold" style={{ color: bill.customer?.tc || '#cdd6f4' }}>
                    {bill.customer?.name || 'ไม่ทราบชื่อ'}
                  </span>
                </div>
                <div className="text-[#6c7086] text-xs">
                  {new Date(bill.createdAt).toLocaleString('th-TH')}
                </div>
              </div>
              
              <div className="flex justify-between items-end mt-4">
                <div className="flex gap-4 text-xs text-[#6c7086]">
                  <div>รายการ: <span className="text-[#74c7ec] font-bold">{bill.entries.length}</span></div>
                  <div>สถานะ: <span className="text-[#a6e3a1] bg-[#1e3329] px-2 py-0.5 rounded-full border border-[#2d6b3b]">{bill.status === 'active' ? 'ปกติ' : bill.status}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xl font-bold text-[#a6e3a1]">
                    ฿{bill.total.toLocaleString()}
                  </div>
                  <button 
                    onClick={(e) => handleDelete(e, bill.id)}
                    className="bg-[#1e1215] text-[#f38ba8] hover:bg-[#f38ba8] hover:text-[#1e1215] border border-[#3a2a2a] px-3 py-1 rounded text-xs font-bold transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
