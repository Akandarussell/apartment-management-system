import React, { useState } from 'react';
import {
  Search,
  Filter,
  Printer,
  Download,
  FileSpreadsheet,
  PlusCircle,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Calendar,
  X,
  Building,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  SlidersHorizontal,
  Layers,
  Car,
  Warehouse,
  TrendingUp,
  Percent,
  Edit3,
  Copy,
} from 'lucide-react';
import {
  AppDatabaseState,
  MonthlyLedgerItem,
  PaymentMethod,
  PaymentStatus,
  PrintableReceipt,
  UserProfile,
} from '../types';
import { formatBDT, formatDateDDMMYYYY, getMonthName, MONTH_NAMES } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { formatBillingPeriod, upsertBatchRemoteMonthlyRentRecords } from '../lib/api';
import { getSupabaseCredentials } from '../lib/supabase';
import { ManualLedgerEntryModal } from './ManualLedgerEntryModal';
import { ExcelImportModal } from './ExcelImportModal';

interface Props {
  data: AppDatabaseState;
  onRecordPayment: (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    category: 'Combined' | 'Flat Rent' | 'Electricity' | 'Parking' | 'Godown',
    transactionId?: string,
    notes?: string
  ) => void;
  onAdjustFromAdvance: (flatId: string, amount: number, notes?: string) => { success: boolean; message: string };
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onUpdateMonthYear: (month: number, year: number) => void;
  onSaveLedgerItem?: (item: MonthlyLedgerItem) => void;
  onCopyPreviousMonthLedger?: (targetMonth: number, targetYear: number, sourceMonth?: number, sourceYear?: number) => void;
  onImportLedgerData?: (
    items: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => void;
  userRole: string;
  assignedBlock?: string;
  currentUser?: UserProfile;
}

export const MainLedger: React.FC<Props> = ({
  data,
  onRecordPayment,
  onAdjustFromAdvance,
  onViewReceipt,
  onUpdateMonthYear,
  onSaveLedgerItem,
  onCopyPreviousMonthLedger,
  onImportLedgerData,
  userRole,
  assignedBlock,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [blockFilter, setBlockFilter] = useState<string>(
    userRole === 'owner' && assignedBlock ? assignedBlock : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlyDuesFilter, setOnlyDuesFilter] = useState<boolean>(false);
  const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | 'parking' | 'godown'>('all');
  const [sortBy, setSortBy] = useState<'flat' | 'payable' | 'paid' | 'due' | 'name'>('flat');

  // Month & Year Filter
  const [filterMonth, setFilterMonth] = useState<number>(data.selectedMonth);
  const [filterYear, setFilterYear] = useState<number>(data.selectedYear);

  // Manual Entry / Edit Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [itemToEditManual, setItemToEditManual] = useState<MonthlyLedgerItem | null>(null);

  // Copy from Previous Month Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // Excel / Google Sheet Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Keep filterMonth & filterYear in sync with data.selectedMonth & data.selectedYear
  React.useEffect(() => {
    setFilterMonth(data.selectedMonth);
    setFilterYear(data.selectedYear);
  }, [data.selectedMonth, data.selectedYear]);

  const prevMonthNum = filterMonth === 1 ? 12 : filterMonth - 1;
  const prevYearNum = filterMonth === 1 ? filterYear - 1 : filterYear;
  const prevMonthName = getMonthName(prevMonthNum);
  const currentMonthName = getMonthName(filterMonth);

  const handleConfirmCopyPreviousMonth = () => {
    if (onCopyPreviousMonthLedger) {
      onCopyPreviousMonthLedger(filterMonth, filterYear, prevMonthNum, prevYearNum);
      setIsCopyModalOpen(false);
      setCopySuccessMsg(`Successfully copied ledger baseline from ${prevMonthName} ${prevYearNum}. Electricity and Parking data are reset to empty for manual input.`);
      setTimeout(() => setCopySuccessMsg(null), 5000);
    }
  };

  // Signature Metadata: Owners get Owner's sign, Manager and Tenant get Manager's sign
  const getSignatureMeta = () => {
    if (userRole === 'owner') {
      return {
        authorizedSignatureRole: 'owner' as const,
        signatureTitle: "Owner's Signature",
        authorizedSignatureBy: currentUser?.fullName
          ? `${currentUser.fullName} (Owner)`
          : assignedBlock
          ? `Block Owner (${assignedBlock})`
          : 'Building Owner',
      };
    }
    // manager and tenant accounts
    return {
      authorizedSignatureRole: 'manager' as const,
      signatureTitle: "Russell (Manager)",
      authorizedSignatureBy: 'Russell',
    };
  };

  // Receipt Generators for Payment Types
  const handleGenerateAdvanceReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
    onViewReceipt({
      receiptNumber: `REC-ADV-${item.flatId}-${data.selectedYear}`,
      type: 'advance',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: item.blockName,
      amount: item.advancePayment,
      paymentDate: item.advanceDate || item.entryDate || '2026-10-01',
      paymentMethod: 'Cash',
      purpose: `Security Advance Deposit - Flat ${item.flatId} (${item.blockName})`,
      remainingAdvance: item.advancePayment,
      ...sig,
      breakdown: [
        { label: 'Security Advance Deposit', amount: item.advancePayment },
      ],
    });
  };

  const handleGenerateRentReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
    onViewReceipt({
      receiptNumber: `REC-RENT-${item.flatId}-${data.selectedMonth}-${data.selectedYear}`,
      type: item.paymentStatus === 'Adjusted' ? 'adjustment' : 'rent',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: item.blockName,
      amount: item.flatRent,
      paymentDate: item.rentPaymentDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: item.paymentStatus === 'Adjusted' ? 'Advance Adjustment' : 'Cash',
      purpose: `Monthly Flat Rent for ${getMonthName(data.selectedMonth)} ${data.selectedYear} - Flat ${item.flatId}`,
      remainingDue: item.totalDue,
      remainingAdvance: item.advancePayment,
      ...sig,
      breakdown: [
        { label: `Flat Rent (${getMonthName(data.selectedMonth)} ${data.selectedYear})`, amount: item.flatRent },
        ...(item.parkingRent > 0 ? [{ label: 'Parking Rent', amount: item.parkingRent }] : []),
      ],
    });
  };

