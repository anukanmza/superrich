'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getArchiveById, getSettings } from '../../../lib/api';
import { isWinning, getPrizeRate } from '../../../lib/lotto';
import Link from 'next/link';

export default function ArchiveDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [archive, setArchive] = useState<any>(null);
  const [fallbackSettings, setFallbackSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'cutouts' | 'rewards'>('overview');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getArchiveById(Number(id)),
      getSettings() // Fallback if archive has no settings
    ])
      .then(([archiveData, currentSettings]) => {
        setArchive(archiveData);
        setFallbackSettings(currentSettings);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [id]);

  const { stats, bills, cutouts, rewards } = useMemo(() => {
    if (!archive) return { stats: null, bills: [], cutouts: [], rewards: {} };
    let b: any[] = [];
    let c: any[] = [];
    let r: any = {};
    let s: any = {};
    try { b = JSON.parse(archive.bills || '[]'); } catch (e) {}
    try { c = JSON.parse(archive.cutouts || '[]'); } catch (e) {}
    try { r = JSON.parse(archive.results || '{}'); } catch (e) {}
    try { s = JSON.parse(archive.settings || '{}'); } catch (e) {}

    // Use archive settings if available, else fallback to current settings
    const generalDisc = parseFloat(s.general_disc || fallbackSettings?.general_disc || '0');
    const rates = s.rates_json ? JSON.parse(s.rates_json) : (fallbackSettings?.rates_json ? JSON.parse(fallbackSettings.rates_json) : {});
    const specificRates = s.specificRates_json ? JSON.parse(s.specificRates_json) : (fallbackSettings?.specificRates_json ? JSON.parse(fallbackSettings.specificRates_json) : []);

    let totalRecvRaw = 0;
    let totalRecvDiscounted = 0;
    let totalPayoutOverall = 0; // Total payout shop owes to customers
    
    // Calculate grouped kept entries for the shop
    const keptEntriesMap: Record<string, number> = {};

    b.forEach((bill: any) => {
      const disc = bill.customer?.disc !== undefined && bill.customer?.disc !== null ? parseFloat(bill.customer.disc) : generalDisc;
      
      (bill.entries || []).forEach((e: any) => {
        const amt = e.amount || 0;
        totalRecvRaw += amt;
        const discountedAmt = amt * ((100 - disc) / 100);
        totalRecvDiscounted += discountedAmt;

        // Check if winning
        if (isWinning({ number: e.number, type: e.type }, r)) {
          const rate = getPrizeRate({ number: e.number, type: e.type }, rates, specificRates);
          totalPayoutOverall += (amt * rate);
        }

        // Add to kept map
        const key = `${e.type}:${e.number}`;
        if (!keptEntriesMap[key]) keptEntriesMap[key] = 0;
        keptEntriesMap[key] += amt;
      });
    });

    let totalSent = 0;
    c.forEach((batch: any) => {
      totalSent += (batch.amount || 0);
      (batch.items || []).forEach((item: any) => {
        const key = `${item.type}:${item.num}`;
        if (keptEntriesMap[key]) {
          keptEntriesMap[key] -= item.amount;
        }
      });
    });

    let totalPayoutKept = 0;
    Object.keys(keptEntriesMap).forEach(key => {
      const [type, number] = key.split(':');
      const keptAmt = keptEntriesMap[key];
      if (keptAmt > 0 && isWinning({ number, type }, r)) {
         const rate = getPrizeRate({ number, type }, rates, specificRates);
         totalPayoutKept += (keptAmt * rate);
      }
    });

    const totalKeepRaw = Math.max(0, totalRecvRaw - totalSent);
    const totalKeepDiscounted = Math.max(0, totalRecvDiscounted - totalSent); // rough estimate

    return {
      bills: b,
      cutouts: c,
      rewards: r,
      stats: {
        billsCount: b.length,
        cutoutsCount: c.length,
        resultsCount: Object.keys(r).length,
        totalRecvRaw,
        totalRecvDiscounted,
        totalSent,
        totalKeepRaw,
        totalPayoutOverall,
        totalPayoutKept,
        netProfitOverall: totalRecvDiscounted - totalPayoutOverall,
        netProfitKept: totalKeepDiscounted - totalPayoutKept
      }
    };
  }, [archive, fallbackSettings]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0e14] text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  if (!archive || !stats) {
    return <div className="p-6 text-[#f38ba8]">ไม่พบข้อมูลย้อนหลัง</div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto flex flex-col">
      <div className="mb-6 flex items-center gap-4 shrink-0">
        <Link href="/archives" className="text-[#6c7086] hover:text-[#cdd6f4]">← กลับ</Link>
        <h1 className="text-xl font-bold text-[#89b4fa]">รายละเอียดงวด {archive.period}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 shrink-0 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: '📊 ภาพรวม' },
          { id: 'bills', label: '📄 บิลลูกค้า' },
          { id: 'cutouts', label: '✂️ ประวัติส่งออก' },
          { id: 'rewards', label: '💰 กำไร/ผลรางวัล' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-[#89b4fa] text-[#0d1117]' : 'bg-[#1e2d3d] text-[#cdd6f4] hover:bg-[#2a4a6b]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-6 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">สรุปภาพรวม (Read-only)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
                <p className="text-[#6c7086] text-sm mb-1">ยอดรับแทงรวม</p>
                <p className="text-2xl font-bold text-[#a6e3a1]">฿{stats.totalRecvRaw.toLocaleString()}</p>
                <p className="text-xs text-[#6c7086] mt-1">(หลังหักส่วนลด: ฿{stats.totalRecvDiscounted.toLocaleString()})</p>
              </div>
              <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
                <p className="text-[#6c7086] text-sm mb-1">ยอดตัดส่งออกรวม</p>
                <p className="text-2xl font-bold text-[#f38ba8]">฿{stats.totalSent.toLocaleString()}</p>
              </div>
              <div className="bg-[#0d1117] border border-[#2a3244] p-4 rounded-lg text-center">
                <p className="text-[#6c7086] text-sm mb-1">ยอดเก็บไว้สู้รวม</p>
                <p className="text-2xl font-bold text-[#89b4fa]">฿{stats.totalKeepRaw.toLocaleString()}</p>
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
        )}

        {activeTab === 'bills' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">บิลลูกค้าทั้งหมด ({bills.length} ใบ)</h2>
            <div className="space-y-4">
              {bills.map((bill: any, i: number) => (
                <div key={i} className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#89b4fa] font-bold">บิล #{bill.id} - {bill.customer?.name}</span>
                    <span className="text-[#a6e3a1] font-bold">฿{(bill.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#6c7086] flex flex-wrap gap-2">
                    {(bill.entries || []).map((e: any, j: number) => (
                      <span key={j} className="bg-[#1e2433] px-2 py-1 rounded">
                        {e.type} <b className="text-[#cdd6f4]">{e.number}</b> = {e.amount}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cutouts' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">ประวัติการตัดส่งออก ({cutouts.length} ครั้ง)</h2>
            <div className="space-y-4">
              {cutouts.map((c: any, i: number) => (
                <div key={i} className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#f9e2af] font-bold">รอบที่ {i+1}</span>
                    <span className="text-[#f38ba8] font-bold">฿{(c.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#6c7086] mb-2">{new Date(c.cutAt).toLocaleString('th-TH')}</div>
                  <div className="text-xs text-[#6c7086] flex flex-wrap gap-2">
                    {(c.items || []).map((item: any, j: number) => (
                      <span key={j} className="bg-[#1e2433] px-2 py-1 rounded">
                        {item.type} <b className="text-[#cdd6f4]">{item.num}</b> = {item.amount}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-6">สรุปผลรางวัล & กำไร/ขาดทุนสุทธิ</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Overall Profit/Loss */}
              <div className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4">
                <h3 className="text-[#89b4fa] font-bold text-center mb-4">ยอดรวมทั้งหมด (ก่อนส่งออก)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดรับแทงรวม (หลังหักส่วนลด)</span>
                    <span className="text-[#a6e3a1]">฿{stats.totalRecvDiscounted.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดถูกรางวัลรวมลูกค้า</span>
                    <span className="text-[#f38ba8]">-฿{stats.totalPayoutOverall.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-3 border-t border-[#1e2433] text-lg ${stats.netProfitOverall >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                    <span>กำไร/ขาดทุนรวม</span>
                    <span>{stats.netProfitOverall >= 0 ? '+' : ''}{stats.netProfitOverall.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Kept Profit/Loss */}
              <div className="bg-[#0d1117] border border-[#f38ba8] rounded-lg p-4 shadow-[0_0_15px_rgba(243,139,168,0.1)]">
                <h3 className="text-[#f38ba8] font-bold text-center mb-4">ยอดที่ร้านเก็บไว้สู้เอง (สุทธิ)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดเก็บ (หลังหักส่วนลดคร่าวๆ)</span>
                    <span className="text-[#a6e3a1]">฿{Math.max(0, stats.totalRecvDiscounted - stats.totalSent).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดถูกรางวัล (เฉพาะที่เก็บไว้)</span>
                    <span className="text-[#f38ba8]">-฿{stats.totalPayoutKept.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-3 border-t border-[#1e2433] text-lg ${stats.netProfitKept >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                    <span>กำไร/ขาดทุนสู้เอง</span>
                    <span>{stats.netProfitKept >= 0 ? '+' : ''}{stats.netProfitKept.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-[#cdd6f4] font-bold mb-4">ผลรางวัลที่ออก</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.keys(rewards).map(type => (
                <div key={type} className="bg-[#0d1117] border border-[#2a3244] p-3 rounded-lg text-center">
                  <div className="text-xs text-[#6c7086] mb-1">{type}</div>
                  <div className="text-xl font-bold text-[#f9e2af] tracking-wider">{rewards[type]}</div>
                </div>
              ))}
            </div>
            {Object.keys(rewards).length === 0 && (
              <p className="text-[#6c7086] text-sm">ไม่มีข้อมูลผลรางวัลในงวดนี้</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
