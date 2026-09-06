'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navs = [
    { label: 'ทั่วไป', isHeader: true },
    { label: '🏠 ข้อมูลร้าน', path: '/settings' },
    { label: '👥 ลูกค้า', path: '/settings/customers' },
    { label: 'การจ่าย', isHeader: true },
    { label: '💰 อัตราจ่าย / เลขอั้น', path: '/settings/rates' },
    { label: 'วงเงิน', isHeader: true },
    { label: '🗄 รายการเก็บ', path: '/settings/keep' },
    { label: 'ข้อมูล', isHeader: true },
    { label: '📤 ส่งออก', path: '/settings/export' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[160px] border-r border-[#1e2433] bg-[#0d1117] flex flex-col flex-shrink-0 py-3">
        {navs.map((n, idx) => {
          if (n.isHeader) {
            return (
              <div key={idx} className="text-[10.8px] text-[#45475a] tracking-wider uppercase px-4 pt-4 pb-1">
                {n.label}
              </div>
            );
          }

          const isActive = pathname === n.path;
          return (
            <Link 
              key={n.path} 
              href={n.path!}
              className={`px-4 py-2 text-sm transition-all border-l-2 ${isActive ? 'text-[#89b4fa] border-l-[#89b4fa] bg-[#11151e]' : 'text-[#6c7086] border-l-transparent hover:text-[#cdd6f4] hover:bg-[#11151e]'}`}
            >
              {n.label}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden bg-[#0a0e14]">
        {children}
      </div>
    </div>
  );
}
