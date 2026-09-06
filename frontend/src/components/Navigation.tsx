'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  const navItems = [
    { name: '📌 ภาพรวม', path: '/overview' },
    { name: '⌨️ คีย์เลข', path: '/' },
    { name: '📄 บิลทั้งหมด', path: '/bills' },
    { name: '📊 ยอดรวมเลข', path: '/summary' },
    { name: '✂️ คัดเลขส่งออก', path: '/cutout' },
    { name: '🏆 ผลรางวัล', path: '/rewards' },
    { name: '📒 สรุปยอดลูกค้า', path: '/customer-summary' },
    { name: '💾 บันทึกและลบข้อมูล', path: '/close-period' },
    { name: '⚙️ ตั้งค่า', path: '/settings' },
  ];

  return (
    <div className="flex bg-[#0d1117] border-b border-[#1e2433] px-2 py-2 gap-2">
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          href={item.path}
          className={`px-4 py-2 rounded-md text-sm transition-colors ${
            pathname === item.path || (pathname.startsWith(item.path) && item.path !== '/')
              ? 'bg-[#1e2d3d] text-[#89b4fa] border border-[#2a4a6b] font-bold' 
              : 'text-[#6c7086] hover:bg-[#11151e] hover:text-[#cdd6f4] border border-transparent'
          }`}
        >
          {item.name}
        </Link>
      ))}
    </div>
  );
}
