'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchBills, fetchCustomers, Bill, Customer } from '../../lib/api';
import { getPerms } from '../../lib/lotto';

const ALL_TYPES = ['2บน', '2ล่าง', '3บน', '3โต้ด'];

export default function SummaryPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ALL_TYPES));
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | 'all'>('all');
  const [numSearch, setNumSearch] = useState('');
  const [revSearch, setRevSearch] = useState(false);
  
  const [selectedNum, setSelectedNum] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchBills(), fetchCustomers()])
      .then(([billsData, customersData]) => {
        setBills(billsData);
        setCustomers(customersData);
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  const aggregated = useMemo(() => {
    const map = new Map<string, { num: string, top: number, bot: number, tod: number, total: number, details: any[] }>();
    
    // 1. Filter Bills by Customer
    const filteredBills = selectedCustomerId === 'all' 
      ? bills 
      : bills.filter(b => b.customerId === selectedCustomerId);

    filteredBills.forEach(bill => {
      bill.entries.forEach(entry => {
        // 2. Filter by selected Types (2บน, 2ล่าง, 3บน, 3โต้ด)
        if (!selectedTypes.has(entry.type)) return;
        // ลอจิก3ตัวโต้ด: ถ้าเป็น 3โต้ด ให้เรียงเลขจากน้อยไปมากเพื่อมัดรวมยอด
        let aggNum = entry.number;
        if (entry.type === '3โต้ด') {
          aggNum = entry.number.split('').sort().join('');
        }

        if (!map.has(aggNum)) {
          map.set(aggNum, { num: aggNum, top: 0, bot: 0, tod: 0, total: 0, details: [] });
        }
        const item = map.get(aggNum)!;
        if (entry.type.includes('บน')) item.top += entry.amount;
        if (entry.type.includes('ล่าง')) item.bot += entry.amount;
        if (entry.type.includes('โต้ด')) item.tod += entry.amount;
        item.total += entry.amount;
        
        item.details.push({
          customerName: bill.customer.name,
          customerColor: bill.customer.tc,
          type: entry.type,
          amount: entry.amount,
          billId: bill.id,
        });
      });
    });

    let result = Array.from(map.values()).sort((a, b) => b.total - a.total);
    
    // 3. Filter by Number Search
    if (numSearch.trim() !== '') {
      if (revSearch) {
        let perms: Set<string>;
        if (numSearch.length === 3) {
          perms = new Set(getPerms(numSearch));
        } else if (numSearch.length === 2) {
          perms = new Set([numSearch, numSearch[1] + numSearch[0]]);
        } else {
          perms = new Set([numSearch]);
        }
        result = result.filter(x => perms.has(x.num));
      } else {
        // ตรงตัว
        result = result.filter(x => x.num === numSearch);
      }
    }

    return result;
  }, [bills, selectedTypes, selectedCustomerId, numSearch, revSearch]);

  const selectedData = aggregated.find(x => x.num === selectedNum);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-[#0d1117] border-b border-[#1e2433] px-4 py-2 flex flex-wrap items-center gap-4">
        
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6c7086]">ประเภท:</span>
          <button 
            onClick={() => setSelectedTypes(selectedTypes.size === ALL_TYPES.length ? new Set() : new Set(ALL_TYPES))}
            className={`text-xs px-2 py-1 rounded border transition-colors ${selectedTypes.size === ALL_TYPES.length ? 'bg-[#1e2d3d] text-[#89b4fa] border-[#2a4a6b]' : 'bg-[#11151e] text-[#6c7086] border-[#2a3244] hover:text-[#cdd6f4]'}`}
          >
            ทั้งหมด
          </button>
          {ALL_TYPES.map(type => (
            <label key={type} className="flex items-center gap-1 text-xs text-[#cdd6f4] cursor-pointer">
              <input 
                type="checkbox" 
                className="accent-[#89b4fa]"
                checked={selectedTypes.has(type)}
                onChange={(e) => {
                  const newSet = new Set(selectedTypes);
                  if (e.target.checked) newSet.add(type);
                  else newSet.delete(type);
                  setSelectedTypes(newSet);
                }}
              />
              {type}
            </label>
          ))}
        </div>

        <div className="w-px h-5 bg-[#2a3244]"></div>

        {/* Customer Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6c7086]">ลูกค้า:</span>
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-[#11151e] border border-[#2a3244] rounded text-[#cdd6f4] text-xs px-2 py-1 outline-none focus:border-[#89b4fa]"
          >
            <option value="all">ทั้งหมด</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-[#2a3244]"></div>

        {/* Number Search */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6c7086]">เลข:</span>
          <input 
            type="text" 
            maxLength={3}
            placeholder="00"
            value={numSearch}
            onChange={e => setNumSearch(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-14 bg-[#11151e] border border-[#2a3244] rounded text-[#a6e3a1] font-mono font-bold text-center text-sm px-1 py-1 outline-none focus:border-[#89b4fa]"
          />
          <label className="flex items-center gap-1 text-[11px] text-[#cba6f7] cursor-pointer ml-1 select-none">
            <input 
              type="checkbox" 
              checked={revSearch}
              onChange={e => setRevSearch(e.target.checked)}
              className="accent-[#cba6f7]"
            />
            ชุดเลข 6,3 กลับ
          </label>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left List */}
        <div className="w-1/3 min-w-[280px] border-r border-[#1e2433] flex flex-col bg-[#0a0e14]">
          <div className="grid grid-cols-4 px-3 py-2 text-[10px] text-[#6c7086] bg-[#0d1117] border-b border-[#1e2433]">
            <div>เลข</div>
            <div className="text-right">บน</div>
            <div className="text-right">ล่าง/โต้ด</div>
            <div className="text-right">รวม</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-[#6c7086] py-10 text-sm">กำลังคำนวณยอด...</div>
            ) : aggregated.length === 0 ? (
              <div className="text-center text-[#6c7086] py-10 text-sm">ไม่มีข้อมูลการแทง</div>
            ) : (
              aggregated.map(item => (
                <div 
                  key={item.num}
                  onClick={() => setSelectedNum(item.num)}
                  className={`grid grid-cols-4 px-3 py-2 text-sm border-b border-[#13171f] cursor-pointer hover:bg-[#11151e] transition-colors ${selectedNum === item.num ? 'bg-[#111a1a] border-l-2 border-l-[#a6e3a1]' : ''}`}
                >
                  <div className="text-[#a6e3a1] font-mono font-bold tracking-wider">{item.num}</div>
                  <div className="text-right text-[#74c7ec]">{item.top > 0 ? item.top : '-'}</div>
                  <div className="text-right text-[#f9e2af]">{item.bot > 0 ? item.bot : (item.tod > 0 ? item.tod : '-')}</div>
                  <div className="text-right text-[#cdd6f4] font-bold">{item.total}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Details */}
        <div className="flex-1 bg-[#0d1117] p-6 overflow-y-auto">
          {selectedData ? (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl text-[#a6e3a1] font-mono font-bold tracking-widest">{selectedData.num}</div>
                <div className="text-[#6c7086]">ยอดรวมทั้งหมด <span className="text-[#cdd6f4] font-bold">฿{selectedData.total.toLocaleString()}</span></div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4">
                  <div className="text-xs text-[#6c7086] mb-1">ยอดบน</div>
                  <div className="text-xl text-[#74c7ec] font-bold">฿{selectedData.top.toLocaleString()}</div>
                </div>
                <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4">
                  <div className="text-xs text-[#6c7086] mb-1">ยอดล่าง</div>
                  <div className="text-xl text-[#f9e2af] font-bold">฿{selectedData.bot.toLocaleString()}</div>
                </div>
                <div className="bg-[#11151e] border border-[#2a3244] rounded-lg p-4">
                  <div className="text-xs text-[#6c7086] mb-1">ยอดโต้ด</div>
                  <div className="text-xl text-[#cba6f7] font-bold">฿{selectedData.tod.toLocaleString()}</div>
                </div>
              </div>

              <h3 className="text-[#89b4fa] font-bold mb-3 border-b border-[#1e2433] pb-2">รายละเอียดบิลที่แทง</h3>
              <div className="space-y-2">
                {selectedData.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#11151e] p-3 rounded border border-[#1e2433]">
                    <div className="flex items-center gap-3">
                      <span className="text-[#6c7086] text-xs font-mono">#{d.billId.toString().padStart(4, '0')}</span>
                      <span className="font-bold" style={{ color: d.customerColor || '#cdd6f4' }}>{d.customerName}</span>
                      <span className="text-[10px] bg-[#1e2433] px-2 py-1 rounded text-[#6c7086]">{d.type}</span>
                    </div>
                    <div className="text-[#a6e3a1] font-bold">฿{d.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#6c7086] text-sm">
              คลิกที่ตัวเลขด้านซ้ายเพื่อดูสถิติโดยละเอียด
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
