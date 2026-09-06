'use client';

export default function ExportPage() {
  const downloadExcel = () => {
    alert('ระบบดาวน์โหลด Excel กำลังพัฒนา');
  };

  const printReport = () => {
    alert('ระบบพิมพ์รายงานกำลังพัฒนา');
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-[#89b4fa] mb-6">ส่งออก / พิมพ์ข้อมูล</h2>
      
      <div className="flex gap-4">
        <button 
          onClick={downloadExcel}
          className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-3 px-6 rounded hover:bg-[#223f28] transition-colors flex items-center gap-2"
        >
          <span className="text-xl">📊</span> ดาวน์โหลด Excel
        </button>

        <button 
          onClick={printReport}
          className="bg-[#1e2d3d] border border-[#2a4a6b] text-[#89b4fa] font-bold py-3 px-6 rounded hover:bg-[#2a4a6b] transition-colors flex items-center gap-2"
        >
          <span className="text-xl">🖨️</span> พิมพ์รายงาน
        </button>
      </div>

      <div className="mt-8 p-4 bg-[#0a0e14] border border-[#1e2433] rounded-lg max-w-lg">
        <h3 className="text-sm font-bold text-[#f9e2af] mb-2">คำแนะนำ</h3>
        <ul className="text-xs text-[#6c7086] space-y-2 list-disc pl-4">
          <li>การดาวน์โหลด Excel จะสรุปยอดแทงทั้งหมดและแยกตามลูกค้า</li>
          <li>คุณสามารถนำไฟล์ Excel ไปประมวลผลต่อหรือส่งให้เจ้ามือรายใหญ่ได้</li>
          <li>ฟีเจอร์นี้จะพร้อมใช้งานในอัปเดตถัดไป</li>
        </ul>
      </div>
    </div>
  );
}
