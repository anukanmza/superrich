'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  if (pathname.startsWith('/member')) {
    return <main className="flex-1 overflow-hidden h-full">{children}</main>;
  }

  return (
    <>
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-[#1e2433]">
        <div className="text-[#89b4fa] font-bold tracking-wide">◈ LOTTO DEALER PRO</div>
        <div className="bg-[#1e2d3d] text-[#89b4fa] px-3 py-1 rounded text-xs font-bold border border-[#2a4a6b]">
          งวด 16/06/68
        </div>
        <div className="text-xs text-[#6c7086] flex gap-3">
          <span>รับ:<b className="text-[#cdd6f4]"> ฿0</b></span>
          <span>ส่ง:<b className="text-[#cdd6f4]"> ฿0</b></span>
          <span>เก็บ:<b className="text-[#cdd6f4]"> ฿0</b></span>
        </div>
      </div>

      {/* Navigation */}
      <Navigation />

      {/* Content Area */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </>
  );
}
