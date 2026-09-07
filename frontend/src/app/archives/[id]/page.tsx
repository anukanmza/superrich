'use client';

import { useState, useEffect, useMemo } from 'react';
import { getArchiveById } from '../../../lib/api';
import Link from 'next/link';

export default function ArchiveDetailPage({ params }: { params: { id: string } }) {
  const [isLoading, setIsLoading] = useState(true);
  const [archive, setArchive] = useState<any>(null);

  useEffect(() => {
    getArchiveById(Number(params.id))
      .then(setArchive)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [params.id]);

  const stats = useMemo(() => {
    if (!archive) return null;
    let bills = [];
    let cutouts = [];
    let results = {};
    try { bills = JSON.parse(archive.bills); } catch (e) {}
    try { cutouts = JSON.parse(archive.cutouts); } catch (e) {}
    try { results = JSON.parse(archive.results); } catch (e) {}

    let totalRecv = 0;
    bills.forEach((b: any) => {
      (b.entries || []).forEach((e: any) => {
        totalRecv += (e.amount || 0);
      });
    });

    let totalSent = 0;
    cutouts.forEach((c: any) => {
      totalSent += (c.amount || 0);
    });

    return {
      billsCount: bills.length,
      cutoutsCount: cutouts.length,
      resultsCount: Object.keys(results).length,
      totalRecv,
      totalSent,
      totalKeep: Math.max(0, totalRecv - totalSent)
    };
  }, [archive]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  if (!archive || !stats) {
    return <div className="p-6 text-[#f38ba8]">ไม่พบข้อมูลย้อนหลัง</div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/archives" className="text-[#6c7086] hover:text-[#cdd6f4]">← กลับ</Link>
        <h1 className="text-xl font-bold text-[#89b4fa]">รายละเอียดงวด {archive.period}</h1>
      </div>

      <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-6 max-w-4xl">
        <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">สรุปภาพรวม (Read-only)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
            <p className="text-[#6c7086] text-sm mb-1">ยอดรับแทงรวม</p>
            <p className="text-2xl font-bold text-[#a6e3a1]">฿{stats.totalRecv.toLocaleString()}</p>
          </div>
          <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
            <p className="text-[#6c7086] text-sm mb-1">ยอดตัดส่งออกรวม</p>
            <p className="text-2xl font-bold text-[#f38ba8]">฿{stats.totalSent.toLocaleString()}</p>
          </div>
          <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
            <p className="text-[#6c7086] text-sm mb-1">ยอดเก็บไว้สู้รวม</p>
            <p className="text-2xl font-bold text-[#89b4fa]">฿{stats.totalKeep.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0d1117] p-4 rounded-lg">
            <p className="text-[#6c7086] mb-2 text-sm">สถิติข้อมูล</p>
            <ul className="text-[#cdd6f4] space-y-2 text-sm">
              <li className="flex justify-between border-b border-[#1e2433] pb-2">
                <span>จำนวนบิลทั้งหมด</span>
                <span className="font-bold">{stats.billsCount} ใบ</span>
              </li>
              <li className="flex justify-between border-b border-[#1e2433] pb-2">
                <span>รายการตัดส่งออก</span>
                <span className="font-bold">{stats.cutoutsCount} ครั้ง</span>
              </li>
              <li className="flex justify-between pb-2">
                <span>ผลรางวัล</span>
                <span className="font-bold">{stats.resultsCount} หมวดหมู่</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-[#0d1117] p-4 rounded-lg flex items-center justify-center flex-col">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-[#a6adc8] text-sm text-center">ข้อมูลนี้ถูกจัดเก็บแบบอ่านได้อย่างเดียวเพื่อความปลอดภัย ไม่สามารถแก้ไขได้</p>
          </div>
        </div>
      </div>
    </div>
  );
}
