'use client';

import { useState, useEffect } from 'react';
import { getArchives } from '../../lib/api';
import Link from 'next/link';

export default function ArchivesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [archives, setArchives] = useState<any[]>([]);

  useEffect(() => {
    getArchives()
      .then(setArchives)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h1 className="text-xl font-bold text-[#89b4fa] mb-6">🗄️ ประวัติงวดย้อนหลัง (Archives)</h1>
      
      {archives.length === 0 ? (
        <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-8 max-w-2xl text-center">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-[#cdd6f4] font-bold">ยังไม่มีข้อมูลย้อนหลัง</p>
          <p className="text-sm text-[#6c7086] mt-2">ข้อมูลงวดที่ถูกปิดจะมาแสดงอยู่ในหน้านี้</p>
        </div>
      ) : (
        <div className="grid gap-4 max-w-4xl">
          {archives.map(arch => (
            <Link 
              key={arch.id} 
              href={`/archives/${arch.id}`}
              className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4 hover:border-[#89b4fa] transition-colors flex items-center justify-between"
            >
              <div>
                <h3 className="text-[#cdd6f4] font-bold text-lg">งวด {arch.period}</h3>
                <p className="text-xs text-[#6c7086] mt-1">จัดเก็บเมื่อ: {new Date(arch.createdAt).toLocaleString('th-TH')}</p>
              </div>
              <div className="text-[#89b4fa]">
                ดูรายละเอียด ➔
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
