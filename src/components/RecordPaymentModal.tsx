import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  Home,
  Zap,
  Calendar,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { MonthlyLedgerItem, Unit } from '../types';

export interface LedgerRecordFormData {
  flatId: string;
  tenantName: string;
  tenantPhone: string;
  entryDate: string;
  flatMonthlyRent: number;
  advanceStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  advanceAmount: number;
  advanceDate: string;
  rentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  rentPaidAmount: number;
  rentOutstandingDue: number;
  rentPaymentDate: string;
  electricityStatus: 'Paid' | 'Not Paid' | 'N/A';
  electricityAmount: number;
  electricityDate: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: LedgerRecordFormData) => void;
  initialItem?: MonthlyLedgerItem | null;
  availableUnits?: Unit[];
  selectedMonth: number;
  selectedYear: number;
}

export const RecordPaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  availableUnits = [],
  selectedMonth,
  selectedYear,
}) => {
  const [flatId, setFlatId] = useState<string>(initialItem?.flatId || availableUnits[0]?.flatId || 'A1');
  const [tenantName, setTenantName] = useState<string>(initialItem?.tenantName || 'Sajib');
  const [tenantPhone, setTenantPhone] = useState<string>(initialItem?.tenantPhone || '01729-916822');
  const [entryDate, setEntryDate] = useState<string>(initialItem?.entryDate || '2025-06-01');
  const [flatMonthlyRent, setFlatMonthlyRent] = useState<number>(initialItem?.flatRent || 8500);

  // Section 1: Advance
  const [advanceStatus, setAdvanceStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>(
    initialItem?.advanceStatus || (initialItem && initialItem.advancePayment > 0 ? 'Paid' : 'Not Paid')
  );
  const [advanceAmount, setAdvanceAmount] = useState<number>(initialItem?.advancePayment || 0);
  const [advanceDate, setAdvanceDate] = useState<string>(initialItem?.advanceDate || '2025-06-01');

  // Section 2: Flat Rent
  const [rentStatus, setRentStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>(
    (initialItem?.paymentStatus as any) || 'Paid'
  );
  const [rentPaidAmount, setRentPaidAmount] = useState<number>(
    initialItem ? initialItem.totalPaid : 8500
  );
  const [rentOutstandingDue, setRentOutstandingDue] = useState<number>(
    initialItem ? initialItem.totalDue : 0
  );
  const [rentPaymentDate, setRentPaymentDate] = useState<string>(
    initialItem?.rentPaymentDate || initialItem?.lastPaymentDate || '2026-09-08'
  );

  // Section 3: Electricity
  const [electricityStatus, setElectricityStatus] = useState<'Paid' | 'Not Paid' | 'N/A'>(
    initialItem?.electricityStatus || (initialItem && initialItem.electricityBill > 0 ? 'Paid' : 'N/A')
  );
  const [electricityAmount, setElectricityAmount] = useState<number>(
    initialItem ? initialItem.electricityBill : 1200
  );
  const [electricityDate, setElectricityDate] = useState<string>(
    initialItem?.electricityDate || '2026-09-02'
  );

  // Reset form when initialItem changes
  useEffect(() => {
    if (initialItem) {
      setFlatId(initialItem.flatId);
      setTenantName(initialItem.tenantName);
      setTenantPhone(initialItem.tenantPhone);
      setEntryDate(initialItem.entryDate || '2025-06-01');
      setFlatMonthlyRent(initialItem.flatRent);

      setAdvanceStatus(initialItem.advanceStatus || (initialItem.advancePayment > 0 ? 'Paid' : 'Not Paid'));
      setAdvanceAmount(initialItem.advancePayment);
      setAdvanceDate(initialItem.advanceDate || initialItem.entryDate || '2025-06-01');

      setRentStatus((initialItem.paymentStatus as any) || 'Paid');
      setRentPaidAmount(initialItem.totalPaid);
      setRentOutstandingDue(initialItem.totalDue);
      setRentPaymentDate(initialItem.rentPaymentDate || initialItem.lastPaymentDate || '2026-09-08');

      setElectricityStatus(initialItem.electricityStatus || (initialItem.electricityBill > 0 ? 'Paid' : 'N/A'));
      setElectricityAmount(initialItem.electricityBill);
      setElectricityDate(initialItem.electricityDate || '2026-09-02');
    }
  }, [initialItem]);

  if (!isOpen) return null;

  // Calculate duration from entryDate
  const calculateDuration = (dateStr: string) => {
    if (!dateStr) return '--';
    const entry = new Date(dateStr);
    if (isNaN(entry.getTime())) return '--';
    const now = new Date();
    let months = (now.getFullYear() - entry.getFullYear()) * 12 + (now.getMonth() - entry.getMonth());
    if (now.getDate() < entry.getDate()) months--;
    if (months < 0) return 'Future Move-in';
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years === 0 && remMonths === 0) return 'Less than 1 month';
    if (years === 0) return `${remMonths} month${remMonths > 1 ? 's' : ''}`;
    if (remMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} year${years > 1 ? 's' : ''}, ${remMonths} month${remMonths > 1 ? 's' : ''}`;
  };

  const handlePaidAmountChange = (val: number) => {
    setRentPaidAmount(val);
    const due = Math.max(0, flatMonthlyRent - val);
    setRentOutstandingDue(due);
    if (val === 0) {
      setRentStatus('Not Paid');
    } else if (due > 0) {
      setRentStatus('Partially Paid');
    } else {
      setRentStatus('Paid');
    }
  };

  const handleMonthlyRentChange = (val: number) => {
    setFlatMonthlyRent(val);
    const due = Math.max(0, val - rentPaidAmount);
    setRentOutstandingDue(due);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      flatId,
      tenantName,
      tenantPhone,
      entryDate,
      flatMonthlyRent,
      advanceStatus,
      advanceAmount,
      advanceDate,
      rentStatus,
      rentPaidAmount,
      rentOutstandingDue,
      rentPaymentDate,
      electricityStatus,
      electricityAmount,
      electricityDate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
              Record Payment - Unit {flatId}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 text-xs">
          {/* Unit Selector if no fixed unit */}
          {availableUnits.length > 0 && !initialItem && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select Flat / Unit
              </label>
              <select
                value={flatId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFlatId(id);
                  const u = availableUnits.find((unit) => unit.flatId === id);
                  if (u) {
                    setFlatMonthlyRent(u.monthlyRent);
                    setRentPaidAmount(u.monthlyRent);
                    setRentOutstandingDue(0);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.flatId}>
                    Unit {u.flatId} ({u.blockName}) - ৳{u.monthlyRent}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Top Section: Tenant info & Monthly Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tenant Name
              </label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. Sajib"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mobile Phone
              </label>
              <input
                type="text"
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="e.g. 01729-916822"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Entry Date (Move-in)
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                Duration: {calculateDuration(entryDate)}
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Flat Monthly Rent (BDT)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={flatMonthlyRent}
                onChange={(e) => handleMonthlyRentChange(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Section 1: ADVANCE PAYMENT DEPOSIT (Purple Bordered Card) */}
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 space-y-2.5">
            <div className="font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <Wallet className="w-4 h-4 text-indigo-600" />
              1. ADVANCE PAYMENT DEPOSIT
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Advance Status
                </label>
                <select
                  value={advanceStatus}
                  onChange={(e) => setAdvanceStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs"
                >
                  <option value="Not Paid">Not Paid</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Adjusted">Adjusted</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Advance Amount (BDT)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Advance Date
                </label>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: FLAT MONTHLY RENT (Blue Bordered Card) */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-2.5">
            <div className="font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <Home className="w-4 h-4 text-blue-600" />
              2. FLAT MONTHLY RENT
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Rent Status
                </label>
                <select
                  value={rentStatus}
                  onChange={(e) => setRentStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                >
                  <option value="Paid">Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Adjusted">Adjusted</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Paid Amount (BDT)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={rentPaidAmount}
                  onChange={(e) => handlePaidAmountChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Outstanding Due (BDT)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={rentOutstandingDue}
                  onChange={(e) => setRentOutstandingDue(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-rose-600 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  Rent Payment Date
                </label>
                <input
                  type="date"
                  value={rentPaymentDate}
                  onChange={(e) => setRentPaymentDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: ELECTRICITY BILL (Yellow/Amber Bordered Card) */}
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/20 space-y-2.5">
            <div className="font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5 text-[11px]">
              <Zap className="w-4 h-4 text-amber-600" />
              3. ELECTRICITY BILL
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  E-Bill Status
                </label>
                <select
                  value={electricityStatus}
                  onChange={(e) => setElectricityStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs"
                >
                  <option value="Paid">Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px] flex items-center justify-between">
                  <span>Bill Amount (BDT)</span>
                  <span className="text-[10px] text-amber-700 font-normal">Any number / ৳</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={electricityAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setElectricityAmount(val === '' ? ('' as any) : Number(val));
                    }
                  }}
                  placeholder="e.g. 125"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 text-[11px]">
                  E-Bill Date
                </label>
                <input
                  type="date"
                  value={electricityDate}
                  onChange={(e) => setElectricityDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all cursor-pointer text-xs"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
