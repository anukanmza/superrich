'use client';

import { useState, useEffect } from 'react';
import { fetchCustomers, createCustomer, updateCustomer, Customer } from '../../../lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [disc, setDisc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomers = () => {
    setIsLoading(true);
    fetchCustomers().then(data => {
      setCustomers(data);
    }).catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingId(customer.id);
      setName(customer.name);
      setPhone(customer.phone || '');
      setDisc(customer.disc != null && customer.disc !== -1 ? customer.disc.toString() : '');
    } else {
      setEditingId(null);
      setName('');
      setPhone('');
      setDisc('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!name) {
      alert('กรุณากรอกชื่อลูกค้า');
      return;
    }

    setIsSaving(true);
    const data = {
      name,
      phone,
      disc: disc ? parseInt(disc) : -1,
      color: '#1e2d3d', // Default color, can be randomized later
      tc: '#89b4fa'
    };

    try {
      if (editingId) {
        await updateCustomer(editingId, data);
      } else {
        await createCustomer(data);
      }
      closeModal();
      loadCustomers();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-[#89b4fa]">จัดการลูกค้า</h1>
        <button 
          onClick={() => openModal()}
          className="bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] px-4 py-2 rounded font-bold hover:bg-[#223f28] transition-colors"
        >
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
                <button 
                  onClick={() => openModal(c)}
                  className="flex-1 bg-[#0d1117] border border-[#2a3244] text-[#6c7086] text-xs py-1.5 rounded hover:text-[#f9e2af] hover:border-[#6b5929]"
                >
                  แก้ไข
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-[#11151e] border border-[#2a4a6b] rounded-lg p-5 w-80 flex flex-col gap-4 shadow-xl">
            <h2 className="text-lg font-bold text-[#89b4fa]">
              {editingId ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </h2>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6c7086]">ชื่อลูกค้า *</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ชื่อ..."
                className="bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6c7086]">เบอร์โทร</label>
              <input 
                type="text" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                className="bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#6c7086]">ส่วนลด %</label>
              <input 
                type="number" 
                value={disc}
                onChange={e => setDisc(e.target.value)}
                placeholder="เช่น 15"
                className="w-24 bg-[#0a0e14] border border-[#2a3244] rounded px-3 py-2 text-[#cdd6f4] outline-none focus:border-[#89b4fa]"
              />
              <span className="text-[10px] text-[#45475a] mt-1">เว้นว่าง = ใช้ค่า default</span>
            </div>

            <div className="flex gap-2 mt-2">
              <button 
                onClick={closeModal}
                disabled={isSaving}
                className="flex-1 bg-[#1e1215] border border-[#3a2a2a] text-[#f38ba8] font-bold py-2 rounded"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-[#1a3a20] border border-[#2d6b36] text-[#a6e3a1] font-bold py-2 rounded"
              >
                {isSaving ? 'กำลังบันทึก...' : '✓ บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
