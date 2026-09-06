'use client';

import { useState, useEffect } from 'react';
import { fetchCustomers, Customer } from '../../../lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCustomers().then(data => {
      setCustomers(data);
    }).catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-[#89b4fa]">จัดการลูกค้า</h1>
        <button className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] px-4 py-2 rounded font-bold hover:bg-[#223f28] transition-colors">
          + เพิ่มลูกค้าใหม่
        </button>
      </div>

      {isLoading ? (
        <div className="text-[#6c7086]">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {customers.map(c => (
            <div key={c.id} className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4 hover:border-[#89b4fa] transition-colors glass-panel">
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                  style={{ backgroundColor: c.color || '#1e2d3d', color: c.tc || '#89b4fa' }}
                >
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-[#cdd6f4]">{c.name}</div>
                  <div className="text-xs text-[#6c7086]">{c.phone || 'ไม่มีเบอร์โทร'}</div>
                </div>
              </div>
              
              <div className="text-xs text-[#f9e2af] mb-3">
                ส่วนลด: {c.disc !== undefined && c.disc !== null && c.disc !== -1 ? `${c.disc}%` : 'ใช้ค่า Default'}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-[#0d1117] border border-[#2a3244] text-[#89b4fa] text-xs py-1.5 rounded hover:bg-[#1e2d3d]">เลือก</button>
                <button className="flex-1 bg-[#0d1117] border border-[#2a3244] text-[#6c7086] text-xs py-1.5 rounded hover:text-[#f9e2af] hover:border-[#6b5929]">แก้ไข</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
