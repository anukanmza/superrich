'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getArchiveById, getSettings, deleteArchive } from '../../../lib/api';
import { isWinning, getPrizeRate } from '../../../lib/lotto';
import Link from 'next/link';

export default function ArchiveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archive, setArchive] = useState<any>(null);
  const [fallbackSettings, setFallbackSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'cutouts' | 'rewards'>('overview');

  // Modals
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [selectedCutout, setSelectedCutout] = useState<any>(null);

  const handleDelete = async () => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลงวดนี้ทิ้ง? การกระทำนี้ไม่สามารถกู้คืนได้')) {
      setIsDeleting(true);
      try {
        await deleteArchive(Number(id));
        alert('ลบข้อมูลเรียบร้อยแล้ว');
        router.push('/archives');
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
        setIsDeleting(false);
      }
    }
  };

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

  const { stats, bills, cutouts, rewards, winningEntries } = useMemo(() => {
    if (!archive) return { stats: null, bills: [], cutouts: [], rewards: {}, winningEntries: [] };
    let b: any[] = [];
    let c: any[] = [];
    let r: any = {};
    let s: any = {};
    try { b = JSON.parse(archive.bills || '[]'); } catch (e) {}
    try { c = JSON.parse(archive.cutouts || '[]'); } catch (e) {}
    try { r = JSON.parse(archive.results || '{}'); } catch (e) {}
    try { s = JSON.parse(archive.settings || '{}'); } catch (e) {}

    // Process Bills index
    const sortedBills = b.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const counts: Record<number, number> = {};
    b = sortedBills.map(bill => {
      counts[bill.customerId] = (counts[bill.customerId] || 0) + 1;
      return { ...bill, customerBillIndex: counts[bill.customerId] };
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Process Cutouts Grouping
    const groupedCutouts: any[] = [];
    const cutoutMap = new Map();
    c.forEach((item: any) => {
      if (!cutoutMap.has(item.batchId)) {
        cutoutMap.set(item.batchId, {
          batchId: item.batchId,
          date: item.date,
          time: item.time,
          amount: 0,
          items: []
        });
        groupedCutouts.push(cutoutMap.get(item.batchId));
      }
      const batch = cutoutMap.get(item.batchId);
      batch.amount += (item.amount || 0);
      batch.items.push(item);
    });

    const generalDisc = parseFloat(s.general_disc || fallbackSettings?.general_disc || '0');
    const rates = s.rates_json ? JSON.parse(s.rates_json) : (fallbackSettings?.rates_json ? JSON.parse(fallbackSettings.rates_json) : {});
    const specificRates = s.specificRates_json ? JSON.parse(s.specificRates_json) : (fallbackSettings?.specificRates_json ? JSON.parse(fallbackSettings.specificRates_json) : []);

    let totalRecvRaw = 0;
    let totalRecvDiscounted = 0;
    let totalSent = 0;

    // Maps to store raw amount and sent amount per grouped entry key (like rewards/page.tsx)
    const rawMap: Record<string, number> = {};
    const sentMap: Record<string, number> = {};

    b.forEach((bill: any) => {
      const disc = bill.customer?.disc !== undefined && bill.customer?.disc !== null ? parseFloat(bill.customer.disc) : generalDisc;
      
      (bill.entries || []).forEach((e: any) => {
        const amt = e.amount || 0;
        totalRecvRaw += amt;
        totalRecvDiscounted += (amt * ((100 - disc) / 100));

        let numKey = e.number;
        if (e.type === '3โต้ด') numKey = numKey.split('').sort().join('');
        const k = `${numKey}|${e.type}`;

        if (!rawMap[k]) rawMap[k] = 0;
        rawMap[k] += amt;
      });
    });

    c.forEach((item: any) => {
      totalSent += (item.amount || 0);
      let numKey = item.num;
      if (item.type === '3โต้ด') numKey = numKey.split('').sort().join('');
      const k = `${numKey}|${item.type}`;

      if (!sentMap[k]) sentMap[k] = 0;
      sentMap[k] += (item.amount || 0);
    });

    let totalPayoutOverall = 0;
    let totalPayoutKept = 0;
    const wins: any[] = [];

    b.forEach((bill: any) => {
      (bill.entries || []).forEach((e: any) => {
        if (isWinning({ number: e.number, type: e.type }, r)) {
          let numKey = e.number;
          if (e.type === '3โต้ด') numKey = numKey.split('').sort().join('');
          const k = `${numKey}|${e.type}`;

          const rate = getPrizeRate({ number: e.number, type: e.type }, rates, specificRates);
          const amt = e.amount || 0;
          const payout = amt * rate;

          const raw = rawMap[k] || 0;
          const sent = sentMap[k] || 0;
          const ratio = raw > 0 ? Math.min(1, sent / raw) : 0;

          const sentAmt = amt * ratio;
          const keepAmt = amt - sentAmt;
          
          const payoutSent = sentAmt * rate;
          const payoutKeep = keepAmt * rate;

          totalPayoutOverall += payout;
          totalPayoutKept += payoutKeep;

          wins.push({
            billId: bill.id,
            customerName: bill.customer?.name || 'ลูกค้า',
            type: e.type,
            number: e.number,
            amt,
            payout,
            keepAmt,
            payoutKeep,
          });
        }
      });
    });

    const totalKeepRaw = Math.max(0, totalRecvRaw - totalSent);
    const totalKeepDiscounted = Math.max(0, totalRecvDiscounted - totalSent);

    return {
      bills: b,
      cutouts: groupedCutouts,
      rewards: r,
      winningEntries: wins.sort((a: any, b: any) => b.payout - a.payout),
      stats: {
        billsCount: b.length,
        cutoutsCount: groupedCutouts.length,
        resultsCount: Object.keys(r).length,
        totalRecvRaw,
        totalRecvDiscounted,
        totalSent,
        totalKeepRaw,
        totalKeepDiscounted,
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
    <div className="p-6 h-full overflow-y-auto flex flex-col relative">
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/archives" className="text-[#6c7086] hover:text-[#cdd6f4]">← กลับ</Link>
          <h1 className="text-xl font-bold text-[#89b4fa]">รายละเอียดงวด {archive.period}</h1>
        </div>
        <button 
          onClick={handleDelete}
          disabled={isDeleting}
          className="bg-[#1e1215] text-[#f38ba8] hover:bg-[#f38ba8] hover:text-[#1e1215] border border-[#3a2a2a] px-3 py-1.5 rounded text-sm font-bold transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'กำลังลบ...' : '🗑️ ลบงวดนี้ทิ้ง'}
        </button>
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
          </div>
        )}

        {activeTab === 'bills' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">บิลลูกค้าทั้งหมด ({bills.length} ใบ)</h2>
            <p className="text-[#6c7086] text-sm mb-4">คลิกที่บิลเพื่อดูรายการเลขที่แทง</p>
            <div className="space-y-4">
              {bills.map((bill: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedBill(bill)}
                  className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4 cursor-pointer hover:border-[#89b4fa] transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[#cdd6f4] font-bold">บิล #{bill.id} - {bill.customer?.name}</span>
                    <span className="text-[#a6e3a1] font-bold">฿{(bill.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#6c7086] mt-1">จำนวน {(bill.entries || []).length} รายการ</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cutouts' && (
          <div>
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">ประวัติการตัดส่งออก ({cutouts.length} ครั้ง)</h2>
            <p className="text-[#6c7086] text-sm mb-4">คลิกที่รอบส่งออกเพื่อดูรายการเลขที่ถูกตัดส่ง</p>
            <div className="space-y-4">
              {cutouts.map((c: any, i: number) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedCutout({ ...c, index: i + 1 })}
                  className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4 cursor-pointer hover:border-[#89b4fa] transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#f9e2af] font-bold">รอบที่ {i+1}</span>
                    <span className="text-[#f38ba8] font-bold">฿{(c.amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-[#6c7086] mb-2">{c.date} {c.time}</div>
                  <div className="text-xs text-[#6c7086] mt-1">จำนวน {(c.items || []).length} รายการ</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div>
            {/* Show Results clearly first */}
            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">🎯 ผลรางวัลที่ออกงวดนี้</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              {['3บน', '3โต้ด', '2บน', '2ล่าง'].map(type => (
                rewards[type] && (
                  <div key={type} className="bg-[#0d1117] border border-[#f9e2af] p-3 rounded-lg text-center shadow-[0_0_10px_rgba(249,226,175,0.1)]">
                    <div className="text-xs text-[#6c7086] mb-1">{type}</div>
                    <div className="text-2xl font-bold text-[#f9e2af] tracking-wider">{rewards[type]}</div>
                  </div>
                )
              ))}
              {Object.keys(rewards).length === 0 && (
                <p className="text-[#6c7086] text-sm col-span-full">ไม่มีข้อมูลผลรางวัลในงวดนี้</p>
              )}
            </div>

            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">สรุปกำไร/ขาดทุนสุทธิ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Overall Profit/Loss */}
              <div className="bg-[#0d1117] border border-[#2a3244] rounded-lg p-4">
                <h3 className="text-[#89b4fa] font-bold text-center mb-4">ยอดรวมทั้งหมด (ก่อนส่งออก)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดรับแทงรวม (หลังหักส่วนลด)</span>
                    <span className="text-[#a6e3a1]">฿{stats.totalRecvDiscounted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดถูกรางวัลรวมลูกค้า</span>
                    <span className="text-[#f38ba8]">-฿{stats.totalPayoutOverall.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-3 border-t border-[#1e2433] text-lg ${stats.netProfitOverall >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                    <span>กำไร/ขาดทุนรวม</span>
                    <span>{stats.netProfitOverall >= 0 ? '+' : ''}{stats.netProfitOverall.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Kept Profit/Loss */}
              <div className="bg-[#0d1117] border border-[#f38ba8] rounded-lg p-4 shadow-[0_0_15px_rgba(243,139,168,0.1)]">
                <h3 className="text-[#f38ba8] font-bold text-center mb-4">ยอดที่ร้านเก็บไว้สู้เอง (สุทธิ)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดเก็บ (หลังหักส่วนลดคร่าวๆ)</span>
                    <span className="text-[#a6e3a1]">฿{stats.totalKeepDiscounted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6c7086]">ยอดถูกรางวัล (เฉพาะที่เก็บไว้)</span>
                    <span className="text-[#f38ba8]">-฿{stats.totalPayoutKept.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between font-bold pt-3 border-t border-[#1e2433] text-lg ${stats.netProfitKept >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                    <span>กำไร/ขาดทุนสู้เอง</span>
                    <span>{stats.netProfitKept >= 0 ? '+' : ''}{stats.netProfitKept.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-[#cdd6f4] font-bold text-lg mb-4">รายการบิลที่ถูกรางวัล</h2>
            <div className="space-y-2">
              {winningEntries.length === 0 ? (
                <p className="text-[#6c7086] text-sm">ไม่มีบิลที่ถูกรางวัล</p>
              ) : (
                winningEntries.map((w, i) => (
                  <div key={i} className="bg-[#0d1117] border border-[#2a3244] p-3 rounded-lg flex justify-between items-center text-sm">
                    <div>
                      <span className="text-[#89b4fa] font-bold mr-2">บิล #{w.billId}</span>
                      <span className="text-[#a6adc8] mr-2">{w.customerName}</span>
                      <span className="bg-[#1e2433] text-[#cdd6f4] px-2 py-0.5 rounded text-xs">{w.type} <b>{w.number}</b></span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#f9e2af] font-bold block">ถูก ฿{w.payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-[#f38ba8]">ร้านจ่าย ฿{w.payoutKeep.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bill Popup Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#2a3244] flex justify-between items-center">
              <h3 className="text-[#89b4fa] font-bold text-lg">รายละเอียดบิล #{selectedBill.id}</h3>
              <button onClick={() => setSelectedBill(null)} className="text-[#6c7086] hover:text-[#f38ba8] text-xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-[#a6adc8] mb-4">ลูกค้า: <b>{selectedBill.customer?.name}</b></p>
              <div className="space-y-2">
                {(selectedBill.entries || []).map((e: any, idx: number) => (
                  <div key={idx} className="flex justify-between border-b border-[#1e2433] pb-2 text-sm">
                    <span className="text-[#cdd6f4]">{e.type} <b>{e.number}</b></span>
                    <span className="text-[#a6e3a1]">฿{e.amount}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-[#2a3244] text-right font-bold text-[#a6e3a1]">
              ยอดรวมบิลนี้: ฿{(selectedBill.total || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Cutout Popup Modal */}
      {selectedCutout && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#11151e] border border-[#2a3244] rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#2a3244] flex justify-between items-center">
              <h3 className="text-[#f9e2af] font-bold text-lg">รายละเอียดส่งออก รอบที่ {selectedCutout.index}</h3>
              <button onClick={() => setSelectedCutout(null)} className="text-[#6c7086] hover:text-[#f38ba8] text-xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-[#a6adc8] mb-4 text-xs">เวลาตัดส่ง: {selectedCutout.date} {selectedCutout.time}</p>
              <div className="space-y-2">
                {(selectedCutout.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between border-b border-[#1e2433] pb-2 text-sm">
                    <span className="text-[#cdd6f4]">{item.type} <b>{item.num}</b></span>
                    <span className="text-[#f38ba8]">ส่งออก ฿{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-[#2a3244] text-right font-bold text-[#f38ba8]">
              ยอดส่งออกรอบนี้รวม: ฿{(selectedCutout.amount || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
