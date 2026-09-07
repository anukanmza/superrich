'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchCustomers, fetchBills, getSettings, Customer, Bill } from '../../lib/api';
import { isWinning, getPrizeRate } from '../../lib/lotto';
import * as XLSX from 'xlsx';

type CustomerRow = {
  customer: Customer;
  bills: (Bill & { customerBillIndex: number })[];
  gross: number;
  disc: number;
  after: number;
  payout: number;
  net: number;
};

export default function CustomerSummaryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<(Bill & { customerBillIndex: number })[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [specificRates, setSpecificRates] = useState<any[]>([]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchCustomers(), fetchBills(), getSettings()])
      .then(([customersData, billsData, settingsData]) => {
        setCustomers(customersData);
        
        // Add customerBillIndex to bills
        const sortedBills = billsData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const counts: Record<number, number> = {};
        const billsWithIndex = sortedBills.map(b => {
          counts[b.customerId] = (counts[b.customerId] || 0) + 1;
          return { ...b, customerBillIndex: counts[b.customerId] };
        });
        setBills(billsWithIndex.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); // Sort back to newest first
        
        if (settingsData.results_json) {
          try { setResults(JSON.parse(settingsData.results_json) || {}); } catch (e) {}
        }
        if (settingsData.rates_json) {
          try { setRates(JSON.parse(settingsData.rates_json) || {}); } catch (e) {}
        }
        if (settingsData.specificRates_json) {
          try { setSpecificRates(JSON.parse(settingsData.specificRates_json) || []); } catch (e) {}
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const customerRows = useMemo<CustomerRow[]>(() => {
    return customers.map(c => {
      const cBills = bills.filter(b => b.customerId === c.id);
      
      const gross = cBills.reduce((sum, b) => {
        return sum + (b.entries || []).reduce((s, e) => s + (e.amount || 0), 0);
      }, 0);
      
      const disc = c.disc || 0;
      const after = gross * (1 - disc / 100);
      
      const payout = cBills.reduce((sum, b) => {
        const wins = (b.entries || []).filter(e => isWinning({ number: e.number || '', type: e.type || '' }, results));
        const billPayout = wins.reduce((s, e) => {
          const rate = getPrizeRate({ number: e.number || '', type: e.type || '' }, rates, specificRates);
          return s + ((e.amount || 0) * rate);
        }, 0);
        return sum + billPayout;
      }, 0);
      
      return {
        customer: c,
        bills: cBills,
        gross,
        disc,
        after,
        payout,
        net: after - payout
      };
    }).sort((a, b) => b.net - a.net);
  }, [customers, bills, results, rates, specificRates]);

  const totalGross = customerRows.reduce((s, r) => s + r.gross, 0);
  const totalAfter = customerRows.reduce((s, r) => s + r.after, 0);
  const totalPayout = customerRows.reduce((s, r) => s + r.payout, 0);
  const totalNet = customerRows.reduce((s, r) => s + r.net, 0);

  const exportExcel = (row: CustomerRow) => {
    const data = [
      ['สรุปลูกค้า', row.customer.name || ''],
      [],
      ['รายการ', 'ยอด'],
      ['ยอดซื้อรวม', row.gross],
      ['ส่วนลด %', row.disc],
      ['ยอดหลังหักส่วนลด', row.after],
      ['ยอดถูกรางวัล', row.payout],
      ['ยอดสุทธิ', row.net],
      [],
      ['บิล', 'ยอดรวม', 'ยอดถูกรางวัล', 'ยอดสุทธิหลังหักรางวัล', 'รายละเอียดเลขถูกรางวัล']
    ];

    row.bills.forEach(b => {
      const gross = (b.entries || []).reduce((s, e) => s + (e.amount || 0), 0);
      
      const wins = (b.entries || []).filter(e => isWinning({ number: e.number || '', type: e.type || '' }, results));
      const payout = wins.reduce((s, e) => {
        const rate = getPrizeRate({ number: e.number || '', type: e.type || '' }, rates, specificRates);
        return s + ((e.amount || 0) * rate);
      }, 0);
      
      const winStrings = wins.map(e => {
        const rate = getPrizeRate({ number: e.number || '', type: e.type || '' }, rates, specificRates);
        const p = (e.amount || 0) * rate;
        return `[${e.type}] เลข ${e.number} ยอด ${e.amount} จ่าย ฿${p.toLocaleString()}`;
      });
      
      const billTitle = `${row.customer.name || 'ไม่ทราบชื่อ'} บิลที่ ${b.customerBillIndex}`;
      data.push([
        billTitle,
        gross,
        payout,
        gross - payout,
        winStrings.join('\n') // This cleanly separates multiple wins per bill with newlines
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:30}, {wch:18}, {wch:18}, {wch:22}, {wch:50}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปลูกค้า');
    
    const safeName = (row.customer.name || 'customer').replace(/[\\/:*?"<>|]/g, '_');
    const dateStr = new Date().toLocaleDateString('en-CA');
    XLSX.writeFile(wb, `สรุปลูกค้า_${safeName}_${dateStr}.xlsx`);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[#cdd6f4]">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0e14] overflow-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#89b4fa]">📒 สรุปยอดแต่ละลูกค้า</h2>
          <div className="text-xs text-[#6c7086] mt-1">แสดงยอดซื้อรวม / หลังหักส่วนลด / ถูกรางวัล / สุทธิ</div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded-lg">
          <div className="text-xs text-[#6c7086] mb-1">ยอดซื้อรวมทั้งหมด</div>
          <div className="text-2xl font-bold text-[#a6e3a1]">฿{totalGross.toLocaleString()}</div>
        </div>
        <div className="bg-[#11151e] border border-[#2a3244] p-4 rounded-lg">
          <div className="text-xs text-[#6c7086] mb-1">ยอดหลังหักส่วนลด</div>
          <div className="text-2xl font-bold text-[#f9e2af]">฿{totalAfter.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
        </div>
        <div className="bg-[#1e1215] border border-[#3a2a2a] p-4 rounded-lg">
          <div className="text-xs text-[#f38ba8] mb-1 font-bold">ยอดถูกรางวัลรวม</div>
          <div className="text-2xl font-bold text-[#f38ba8]">฿{totalPayout.toLocaleString()}</div>
        </div>
        <div className={`border p-4 rounded-lg shadow-lg ${totalNet >= 0 ? 'bg-[#1a3a20] border-[#2d6b36] shadow-[0_0_15px_rgba(166,227,161,0.1)]' : 'bg-[#3b1e28] border-[#8a2a3b] shadow-[0_0_15px_rgba(243,139,168,0.1)]'}`}>
          <div className={`text-xs mb-1 font-bold ${totalNet >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>ยอดสุทธิรวม (กำไร/ขาดทุน)</div>
          <div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>฿{totalNet.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
        </div>
      </div>

      <div className="bg-[#1e2433] text-[#a6e3a1] p-3 rounded text-xs mb-6 text-center border border-[#2d6b36]">
        <span className="font-bold text-[#f9e2af]">💡 หมายเหตุ: </span>
        ยอดสุทธิ = ยอดหลังหักส่วนลด - ยอดถูกรางวัล
      </div>

      {/* Customers Grid */}
      {customerRows.length === 0 ? (
        <div className="text-center p-10 bg-[#11151e] border border-[#2a3244] rounded text-[#6c7086]">
          ยังไม่มีข้อมูลลูกค้า หรือ ยังไม่มีบิล
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customerRows.map((row) => (
            <div key={row.customer.id} className="bg-[#11151e] border border-[#2a3244] rounded-xl overflow-hidden shadow-lg flex flex-col">
              <div className="p-4 border-b border-[#1e2433] flex items-center gap-4 bg-[#181825]">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0"
                  style={{ backgroundColor: row.customer.color || '#1e2d3d', color: row.customer.tc || '#89b4fa' }}
                >
                  {(row.customer.name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[#cdd6f4] truncate">{row.customer.name || 'ไม่ระบุชื่อ'}</div>
                  <div className="text-xs text-[#6c7086]">บิล {row.bills.length} ใบ | ส่วนลด {row.disc}%</div>
                </div>
              </div>
              
              <div className="p-4 flex-1 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-[#1e2433] pb-2">
                  <span className="text-[#6c7086]">ยอดซื้อรวม</span>
                  <span className="font-bold text-[#a6e3a1]">฿{row.gross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-[#1e2433] pb-2">
                  <span className="text-[#6c7086]">หลังหักส่วนลด</span>
                  <span className="font-bold text-[#f9e2af]">฿{row.after.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-[#1e2433] pb-2">
                  <span className="text-[#6c7086]">ยอดถูกรางวัล</span>
                  <span className="font-bold text-[#f38ba8]">฿{row.payout.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-base pt-1">
                  <span className="font-bold text-[#cdd6f4]">ยอดสุทธิ</span>
                  <span className={`font-bold ${row.net >= 0 ? 'text-[#a6e3a1]' : 'text-[#f38ba8]'}`}>
                    ฿{row.net.toLocaleString(undefined, {maximumFractionDigits: 2})}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => exportExcel(row)}
                className="bg-[#1e2d3d] hover:bg-[#2a4a6b] text-[#89b4fa] py-3 text-sm font-bold transition-colors w-full border-t border-[#2a4a6b]"
              >
                📥 บันทึกไฟล์ Excel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