  const handleGenerateElectricityReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
    onViewReceipt({
      receiptNumber: `REC-ELEC-${item.flatId}-${data.selectedMonth}-${data.selectedYear}`,
      type: 'electricity',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: item.blockName,
      amount: item.electricityBill,
      paymentDate: item.electricityDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: 'Cash',
      purpose: `NESCO Sub-Meter Electricity Bill for ${getMonthName(data.selectedMonth)} ${data.selectedYear} - Flat ${item.flatId}`,
      ...sig,
      breakdown: [
        { label: `Electricity Consumption (${getMonthName(data.selectedMonth)} ${data.selectedYear})`, amount: item.electricityBill },
      ],
    });
  };

  // Modals
  const [paymentModalItem, setPaymentModalItem] = useState<MonthlyLedgerItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('bKash');
  const [payTxnId, setPayTxnId] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const [adjustModalItem, setAdjustModalItem] = useState<MonthlyLedgerItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  // Handle Month / Year apply
  const handleApplyMonthYear = (month: number = filterMonth, year: number = filterYear) => {
    onUpdateMonthYear(month, year);
  };

  const handlePrevMonth = () => {
    let newM = filterMonth - 1;
    let newY = filterYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setFilterMonth(newM);
    setFilterYear(newY);
    handleApplyMonthYear(newM, newY);
  };

  const handleNextMonth = () => {
    let newM = filterMonth + 1;
    let newY = filterYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setFilterMonth(newM);
    setFilterYear(newY);
    handleApplyMonthYear(newM, newY);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    if (userRole !== 'owner') {
      setBlockFilter('all');
    }
    setStatusFilter('all');
    setOnlyDuesFilter(false);
    setUnitTypeFilter('all');
    setSortBy('flat');
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    (userRole !== 'owner' && blockFilter !== 'all') ||
    statusFilter !== 'all' ||
    onlyDuesFilter ||
    unitTypeFilter !== 'all' ||
    sortBy !== 'flat';

  // Filter ledger for active month & year
  const activeMonthLedger = data.ledgerItems.filter(
    (item) => item.month === data.selectedMonth && item.year === data.selectedYear
  );

  // Scoped ledger for current role (if block owner)
  const scopedLedger = activeMonthLedger.filter((item) => {
    if (userRole === 'owner' && assignedBlock && item.blockName !== assignedBlock) {
      return false;
    }
    return true;
  });

  // Calculate live counts for quick status tabs
  const countAll = scopedLedger.length;
  const countPaid = scopedLedger.filter((i) => i.paymentStatus === 'Paid').length;
  const countPartial = scopedLedger.filter((i) => i.paymentStatus === 'Partially Paid').length;
  const countDue = scopedLedger.filter((i) => i.paymentStatus === 'Not Paid' || i.totalDue > 0).length;
  const countAdjusted = scopedLedger.filter((i) => i.paymentStatus === 'Adjusted').length;
  const countNA = scopedLedger.filter((i) => i.paymentStatus === 'N/A').length;

  // Supabase Save / Sync status
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncStatusMsg(null);
    const billingPeriod = formatBillingPeriod(filterMonth, filterYear);
    console.log(`[Manual Supabase Save Operation] Re-running save for ${activeMonthLedger.length} units in ${billingPeriod}...`);
    try {
      const { isConfigured } = getSupabaseCredentials();
      if (!isConfigured) {
        const infoMsg = `Supabase PostgreSQL is not connected yet. All financial records are securely saved on the local server database. Click 'Database Setup' in the header to connect your Supabase PostgreSQL project.`;
        console.info(`[Manual Supabase Save Operation] ${infoMsg}`);
        setSyncStatusMsg({ type: 'info', text: infoMsg });
        return;
      }

      if (activeMonthLedger.length === 0) {
        const infoMsg = `No ledger records found for period ${billingPeriod} to save.`;
        console.warn(`[Manual Supabase Save Operation] ${infoMsg}`);
        setSyncStatusMsg({ type: 'info', text: infoMsg });
        return;
      }

      const res = await upsertBatchRemoteMonthlyRentRecords(activeMonthLedger);
      if (res.success) {
        const msg = `Successfully saved ${res.count} unit records to Supabase for ${billingPeriod} with explicit block_key!`;
        console.log(`[Manual Supabase Save Operation Success] ${msg}`);
        setSyncStatusMsg({ type: 'success', text: msg });
      } else {
        const errObj = res.error;
        const errText =
          (errObj && typeof errObj === 'object' && errObj.message) ||
          (typeof errObj === 'string' ? errObj : JSON.stringify(errObj)) ||
          'Save operation encountered an issue';
        console.error(`[Manual Supabase Save Operation Error] Save failed:`, errText);
        setSyncStatusMsg({ type: 'error', text: `Supabase save error: ${errText}` });
      }
    } catch (err: any) {
      console.error(`[Manual Supabase Save Operation Exception]:`, err);
      setSyncStatusMsg({ type: 'error', text: `Exception: ${err?.message || err}` });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncStatusMsg(null), 8000);
    }
  };

  const filteredItems = scopedLedger
    .filter((item) => {
      if (blockFilter !== 'all' && item.blockName !== blockFilter) {
        return false;
      }
      if (statusFilter !== 'all' && item.paymentStatus !== statusFilter) {
        return false;
      }
      if (onlyDuesFilter && item.totalDue <= 0) {
        return false;
      }
      if (unitTypeFilter === 'parking' && item.parkingRent <= 0) {
        return false;
      }
      if (unitTypeFilter === 'godown' && item.godownRent <= 0) {
        return false;
      }
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (
        item.flatId.toLowerCase().includes(search) ||
        item.tenantName.toLowerCase().includes(search) ||
        item.tenantPhone.toLowerCase().includes(search) ||
        item.blockName.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'payable') return b.totalPayable - a.totalPayable;
      if (sortBy === 'paid') return b.totalPaid - a.totalPaid;
      if (sortBy === 'due') return b.totalDue - a.totalDue;
      if (sortBy === 'name') return a.tenantName.localeCompare(b.tenantName);
      return a.flatId.localeCompare(b.flatId);
    });

  // Totals for the table footer & ribbon
  const totalPayable = filteredItems.reduce((acc, curr) => acc + curr.totalPayable, 0);
  const totalPaid = filteredItems.reduce((acc, curr) => acc + curr.totalPaid, 0);
  const totalDue = filteredItems.reduce((acc, curr) => acc + curr.totalDue, 0);
  const totalAdvance = filteredItems.reduce((acc, curr) => acc + curr.advancePayment, 0);
  const collectionPercentage = totalPayable > 0 ? Math.round((totalPaid / totalPayable) * 100) : 0;

  // Open Payment Modal
  const openPaymentModal = (item: MonthlyLedgerItem) => {
    setPaymentModalItem(item);
    setPayAmount(item.totalDue > 0 ? item.totalDue : item.totalPayable);
    setPayMethod('bKash');
    setPayTxnId('');
    setPayNotes('');
  };

  const handleConfirmPayment = () => {
    if (!paymentModalItem || payAmount <= 0) return;
    onRecordPayment(paymentModalItem.flatId, payAmount, payMethod, 'Combined', payTxnId, payNotes);
    setPaymentModalItem(null);
  };

  // Open Adjust from Advance Modal
  const openAdjustModal = (item: MonthlyLedgerItem) => {
    setAdjustModalItem(item);
    setAdjustAmount(Math.min(item.totalDue, item.advancePayment));
    setAdjustNotes('Adjusted rent from advance deposit');
    setAdjustError('');
  };

  const handleConfirmAdjustment = () => {
    if (!adjustModalItem || adjustAmount <= 0) return;
    const result = onAdjustFromAdvance(adjustModalItem.flatId, adjustAmount, adjustNotes);
    if (!result.success) {
      setAdjustError(result.message);
      return;
    }
    setAdjustModalItem(null);
  };

  // Export to CSV (Aligned with 8 ledger columns)
  const handleExportCSV = () => {
    const headers = [
      'Flat ID',
      'Tenant Name',
      'Mobile Number',
      'Entry Date',
      'Advance Payment',
      'Flat Rent',
      'Electricity Bill',
      'Parking Rent',
    ];
    const rows = filteredItems.map((item) => [
      `"${item.flatId}"`,
      `"${item.tenantName}"`,
      `"${item.tenantPhone}"`,
      `"${item.entryDate}"`,
      item.advancePayment,
      item.flatRent,
      item.electricityBill,
      item.parkingRent,
    ]);

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `MBD_Apartment_Ledger_${getMonthName(data.selectedMonth)}_${data.selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel-compatible HTML format
  const handleExportExcel = () => {
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"/></head><body>
    <h2>${COMPLEX_CONFIG.name.toUpperCase()} - MAIN FINANCIAL LEDGER</h2>
    <p>${COMPLEX_CONFIG.address} | Contact: ${COMPLEX_CONFIG.contacts}</p>
    <p>Period: ${getMonthName(data.selectedMonth)} ${data.selectedYear}</p>
    <table border="1">
      <thead>
        <tr style="background:#0f172a; color:#ffffff;">
          <th>Flat ID</th><th>Tenant Name</th><th>Mobile</th><th>Entry Date</th>
          <th>Advance</th><th>Flat Rent</th><th>Electricity</th><th>Parking</th>
        </tr>
      </thead>
      <tbody>`;

    filteredItems.forEach((row) => {
      tableHtml += `<tr>
        <td>${row.flatId}</td><td>${row.tenantName}</td><td>${row.tenantPhone}</td><td>${row.entryDate}</td>
        <td>${row.advancePayment}</td><td>${row.flatRent}</td><td>${row.electricityBill}</td><td>${row.parkingRent}</td>
      </tr>`;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MBD_Apartment_Ledger_${getMonthName(data.selectedMonth)}_${data.selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {COMPLEX_CONFIG.name} - Financial Ledger
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Monthly Financial Ledger
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {COMPLEX_CONFIG.address}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong> &bull; Period: <span className="font-bold text-blue-700">{getMonthName(data.selectedMonth)} {data.selectedYear}</span> <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold ml-1">Period: {formatBillingPeriod(data.selectedMonth, data.selectedYear)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Month Navigation */}
          <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <Calendar className="w-4 h-4 text-slate-500 mx-0.5" />
            <select
              value={filterMonth}
              onChange={(e) => {
                const newM = Number(e.target.value);
                setFilterMonth(newM);
                handleApplyMonthYear(newM, filterYear);
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => {
                const newY = Number(e.target.value);
                setFilterYear(newY);
                handleApplyMonthYear(filterMonth, newY);
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {Array.from({ length: 77 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Upload & Extract from Excel / Google Sheet Button */}
          {onImportLedgerData && (userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="Upload & extract data from Excel or Google Sheet to automatically fill up fields"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📥 Upload Excel / Google Sheet</span>
            </button>
          )}

          {/* Copy Data from Previous Month Button */}
          {onCopyPreviousMonthLedger && (userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title={`Copy baseline tenant data from ${prevMonthName} ${prevYearNum} with Electricity & Parking empty for manual input`}
            >
              <Copy className="w-4 h-4" />
              <span>📋 Copy from Prev Month ({prevMonthName})</span>
            </button>
          )}

          {/* Manual Entry Button for Owners and Managers */}
          {(userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={() => {
                setItemToEditManual(null);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="Add or update ledger data manually"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add / Edit Ledger Data Manually</span>
            </button>
          )}

          {/* Sync / Save to Supabase Button */}
          {(userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={handleSyncToSupabase}
              disabled={isSyncingSupabase}
              className={`flex items-center gap-1.5 px-3.5 py-2 ${
                isSyncingSupabase
                  ? 'bg-slate-500 cursor-not-allowed text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
              } text-xs font-bold rounded-xl transition-all shadow-xs`}
              title="Re-run save operation to Supabase monthly_rent_records with explicit block_key"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingSupabase ? 'Saving to Supabase...' : '💾 Sync to Supabase'}</span>
            </button>
          )}

          {/* Export & Print */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Print official A4 ledger report"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print A4</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Export data to CSV format"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Download formatted Excel (.xls) spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Save / Sync Result Alert Banner */}
      {syncStatusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            syncStatusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : syncStatusMsg.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatusMsg.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button
            onClick={() => setSyncStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Copy Previous Month Success Alert */}
      {copySuccessMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{copySuccessMsg}</span>
          </div>
          <button onClick={() => setCopySuccessMsg(null)} className="text-indigo-400 hover:text-indigo-600 text-base cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Excel / Google Sheet Import Success Alert */}
      {importSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600 text-base cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Empty Billing Period Alert Banner with 1-Click Clone Option */}
      {activeMonthLedger.length === 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900">
                  Billing Period {formatBillingPeriod(data.selectedMonth, data.selectedYear)} ({getMonthName(data.selectedMonth)} {data.selectedYear}) has no records in Supabase yet.
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                  Empty Billing Period
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Each month maintains its own independent record in <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-800">monthly_rent_records</code> matching on <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-800">(unit_id, billing_period)</code>. You can copy the tenant roster from <strong className="text-slate-800">{prevMonthName} {prevYearNum}</strong> with reset payment statuses.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onCopyPreviousMonthLedger && (userRole === 'manager' || userRole === 'owner') && (
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                title={`Clone roster from ${prevMonthName} ${prevYearNum} into ${formatBillingPeriod(data.selectedMonth, data.selectedYear)}`}
              >
                <Copy className="w-4 h-4" />
                <span>Clone Roster from {prevMonthName}</span>
              </button>
            )}
            {(userRole === 'manager' || userRole === 'owner') && (
              <button
                onClick={() => {
                  setItemToEditManual(null);
                  setIsManualModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-all cursor-pointer shadow-xs"
              >
                + Add Manually
              </button>
            )}
          </div>
        </div>
      )}

      {/* COMPREHENSIVE DATA FILTERING BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Bar Header & Quick Status Pills */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
              Data Filtering Bar
            </span>
          </div>

          {/* Quick Status Tabs with Live Count Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>All Units</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countAll}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              <span>Paid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPaid}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Partially Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Partially Paid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <span>Partial</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPartial}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Not Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Not Paid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-800 text-rose-300 hover:bg-slate-700'
              }`}
            >
              <span>Due / Unpaid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countDue}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Adjusted')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Adjusted'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
              }`}
            >
              <span>Advance Adjusted</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countAdjusted}</span>
            </button>
          </div>
        </div>

        {/* Detailed Filter Inputs Row */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input with Clear Button */}
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Flat ID, Tenant, Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Block Filter (Scoped for Admin, or visible if manager) */}
            {userRole !== 'owner' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> Block:
                </span>
                <select
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="all">All Blocks (A, B, C)</option>
                  <option value="Block A">Block A (Rashed)</option>
                  <option value="Block B">Block B (Raju)</option>
                  <option value="Block C">Block C (Rony)</option>
                </select>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-200 text-xs font-bold text-blue-800">
                {assignedBlock} Filter Active
              </div>
            )}

            {/* Unit Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Units:
              </span>
              <select
                value={unitTypeFilter}
                onChange={(e) => setUnitTypeFilter(e.target.value as any)}
                className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">All Units</option>
                <option value="parking">With Parking Rent</option>
                <option value="godown">With Godown Rent</option>
              </select>
            </div>

            {/* Quick Toggle: Show Dues Only */}
            <button
              onClick={() => setOnlyDuesFilter(!onlyDuesFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                onlyDuesFilter
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${onlyDuesFilter ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Pending Dues Only</span>
              {countDue > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  onlyDuesFilter ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {countDue}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="flat">Flat ID (Ascending)</option>
                <option value="due">Highest Total Due</option>
                <option value="payable">Highest Total Payable</option>
                <option value="paid">Highest Total Paid</option>
                <option value="name">Tenant Name (A-Z)</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Clear all search and filter conditions"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Ribbon & Filter Status Bar */}
        <div className="px-5 py-3 bg-white flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Showing:</span>
            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md font-bold">
              {filteredItems.length} of {scopedLedger.length} Units
            </span>
            {isAnyFilterActive && (
              <span className="text-[11px] text-amber-700 font-medium">
                (Filtered view active)
              </span>
            )}
          </div>

          {/* Quick Financial Summary of Filtered View */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Payable</span>
              <span className="font-bold text-slate-900">{formatBDT(totalPayable)}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-600 font-sans block uppercase font-bold">Collected</span>
              <span className="font-bold text-emerald-600">{formatBDT(totalPaid)}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-500 font-sans block uppercase font-bold">Outstanding Due</span>
              <span className={`font-bold ${totalDue > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {formatBDT(totalDue)}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 font-sans">
              <span className="text-[11px] font-bold text-slate-600">{collectionPercentage}% Collected</span>
              <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, collectionPercentage)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Financial Ledger Table (8 Columns - Godown, Total Payable, Total Paid, Total Due, Status, and Actions removed) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Printable Sheet Header (Visible Only When Printing) */}
        <div className="hidden print:block p-6 text-center border-b-2 border-slate-900 mb-4 bg-white">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{COMPLEX_CONFIG.name.toUpperCase()}</h1>
          <p className="text-xs text-slate-700 font-medium mt-1">{COMPLEX_CONFIG.address}</p>
          <p className="text-xs text-slate-600 mt-0.5">Hotline Contacts: <strong>{COMPLEX_CONFIG.contacts}</strong></p>
          <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs text-slate-900">
            Official Monthly Financial Ledger &bull; {getMonthName(data.selectedMonth)} {data.selectedYear}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold">
              <tr>
                <th className="py-3.5 px-3.5 whitespace-nowrap">1. Flat ID</th>
                <th className="py-3.5 px-3 whitespace-nowrap">2. Tenant Name</th>
                <th className="py-3.5 px-3 whitespace-nowrap">3. Mobile</th>
                <th className="py-3.5 px-3 whitespace-nowrap">4. Entry Date</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">5. Advance</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">6. Flat Rent</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">7. Electricity</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">8. Parking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans text-sm">
                    {activeMonthLedger.length === 0 ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-base">
                          No records for {getMonthName(data.selectedMonth)} {data.selectedYear} ({formatBillingPeriod(data.selectedMonth, data.selectedYear)})
                        </p>
                        <p className="text-xs text-slate-500">
                          This billing period is currently empty. You can clone the tenant roster from the previous month with reset payment statuses, or upload an Excel sheet.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          {onCopyPreviousMonthLedger && (userRole === 'manager' || userRole === 'owner') && (
                            <button
                              onClick={() => setIsCopyModalOpen(true)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy from Prev Month ({prevMonthName})</span>
                            </button>
                          )}
                          {onImportLedgerData && (userRole === 'manager' || userRole === 'owner') && (
                            <button
                              onClick={() => setIsImportModalOpen(true)}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Upload Excel / Sheet</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      'No ledger entries found matching your search and filter criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const advStatus = item.advanceStatus || (item.advancePayment > 0 ? 'Paid' : 'Not Paid');
                  const rentStatus =
                    item.rentStatus ||
                    (item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted'
                      ? 'Paid'
                      : item.paymentStatus === 'Partially Paid'
                      ? 'Partially Paid'
                      : item.paymentStatus === 'N/A'
                      ? 'N/A'
                      : 'Not Paid');
                  const elecStatus =
                    item.electricityStatus ||
                    (item.electricityBill === 0
                      ? 'N/A'
                      : item.paymentStatus === 'Paid'
                      ? 'Paid'
                      : 'Not Paid');

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-blue-700 font-sans whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-extrabold">{item.flatId}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {item.blockName}
                            </span>
                          </div>
                          {(userRole === 'manager' || userRole === 'owner') && (
                            <button
                              onClick={() => {
                                setItemToEditManual(item);
                                setIsManualModalOpen(true);
                              }}
                              title="Edit this ledger record manually"
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 font-sans whitespace-nowrap">
                        {item.tenantName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-sans whitespace-nowrap">
                        {item.tenantPhone}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-sans whitespace-nowrap">
                        {formatDateDDMMYYYY(item.entryDate)}
                      </td>

                      {/* 5. Advance Payment Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">
                          {formatBDT(item.advancePayment)}
                        </span>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            advStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : advStatus === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : advStatus === 'Adjusted'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {advStatus}
                        </span>
                        {advStatus === 'Paid' && item.advancePayment > 0 && (
                          <div className="mt-1">
                            <button
                              onClick={() => handleGenerateAdvanceReceipt(item)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Advance Payment Receipt"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Flat Rent Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 block">
                          {formatBDT(item.flatRent)}
                        </span>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            rentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rentStatus === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : rentStatus === 'N/A'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {rentStatus}
                        </span>
                        {rentStatus === 'Paid' && item.flatRent > 0 && (
                          <div className="mt-1">
                            <button
                              onClick={() => handleGenerateRentReceipt(item)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Flat Rent Receipt"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 7. Electricity Bill Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        {(() => {
                          const unit = data.units.find((u) => u.flatId === item.flatId);
                          const isUnitElecOn =
                            (unit?.unitType === 'residential' || unit?.unitType === 'godown') &&
                            (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter')) &&
                            unit?.electricityBillingType !== 'none';

                          if (!isUnitElecOn) {
                            return (
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-medium text-slate-400 block">৳0</span>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  OFF
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">No Bill</span>
                              </div>
                            );
                          }

                          return (
                            <>
                              <span className="font-mono font-bold text-slate-800 block">
                                {item.electricityBill > 0 ? formatBDT(item.electricityBill) : '৳0'}
                              </span>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  elecStatus === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : elecStatus === 'N/A'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {elecStatus}
                              </span>
                              {elecStatus === 'Paid' && item.electricityBill > 0 && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => handleGenerateElectricityReceipt(item)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Generate Official Electricity Bill Receipt"
                                  >
                                    <Receipt className="w-3 h-3" />
                                    <span>Generate Receipt</span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>

                      {/* 8. Parking Rent */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                        {item.parkingRent > 0 ? formatBDT(item.parkingRent) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Summary Footer */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold font-mono">
              <tr>
                <td colSpan={4} className="py-3 px-3 text-slate-900 font-sans text-right">
                  Grand Totals:
                </td>
                <td className="py-3 px-3 text-right text-indigo-700 whitespace-nowrap">
                  {formatBDT(totalAdvance)}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 whitespace-nowrap">
                  {formatBDT(filteredItems.reduce((acc, curr) => acc + curr.flatRent, 0))}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 whitespace-nowrap">
                  {formatBDT(filteredItems.reduce((acc, curr) => acc + curr.electricityBill, 0))}
                </td>
                <td className="py-3 px-3 text-right text-slate-600 whitespace-nowrap">
                  {formatBDT(filteredItems.reduce((acc, curr) => acc + curr.parkingRent, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {paymentModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <PlusCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Record Payment</h3>
                  <p className="text-xs text-slate-500">
                    Flat {paymentModalItem.flatId} &bull; {paymentModalItem.tenantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between font-mono">
                <div>
                  <span className="text-slate-500">Total Payable:</span>
                  <p className="font-bold text-slate-900">{formatBDT(paymentModalItem.totalPayable)}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Current Due:</span>
                  <p className="font-bold text-rose-600">{formatBDT(paymentModalItem.totalDue)}</p>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Payment Amount (BDT / ৳) *
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Payment Method *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Cash">Cash Handover</option>
                  <option value="bKash">bKash MFS</option>
                  <option value="Nagad">Nagad MFS</option>
                  <option value="Rocket">Rocket (DBBL)</option>
                  <option value="Bank Transfer">Bank Deposit / EFT</option>
                </select>
              </div>

              {payMethod !== 'Cash' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Transaction ID / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BK98214AA or IBBL-CHQ-1049"
                    value={payTxnId}
                    onChange={(e) => setPayTxnId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. October monthly rent and postpaid electricity bill"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setPaymentModalItem(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Confirm Payment & Generate Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST FROM ADVANCE MODAL */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Adjust Rent from Advance</h3>
                  <p className="text-xs text-slate-500">
                    Flat {adjustModalItem.flatId} &bull; Security Deposit Deduction
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-purple-700 font-sans">Available Advance Balance:</span>
                  <span className="font-bold text-purple-900">{formatBDT(adjustModalItem.advancePayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Current Month Due:</span>
                  <span className="font-bold text-rose-600">{formatBDT(adjustModalItem.totalDue)}</span>
                </div>
              </div>

              {adjustError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                  {adjustError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Deduction Amount (BDT / ৳) *
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  max={adjustModalItem.advancePayment}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Cannot exceed available security advance balance of {formatBDT(adjustModalItem.advancePayment)}.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason / Departure Notice Notes
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Tenant departure last month rent adjusted from advance"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setAdjustModalItem(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjustment}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Confirm Deduction & Update Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL LEDGER ENTRY & UPDATE MODAL */}
      <ManualLedgerEntryModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setItemToEditManual(null);
        }}
        itemToEdit={itemToEditManual}
        data={data}
        onSave={(savedItem) => {
          if (onSaveLedgerItem) {
            onSaveLedgerItem(savedItem);
          }
        }}
        userRole={userRole}
        assignedBlock={assignedBlock}
      />

      {/* COPY PREVIOUS MONTH CONFIRMATION MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Copy className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Copy Data from Previous Month
                  </h3>
                  <p className="text-xs text-slate-500">
                    From: <strong>{prevMonthName} {prevYearNum}</strong> &rarr; To: <strong>{currentMonthName} {filterYear}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-slate-700">
                Are you sure you want to initialize <strong>{currentMonthName} {filterYear}</strong> ledger by copying baseline tenant data from <strong>{prevMonthName} {prevYearNum}</strong>?
              </p>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Fields Copied from Previous Month:
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    1. Flat ID
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    2. Tenant Name
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    3. Mobile Number
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    4. Entry Date
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    5. Security Advance
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    6. Monthly Flat Rent
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5 text-[11px] text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Fields Reset to Empty for Manual Input:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-700">
                  <li><strong>7. Electricity Bill:</strong> Set to ৳0 / Empty (ready for your sub-meter manual input)</li>
                  <li><strong>8. Parking Rent:</strong> Set to ৳0 / Empty (ready for your manual input)</li>
                  <li><strong>Payment Status:</strong> Initialized to &quot;Not Paid&quot; (৳0 paid) for the new month</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCopyPreviousMonth}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Confirm & Copy Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / GOOGLE SHEET IMPORT MODAL */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        data={data}
        initialMonth={filterMonth}
        initialYear={filterYear}
        assignedBlock={assignedBlock}
        userRole={userRole}
        onImportSuccess={(items, targetM, targetY, options) => {
          if (onImportLedgerData) {
            onImportLedgerData(items, targetM, targetY, options);
            setImportSuccessMsg(
              `Successfully extracted & imported ${items.length} flats into ${getMonthName(targetM)} ${targetY} ledger! Saved to database.`
            );
            setTimeout(() => setImportSuccessMsg(null), 6000);
          }
        }}
      />
    </div>
  );
};
