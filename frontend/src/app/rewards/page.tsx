'use client';

export default function RewardsPage() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-xl font-bold text-[#89b4fa] mb-6">🏆 ผลรางวัล (Rewards)</h1>
      <div className="bg-[#11151e] border border-[#2a4a6b] rounded-lg p-6 max-w-2xl text-center">
        <div className="text-[#a6e3a1] text-2xl font-bold mb-4">ระบบกำลังอยู่ระหว่างการพัฒนา (Coming Soon)</div>
        <p className="text-[#6c7086]">หน้านี้จะใช้สำหรับกรอกผลหวย เพื่อคำนวณบิลที่ถูกรางวัลอัตโนมัติ</p>
      </div>
    </div>
  );
}
