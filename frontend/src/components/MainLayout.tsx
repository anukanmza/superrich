'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [masterPin, setMasterPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    import('../lib/api').then(({ getSettings }) => {
      getSettings().then(settings => {
        if (settings.master_pin && settings.master_pin.trim() !== '') {
          setMasterPin(settings.master_pin);
          const savedAuth = sessionStorage.getItem('master_auth');
          if (savedAuth === 'true') {
            setIsAuthenticated(true);
          }
        } else {
          setIsAuthenticated(true);
        }
      }).catch(console.error).finally(() => setIsLoading(false));
    });
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin === masterPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem('master_auth', 'true');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };
  
  if (pathname.startsWith('/member')) {
    return <main className="flex-1 overflow-hidden h-full">{children}</main>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  if (masterPin && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0e14] p-4">
        <form onSubmit={handleLogin} className="bg-[#11151e] border border-[#f38ba8] p-8 rounded-xl shadow-lg max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🛡️</div>
          <h1 className="text-xl font-bold text-[#f38ba8] mb-2">Master Login</h1>
          <p className="text-sm text-[#6c7086] mb-6">กรุณาใส่รหัสผ่านเจ้ามือเพื่อเข้าระบบ</p>
          
          <input 
            type="password" 
            value={inputPin}
            onChange={e => setInputPin(e.target.value)}
            placeholder="รหัสผ่านเจ้ามือ (Master PIN)"
            className="w-full bg-[#0d1117] border border-[#2a3244] rounded-lg px-4 py-3 text-center text-xl tracking-widest text-[#cdd6f4] outline-none focus:border-[#f38ba8] mb-4"
            autoFocus
          />
          {pinError && <p className="text-xs text-[#f38ba8] mb-4">รหัสผ่านไม่ถูกต้อง</p>}
          
          <button type="submit" className="w-full bg-[#f38ba8] text-[#0d1117] font-bold rounded-lg px-4 py-3 hover:bg-[#eba0b8] transition-colors">
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    );
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
