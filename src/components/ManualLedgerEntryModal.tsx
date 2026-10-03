import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Building,
  Calendar,
  User,
  Phone,
  Wallet,
  Zap,
  Car,
  FileEdit,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  AppDatabaseState,
  MonthlyLedgerItem,
  PaymentStatus,
} from '../types';
import { formatBDT, MONTH_NAMES } from '../lib/nescoTariff';
import { formatBillingPeriod } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit: MonthlyLedgerItem | null;
  data: AppDatabaseState;
  onSave: (item: MonthlyLedgerItem) => void;
  userRole: string;
  assignedBlock?: string;
}

export const ManualLedgerEntryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  itemToEdit,
  data,
  onSave,
  userRole,
  assignedBlock,
}) => {
  // Scoped units
  const availableUnits = data.units.filter((u) => {
    if (userRole === 'owner' && assignedBlock) {
      return u.blockName === assignedBlock;
    }
    return true;
  });

  const [flatId, setFlatId] = useState<string>(
    itemToEdit?.flatId || (availableUnits[0]?.flatId ?? 'A1')
  );
  const [blockName, setBlockName] = useState<'Block A' | 'Block B' | 'Block C'>(
    itemToEdit?.blockName || (userRole === 'owner' && assignedBlock ? (assignedBlock as any) : 'Block A')
  );
  const [month, setMonth] = useState<number>(itemToEdit?.month || data.selectedMonth);
  const [year, setYear] = useState<number>(itemToEdit?.year || data.selectedYear);
  const [tenantName, setTenantName] = useState<string>(itemToEdit?.tenantName || '');
  const [tenantPhone, setTenantPhone] = useState<string>(itemToEdit?.tenantPhone || '');
  const [entryDate, setEntryDate] = useState<string>(itemToEdit?.entryDate || '2026-01-01');

  // Amounts
  const [advancePayment, setAdvancePayment] = useState<string | number>(
    itemToEdit?.advancePayment !== undefined ? itemToEdit.advancePayment : 50000
  );
  const [advanceStatus, setAdvanceStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>(
    itemToEdit?.advanceStatus || (itemToEdit && itemToEdit.advancePayment > 0 ? 'Paid' : 'Paid')
  );
  const [advanceDate, setAdvanceDate] = useState<string>(itemToEdit?.advanceDate || itemToEdit?.entryDate || '2026-01-01');

  const [flatRent, setFlatRent] = useState<string | number>(
    itemToEdit?.flatRent !== undefined ? itemToEdit.flatRent : 25000
  );
  const [rentStatus, setRentStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>(
    itemToEdit?.rentStatus ||
      (itemToEdit?.paymentStatus === 'Paid'
        ? 'Paid'
        : itemToEdit?.paymentStatus === 'Adjusted'
        ? 'Adjusted'
        : itemToEdit?.paymentStatus === 'N/A'
        ? 'N/A'
        : 'Not Paid')
  );
  const [rentPaymentDate, setRentPaymentDate] = useState<string>(
    itemToEdit?.rentPaymentDate || itemToEdit?.lastPaymentDate || '2026-10-05'
  );

  const [electricityBill, setElectricityBill] = useState<string | number>(
    itemToEdit?.electricityBill !== undefined ? itemToEdit.electricityBill : 0
  );
  const [electricityStatus, setElectricityStatus] = useState<'Paid' | 'Not Paid' | 'N/A'>(
    itemToEdit?.electricityStatus || (itemToEdit && itemToEdit.electricityBill > 0 ? 'Not Paid' : 'N/A')
  );
  const [electricityDate, setElectricityDate] = useState<string>(
    itemToEdit?.electricityDate || itemToEdit?.lastPaymentDate || '2026-10-10'
  );

  const [parkingRent, setParkingRent] = useState<string | number>(
    itemToEdit?.parkingRent !== undefined ? itemToEdit.parkingRent : 0
  );
  const [overallPaymentStatusChoice, setOverallPaymentStatusChoice] = useState<PaymentStatus | 'Auto'>(
    itemToEdit?.paymentStatus || 'Auto'
  );
  const [notes, setNotes] = useState<string>(itemToEdit?.notes || '');

  // When itemToEdit changes or modal opens
  useEffect(() => {
    if (itemToEdit) {
      setFlatId(itemToEdit.flatId);
      setBlockName(itemToEdit.blockName);
      setMonth(itemToEdit.month);
      setYear(itemToEdit.year);
      setTenantName(itemToEdit.tenantName);
      setTenantPhone(itemToEdit.tenantPhone);
      setEntryDate(itemToEdit.entryDate);
      setAdvancePayment(itemToEdit.advancePayment !== undefined ? itemToEdit.advancePayment : 0);
      setAdvanceStatus(itemToEdit.advanceStatus || (itemToEdit.advancePayment > 0 ? 'Paid' : 'Not Paid'));
      setAdvanceDate(itemToEdit.advanceDate || itemToEdit.entryDate || '2026-01-01');
      setFlatRent(itemToEdit.flatRent !== undefined ? itemToEdit.flatRent : 0);
      setRentStatus(
        itemToEdit.rentStatus ||
          (itemToEdit.paymentStatus === 'Paid'
            ? 'Paid'
            : itemToEdit.paymentStatus === 'Partially Paid'
            ? 'Partially Paid'
            : itemToEdit.paymentStatus === 'Adjusted'
            ? 'Adjusted'
            : itemToEdit.paymentStatus === 'N/A'
            ? 'N/A'
            : 'Not Paid')
      );
      setRentPaymentDate(itemToEdit.rentPaymentDate || itemToEdit.lastPaymentDate || '2026-10-05');
      setElectricityBill(itemToEdit.electricityBill !== undefined ? itemToEdit.electricityBill : 0);
      setElectricityStatus(
        itemToEdit.electricityStatus ||
          (itemToEdit.electricityBill > 0
            ? itemToEdit.paymentStatus === 'Paid'
              ? 'Paid'
              : 'Not Paid'
            : 'N/A')
      );
      setElectricityDate(itemToEdit.electricityDate || itemToEdit.lastPaymentDate || '2026-10-10');
      setParkingRent(itemToEdit.parkingRent !== undefined ? itemToEdit.parkingRent : 0);
      setOverallPaymentStatusChoice(itemToEdit.paymentStatus || 'Auto');
      setNotes(itemToEdit.notes || '');
    } else {
      // Default to first available unit
      const defaultUnit = availableUnits[0];
      if (defaultUnit) {
        populateFromUnit(defaultUnit.flatId);
      }
      setOverallPaymentStatusChoice('Auto');
    }
  }, [itemToEdit, isOpen]);

  const populateFromUnit = (selectedFlat: string) => {
    setFlatId(selectedFlat);
    const unit = data.units.find((u) => u.flatId === selectedFlat);
    const tenant = data.tenants.find((t) => t.flatId === selectedFlat);
    const advance = data.advanceAccounts.find((a) => a.flatId === selectedFlat);

    if (unit) {
      setBlockName(unit.blockName);
      setFlatRent(unit.monthlyRent || 25000);
      setParkingRent(unit.parkingSlot ? 2000 : 0);
    }
    if (tenant) {
      setTenantName(tenant.fullName);
      setTenantPhone(tenant.phone);
      setEntryDate(tenant.entryDate || '2026-01-01');
    }
    if (advance) {
      setAdvancePayment(advance.amountPaid || 50000);
      setAdvanceStatus(advance.amountPaid >= advance.totalRequired ? 'Paid' : 'Partially Paid');
    }
  };

  if (!isOpen) return null;

  // Real-time calculated amounts supporting N/A correctly
  const rentNum = Number(flatRent || 0);
  const elecNum = Number(electricityBill || 0);
  const parkingNum = Number(parkingRent || 0);

  const effectiveRentPayable = rentStatus === 'N/A' ? 0 : rentNum;
  const effectiveElecPayable = electricityStatus === 'N/A' ? 0 : elecNum;
  const effectiveParkingPayable = parkingNum;

  const computedTotalPayable = effectiveRentPayable + effectiveElecPayable + effectiveParkingPayable;

  let rentPaidVal = 0;
  if (rentStatus === 'Paid') rentPaidVal = rentNum;
  else if (rentStatus === 'Partially Paid') rentPaidVal = Math.round(rentNum / 2);
  else if (rentStatus === 'Adjusted') rentPaidVal = rentNum;
  else if (rentStatus === 'N/A') rentPaidVal = 0;

  let elecPaidVal = 0;
  if (electricityStatus === 'Paid') elecPaidVal = elecNum;
  else if (electricityStatus === 'N/A') elecPaidVal = 0;

  const parkingPaidVal = rentStatus === 'Paid' ? parkingNum : 0;

  const computedTotalPaid = rentPaidVal + elecPaidVal + parkingPaidVal;
  const computedTotalDue = Math.max(0, computedTotalPayable - computedTotalPaid);

  let calculatedOverallStatus: PaymentStatus = 'Not Paid';
  if (rentStatus === 'N/A' && electricityStatus === 'N/A' && effectiveParkingPayable === 0) {
    calculatedOverallStatus = 'N/A';
  } else if (computedTotalDue === 0 && computedTotalPayable > 0) {
    calculatedOverallStatus = 'Paid';
  } else if (computedTotalPaid > 0) {
    calculatedOverallStatus = 'Partially Paid';
  } else if (computedTotalPayable === 0) {
    calculatedOverallStatus = 'N/A';
  }

  const overallPaymentStatus: PaymentStatus =
    overallPaymentStatusChoice === 'Auto' ? calculatedOverallStatus : overallPaymentStatusChoice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const unit = data.units.find((u) => u.flatId === flatId);
    const tenant = data.tenants.find((t) => t.flatId === flatId);

    const cleanId = flatId.replace(/^u-/, '').trim();
    const blockKey =
      unit?.blockName === 'Block A'
        ? 'blockA'
        : unit?.blockName === 'Block B'
        ? 'blockB'
        : unit?.blockName === 'Block C'
        ? 'blockC'
        : cleanId.startsWith('A')
        ? 'blockA'
        : cleanId.startsWith('B')
        ? 'blockB'
        : cleanId.startsWith('C')
        ? 'blockC'
        : 'blockA';

    const savedItem: MonthlyLedgerItem = {
      id: itemToEdit?.id || `ledger-${flatId}-${month}-${year}`,
      unitId: unit?.id || `u-${flatId}`,
      flatId,
      blockName,
      blockKey,
      tenantId: tenant?.id || `t-${flatId}`,
      tenantName: tenantName.trim() || 'Resident',
      tenantPhone: tenantPhone.trim() || '01700-000000',
      entryDate,
      billingPeriod: formatBillingPeriod(month, year),
      month,
      year,
      advancePayment: Number(advancePayment || 0),
      advanceStatus,
      advanceDate,
      flatRent: Number(flatRent || 0),
      rentStatus,
      rentPaymentDate: rentStatus === 'Paid' ? rentPaymentDate : undefined,
      electricityBill: Number(electricityBill || 0),
      electricityStatus,
      electricityDate: electricityStatus === 'Paid' ? electricityDate : undefined,
      parkingRent: Number(parkingRent || 0),
      godownRent: 0,
      totalPayable: computedTotalPayable,
      totalPaid: computedTotalPaid,
      totalDue: computedTotalDue,
      paymentStatus: overallPaymentStatus,
      adjustedFromAdvance: itemToEdit?.adjustedFromAdvance || 0,
      lastPaymentDate: rentStatus === 'Paid' ? rentPaymentDate : itemToEdit?.lastPaymentDate,
      notes: notes.trim(),
    };

    onSave(savedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <FileEdit className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base">
                {itemToEdit ? `Edit Ledger Entry: Flat ${itemToEdit.flatId}` : 'Add / Update Ledger Data Manually'}
              </h3>
              <p className="text-xs text-slate-400">
                Direct manual input for Flat Rent, Advance Deposit, Electricity Bill, and Statuses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Row 1: Unit & Period Selection */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-blue-600" /> Flat Identification *
              </label>
              <select
                value={flatId}
                onChange={(e) => populateFromUnit(e.target.value)}
                disabled={!!itemToEdit}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.flatId}>
                    Flat {u.flatId} ({u.blockName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Month *
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                disabled={!!itemToEdit}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Year *</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={!!itemToEdit}
                min={2020}
                max={2035}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Row 2: Tenant Profile Data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Tenant Full Name
              </label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile Number
              </label>
              <input
                type="text"
                required
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="017XX-XXXXXX"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section: Advance Payment */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Wallet className="w-4 h-4 text-indigo-600" /> 1. Advance Payment / Deposit
              </span>
              <span className="text-[11px] text-indigo-700">Security Advance Deposit Record</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Advance Amount (BDT)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={advancePayment}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setAdvancePayment(val);
                    }
                  }}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Status</label>
                <select
                  value={advanceStatus}
                  onChange={(e) => setAdvanceStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="Paid">Paid (Held in Escrow)</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="Adjusted">Adjusted</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date of Payment</label>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section: Flat Rent */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Building className="w-4 h-4 text-blue-600" /> 2. Monthly Flat Rent
              </span>
              <span className="text-[11px] text-blue-700">Contract Base Rent</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Flat Rent Amount (BDT)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={flatRent}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setFlatRent(val);
                    }
                  }}
                  placeholder="e.g. 25000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rent Payment Status</label>
                <select
                  value={rentStatus}
                  onChange={(e) => setRentStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Paid">Not Paid (Due)</option>
                  <option value="Adjusted">Adjusted</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={rentPaymentDate}
                  onChange={(e) => setRentPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section: Electricity Bill */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-4 h-4 text-amber-600" /> 3. Electricity Bill
              </span>
              <span className="text-[11px] text-amber-700">NESCO Sub-Meter / Manual Bill</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                  <span>Electricity Bill (BDT)</span>
                  <span className="text-[10px] text-amber-700 font-normal">Any number / ৳</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={electricityBill}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Accept any digit or number (allows 125, 0, or any number without step constraints)
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setElectricityBill(val);
                    }
                  }}
                  placeholder="e.g. 125"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Electricity Status</label>
                <select
                  value={electricityStatus}
                  onChange={(e) => setElectricityStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="Paid">Paid</option>
                  <option value="Not Paid">Not Paid (Due)</option>
                  <option value="N/A">N/A (Not Applicable)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={electricityDate}
                  onChange={(e) => setElectricityDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section: Parking Rent, Payment Status & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-slate-500" /> Parking Rent (BDT)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={parkingRent}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setParkingRent(val);
                  }
                }}
                placeholder="e.g. 2000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Payment Status</span>
                <span className="text-[10px] text-slate-400 font-normal">Overall</span>
              </label>
              <select
                value={overallPaymentStatusChoice}
                onChange={(e) => setOverallPaymentStatusChoice(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Auto">Auto ({calculatedOverallStatus})</option>
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Not Paid">Not Paid (Due)</option>
                <option value="Adjusted">Adjusted</option>
                <option value="N/A">N/A (Not Applicable)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Notes / Remarks</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid via bKash TrxID #8234827"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Real-time Financial Breakdown Preview */}
          <div className="p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Total Payable</span>
              <span className="font-bold text-white text-sm">{formatBDT(computedTotalPayable)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-sans block">Total Collected / Paid</span>
              <span className="font-bold text-emerald-400 text-sm">{formatBDT(computedTotalPaid)}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-400 uppercase font-sans block">Total Due</span>
              <span className="font-bold text-rose-400 text-sm">{formatBDT(computedTotalDue)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Overall Status</span>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-sans ${
                  overallPaymentStatus === 'Paid'
                    ? 'bg-emerald-500 text-white'
                    : overallPaymentStatus === 'Partially Paid'
                    ? 'bg-amber-500 text-white'
                    : overallPaymentStatus === 'Adjusted'
                    ? 'bg-purple-500 text-white'
                    : overallPaymentStatus === 'N/A'
                    ? 'bg-slate-600 text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {overallPaymentStatus}
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{itemToEdit ? 'Update Ledger Record' : 'Save Ledger Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
