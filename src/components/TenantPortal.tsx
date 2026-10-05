import React, { useState } from 'react';
import {
  User,
  Building2,
  Calendar,
  Wallet,
  Zap,
  ZapOff,
  Receipt,
  Download,
  Printer,
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Send,
  ArrowRight,
  Copy,
  Check,
  ShieldAlert,
  Phone,
  Lock,
} from 'lucide-react';
import {
  AppDatabaseState,
  UserProfile,
  PrintableReceipt,
  ElectricityBill,
  OnlinePaymentRequest,
  MonthlyLedgerItem,
} from '../types';
import { formatBDT, formatDateDDMMYYYY, getMonthName, getPostpaidElectricityPeriod } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { INITIAL_BLOCK_MFS_CONFIGS } from '../lib/storage';

interface Props {
  currentUser: UserProfile;
  data: AppDatabaseState;
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onViewBill: (bill: ElectricityBill) => void;
  onSubmitOnlinePayment: (
    flatId: string,
    baseAmount: number,
    feeAmount: number,
    totalAmount: number,
    method: 'bKash' | 'Nagad' | 'Rocket',
    transactionId: string,
    category: string,
    recipientNumber?: string,
    recipientOwnerName?: string
  ) => void;
  onNavigateToView: (view: string) => void;
}

export const TenantPortal: React.FC<Props> = ({
  currentUser,
  data,
  onViewReceipt,
  onViewBill,
  onSubmitOnlinePayment,
  onNavigateToView,
}) => {
  const flatId = currentUser.flatId || 'A2';

  // Find tenant details
  const tenant = data.tenants.find((t) => t.flatId === flatId);
  const unit = data.units.find((u) => u.flatId === flatId);
  const advance = data.advanceAccounts.find((a) => a.flatId === flatId);

  // Active month ledger entry
  const currentLedgerItem = data.ledgerItems.find(
    (item) => item.flatId === flatId && item.month === data.selectedMonth && item.year === data.selectedYear
  );

  // Historical records for this flat
  const flatLedgerHistory = data.ledgerItems
    .filter((item) => item.flatId === flatId)
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Electricity bills for this flat
  const isUnitElecOn =
    (unit?.unitType === 'residential' || unit?.unitType === 'godown') &&
    (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter')) &&
    unit?.electricityBillingType !== 'none';

  const flatElectricityBills = data.electricityBills.filter((b) => b.flatId === flatId);

  // Block MFS Gateway Configuration & Availability
  const tenantBlockName: 'Block A' | 'Block B' | 'Block C' =
    unit?.blockName ||
    (flatId.startsWith('B') ? 'Block B' : flatId.startsWith('C') ? 'Block C' : 'Block A');

  const blockMfsConfig =
    data.paymentSettings?.blockConfigs?.[tenantBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS[tenantBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS['Block A'];

  const isMfsActive = blockMfsConfig?.isMfsEnabled ?? true;
  const feeRate = blockMfsConfig?.mfsFeePercentage ?? 1.8;

  // Online Payment Request Form State
  const [payAmount, setPayAmount] = useState<number>(currentLedgerItem?.totalDue || 25000);
  const [payMethod, setPayMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [payTrxId, setPayTrxId] = useState<string>('');
  const [paySuccessMsg, setPaySuccessMsg] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Calculate 1.8% Cashout Fee Addings
  const mfsFeeAmount = Math.round(payAmount * (feeRate / 100));
  const totalMfsAmountToSend = payAmount + mfsFeeAmount;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOnlinePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTrxId.trim() || payAmount <= 0) return;
    const recipientNumber =
      payMethod === 'bKash'
        ? blockMfsConfig.bkashNumber
        : payMethod === 'Nagad'
        ? blockMfsConfig.nagadNumber
        : blockMfsConfig.rocketNumber;

    onSubmitOnlinePayment(
      flatId,
      payAmount,
      mfsFeeAmount,
      totalMfsAmountToSend,
      payMethod,
      payTrxId.trim(),
      `${getMonthName(data.selectedMonth)} ${data.selectedYear} Monthly Rent & Utilities`,
      recipientNumber,
      blockMfsConfig.ownerName
    );
    setPaySuccessMsg(`Payment verification request submitted for ${formatBDT(totalMfsAmountToSend)} (Base: ${formatBDT(payAmount)} + 1.8% cashout fee: ${formatBDT(mfsFeeAmount)}) with TrxID: ${payTrxId}. Management will verify shortly.`);
    setPayTrxId('');
  };

  // Signature Metadata: Per user request, receipts through tenant's account must have Manager's sign
  const tenantSignatureMeta = {
    authorizedSignatureRole: 'manager' as const,
    signatureTitle: "Russell (Manager)",
    authorizedSignatureBy: 'Russell',
  };

  const handleGenerateAdvanceReceipt = (item: MonthlyLedgerItem) => {
    const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId || a.flatId === flatId);
    const resolvedAmount =
      Number(item.advancePayment || 0) > 0
        ? Number(item.advancePayment || 0)
        : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
        ? matchingAdv.amountPaid
        : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
        ? matchingAdv.totalRequired
        : (unit?.monthlyRent ? unit.monthlyRent * 2 : 48000);

    onViewReceipt({
      receiptNumber: `REC-ADV-${flatId}-${item.year || data.selectedYear}`,
      type: 'advance',
      tenantName: tenant?.fullName || currentUser.fullName,
      tenantPhone: tenant?.phone || currentUser.phone || '',
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: resolvedAmount,
      paymentDate: item.advanceDate || matchingAdv?.lastPaymentDate || item.entryDate || '2024-01-01',
      paymentMethod: 'bKash',
      purpose: `Security Advance Deposit - Flat ${flatId} (${unit?.blockName || 'Block A'})`,
      remainingAdvance: resolvedAmount,
      ...tenantSignatureMeta,
      breakdown: [
        { label: 'Security Advance Deposit', amount: resolvedAmount },
      ],
    });
  };

  const handleGenerateRentReceipt = (item: MonthlyLedgerItem) => {
    onViewReceipt({
      receiptNumber: `REC-RENT-${flatId}-${item.month}-${item.year}`,
      type: item.paymentStatus === 'Adjusted' ? 'adjustment' : 'rent',
      tenantName: tenant?.fullName || currentUser.fullName,
      tenantPhone: tenant?.phone || currentUser.phone || '',
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: item.flatRent,
      paymentDate: item.rentPaymentDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: item.paymentStatus === 'Adjusted' ? 'Advance Adjustment' : 'bKash',
      purpose: `Monthly Flat Rent for ${getMonthName(item.month)} ${item.year} - Flat ${flatId}`,
      remainingDue: item.totalDue,
      remainingAdvance: item.advancePayment,
      ...tenantSignatureMeta,
      breakdown: [
        { label: `Flat Rent (${getMonthName(item.month)} ${item.year})`, amount: item.flatRent },
        ...(item.parkingRent > 0 ? [{ label: 'Parking Rent', amount: item.parkingRent }] : []),
      ],
    });
  };

  const handleGenerateElectricityReceipt = (item: MonthlyLedgerItem) => {
    const elecPeriod = getPostpaidElectricityPeriod(item.month, item.year);
    onViewReceipt({
      receiptNumber: `REC-ELEC-${flatId}-${elecPeriod.month}-${elecPeriod.year}`,
      type: 'electricity',
      tenantName: tenant?.fullName || currentUser.fullName,
      tenantPhone: tenant?.phone || currentUser.phone || '',
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: item.electricityBill,
      paymentDate: item.electricityDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: 'bKash',
      monthName: elecPeriod.monthName,
      year: elecPeriod.year,
      purpose: `NESCO Electricity Bill for ${elecPeriod.displayStr} (Postpaid Billing for ${getMonthName(item.month)} ${item.year} Rent) - Flat ${flatId}`,
      ...tenantSignatureMeta,
      breakdown: [
        { label: `Postpaid Electricity Consumption (${elecPeriod.displayStr})`, amount: item.electricityBill },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-semibold text-blue-300 mb-3">
            <Building2 className="w-3.5 h-3.5" />
            Resident of {COMPLEX_CONFIG.name} &bull; {unit?.blockName || 'Block A'} &bull; Flat {flatId}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {tenant?.fullName || currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {COMPLEX_CONFIG.address}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span>Mobile: <strong className="text-white">{tenant?.phone || currentUser.phone}</strong></span>
            <span>&bull;</span>
            <span>Manager Hotline: <strong className="text-blue-300">{COMPLEX_CONFIG.contacts}</strong></span>
            <span>&bull;</span>
            <span>Monthly Rent: <strong className="text-emerald-400 font-mono">{formatBDT(unit?.monthlyRent)}</strong></span>
          </div>
        </div>

        {/* Quick Outstanding Due Pill */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 text-right min-w-[200px]">
          <span className="text-xs text-slate-300 font-medium">Current Month Due</span>
          <div className="text-2xl font-black font-mono mt-1 text-white">
            {formatBDT(currentLedgerItem?.totalDue || 0)}
          </div>
          <span
            className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              currentLedgerItem?.paymentStatus === 'Paid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            Status: {currentLedgerItem?.paymentStatus || 'Not Paid'}
          </span>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Base Rent</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatBDT(unit?.monthlyRent)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Configured unit contract rate</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Advance Held</span>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-2 font-mono">
              {formatBDT(advance?.amountPaid || currentLedgerItem?.advancePayment || 48000)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Deposited in escrow account</p>
          </div>
          {!flatId.toLowerCase().includes('owner') && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const targetItem = currentLedgerItem || flatLedgerHistory[0] || ({
                    id: `adv-${flatId}`,
                    flatId,
                    month: data.selectedMonth,
                    year: data.selectedYear,
                    advancePayment: advance?.amountPaid || 48000,
                    entryDate: tenant?.entryDate || '2024-01-01',
                  } as MonthlyLedgerItem);
                  handleGenerateAdvanceReceipt({
                    ...targetItem,
                    advancePayment: advance?.amountPaid || targetItem.advancePayment || 48000,
                  });
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                title="Generate Official Security Advance Receipt (Manager Signed)"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Generate Receipt</span>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Month Payable</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatBDT(currentLedgerItem?.totalPayable || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isUnitElecOn ? 'Rent + Electricity + Parking' : 'Rent + Parking (Electricity: OFF)'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Paid</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-2 font-mono">
            {formatBDT(currentLedgerItem?.totalPaid || 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Recorded this period</p>
        </div>
      </div>

      {/* ONLINE PAYMENT MFS SUBMISSION OR PHYSICAL PAYMENT NOTICE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`p-2 rounded-lg ${isMfsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Pay Online via MFS (bKash / Nagad / Rocket)
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isMfsActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {isMfsActive ? `${tenantBlockName}: Available (ON)` : `${tenantBlockName}: Unavailable (OFF)`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isMfsActive
                  ? `Receive money in ${tenantBlockName} Owner's own account (${blockMfsConfig.ownerName}) with +1.8% fee added`
                  : `Online MFS receiving is currently turned OFF by ${blockMfsConfig.ownerName} / Management for ${tenantBlockName}`}
              </p>
            </div>
          </div>
        </div>

        {paySuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {paySuccessMsg}
          </div>
        )}

        {isMfsActive ? (
          /* ONLINE MFS PAYMENT ACTIVE FOR THIS BLOCK */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Instructions Box with Owner's accounts */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                  {tenantBlockName} Official Accounts:
                </h4>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded">
                  {blockMfsConfig.ownerName} (Owner)
                </span>
              </div>

              {/* bKash */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-pink-600">bKash ({blockMfsConfig.bkashType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.bkashNumber, 'bkash')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'bkash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'bkash' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.bkashNumber}</p>
              </div>

              {/* Nagad */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-orange-600">Nagad ({blockMfsConfig.nagadType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.nagadNumber, 'nagad')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'nagad' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'nagad' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.nagadNumber}</p>
              </div>

              {/* Rocket */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-purple-600">Rocket ({blockMfsConfig.rocketType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.rocketNumber, 'rocket')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'rocket' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'rocket' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.rocketNumber}</p>
              </div>

              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold">⚠️ Extra 1.8% Cashout Fee Added:</p>
                <p>
                  Per {tenantBlockName} policy, 1.8% is automatically added to cover MFS cashout costs. Please send the exact total amount calculated below.
                </p>
                <p className="font-semibold text-slate-700 mt-1">
                  * Put Flat ID ({flatId}) in the payment reference.
                </p>
              </div>
            </div>

            {/* Payment Request Submission Form */}
            <form onSubmit={handleOnlinePaySubmit} className="md:col-span-2 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Select Payment Method *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="bKash">bKash ({blockMfsConfig.bkashNumber})</option>
                    <option value="Nagad">Nagad ({blockMfsConfig.nagadNumber})</option>
                    <option value="Rocket">Rocket ({blockMfsConfig.rocketNumber})</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Send to: <strong className="text-slate-800">
                      {payMethod === 'bKash' ? blockMfsConfig.bkashNumber : payMethod === 'Nagad' ? blockMfsConfig.nagadNumber : blockMfsConfig.rocketNumber}
                    </strong> ({blockMfsConfig.ownerName})
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Base Payable Amount (BDT / ৳) *
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rent / Electricity dues to be credited
                  </p>
                </div>
              </div>

              {/* 1.8% FEE & TOTAL BREAKDOWN CALCULATOR */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-slate-700 text-xs">
                  <span>Base Amount:</span>
                  <span className="font-bold">{formatBDT(payAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-blue-800 text-xs">
                  <span>+ Extra 1.8% MFS Cashout Fee:</span>
                  <span className="font-bold">+{formatBDT(mfsFeeAmount)}</span>
                </div>
                <div className="border-t border-blue-200 pt-1.5 flex items-center justify-between text-sm font-bold text-slate-900">
                  <span className="font-sans">Total to Send via {payMethod}:</span>
                  <span className="text-emerald-700 text-base">{formatBDT(totalMfsAmountToSend)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Transaction ID (TrxID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9J8219BA44 or BK99214A"
                  value={payTrxId}
                  onChange={(e) => setPayTrxId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 uppercase font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the exact transaction ID from your {payMethod} SMS/App confirmation.
                </p>
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Submit Payment Verification Request ({formatBDT(totalMfsAmountToSend)})
              </button>
            </form>
          </div>
        ) : (
          /* ONLINE MFS PAYMENT OFF FOR THIS BLOCK - PHYSICAL PAYMENT INSTRUCTIONS */
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-5">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Online MFS Payment is Currently Turned OFF for {tenantBlockName}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your block owner (<strong>{blockMfsConfig.ownerName}</strong>) or building management has disabled online MFS receiving for <strong>{tenantBlockName}</strong> at this time. Tenants of {tenantBlockName} must make payments <strong>physically in cash</strong> or through direct bank deposit.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Manager Office (Ground Floor)
                </div>
                <p className="text-slate-600">Pay cash in person to Manager Russell.</p>
                <p className="font-semibold text-slate-900">Phone: 01737-321998</p>
                <p className="text-[11px] text-slate-500">Office Hours: 09:00 AM &ndash; 09:00 PM</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <User className="w-4 h-4 text-emerald-600" />
                  {tenantBlockName} Owner ({blockMfsConfig.ownerName})
                </div>
                <p className="text-slate-600">Contact your block owner for direct payment collection.</p>
                <p className="font-semibold text-slate-900">Phone: {blockMfsConfig.ownerPhone}</p>
                <p className="text-[11px] text-slate-500">Receipt will be recorded in your digital ledger</p>
              </div>

              {blockMfsConfig.isBankDepositAllowed ? (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      Direct Bank Deposit
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">
                      Permitted
                    </span>
                  </div>
                  <p className="text-slate-600">{data.paymentSettings.bankName}</p>
                  <p className="font-mono font-bold text-slate-900">{data.paymentSettings.bankAccountNo}</p>
                  <p className="text-[11px] text-slate-500">Routing: {data.paymentSettings.bankRouting}</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-100/80 rounded-xl border border-dashed border-slate-300 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Lock className="w-4 h-4 text-amber-600" />
                    Direct Bank Deposit
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bank account details are restricted and not available without {tenantBlockName} Owner ({blockMfsConfig.ownerName}) permission.
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    Please pay physically in cash at Manager Russell&apos;s office.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Once you hand over physical cash or deposit to bank, Manager Russell will record it and you can download your official signed payment receipt immediately.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MONTHLY LEDGER HISTORY (From entry month onward) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              My Financial History & Monthly Ledgers
            </h3>
            <p className="text-xs text-slate-500">
              Complete historical record from tenant entry date ({formatDateDDMMYYYY(tenant?.entryDate)}) to present
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Statement
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Period</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Advance Paid</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Flat Rent</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Electricity</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Parking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {flatLedgerHistory.map((item) => {
                const isOwnerFlat = item.flatId.toLowerCase().includes('owner');
                const rawAdvStatus = (item.advanceStatus || '').trim();
                const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId || a.flatId === flatId);
                const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
                const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

                const effectiveAdvAmount =
                  Number(item.advancePayment || 0) > 0
                    ? Number(item.advancePayment || 0)
                    : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
                    ? matchingAdv.amountPaid
                    : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
                    ? matchingAdv.totalRequired
                    : (isMarkedPaid ? (unit?.monthlyRent ? unit.monthlyRent * 2 : 48000) : 0);

                const hasAdvAmount = effectiveAdvAmount > 0;
                const isNotPaid =
                  rawAdvStatus.toLowerCase() === 'not paid' ||
                  rawAdvStatus.toLowerCase() === 'not_paid';

                const advStatus =
                  isOwnerFlat
                    ? 'N/A'
                    : isNotPaid
                    ? 'Not Paid'
                    : isMarkedPaid
                    ? 'Paid'
                    : isMarkedPartial || matchingAdv?.status === 'partially_paid'
                    ? 'Partially Paid'
                    : rawAdvStatus.toLowerCase() === 'adjusted'
                    ? 'Adjusted'
                    : rawAdvStatus.toLowerCase() === 'n/a'
                    ? 'N/A'
                    : (matchingAdv?.status === 'paid' || (!rawAdvStatus && hasAdvAmount))
                    ? 'Paid'
                    : 'Not Paid';
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
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-sans whitespace-nowrap">
                      {getMonthName(item.month)} {item.year}
                    </td>

                    {/* Advance Paid with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-700 block">
                        {formatBDT(effectiveAdvAmount)}
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
                      {(advStatus === 'Paid' || advStatus === 'Partially Paid' || hasAdvAmount) && advStatus !== 'N/A' && advStatus !== 'Not Paid' && !isOwnerFlat && (
                        <div className="mt-1">
                          <button
                            onClick={() => handleGenerateAdvanceReceipt({ ...item, advancePayment: effectiveAdvAmount })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                            title="Generate Official Security Advance Receipt (Manager Signed)"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Generate Receipt</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Flat Rent with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
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
                            title="Generate Official Flat Rent Receipt (Manager Signed)"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Generate Receipt</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Electricity with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                      {!isUnitElecOn ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-medium text-slate-400 block">৳0</span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            OFF
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">No Bill</span>
                        </div>
                      ) : (
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
                          {item.electricityBill > 0 && (
                            <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                              {getPostpaidElectricityPeriod(item.month, item.year).monthName.slice(0, 3)} Bill
                            </span>
                          )}
                          {elecStatus === 'Paid' && item.electricityBill > 0 && (
                            <div className="mt-1">
                              <button
                                onClick={() => handleGenerateElectricityReceipt(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                title="Generate Official Electricity Bill Receipt (Manager Signed)"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>Generate Receipt</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Parking Rent */}
                    <td className="py-3 px-4 text-right text-slate-600 font-mono whitespace-nowrap">
                      {item.parkingRent > 0 ? formatBDT(item.parkingRent) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ELECTRICITY BILLS SECTION */}
      {isUnitElecOn ? (
        flatElectricityBills.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-base">
                My NESCO Electricity Bills
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {flatElectricityBills.map((b) => (
                <div key={b.id} className="p-4 border border-slate-200 rounded-xl bg-amber-50/30 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">
                      {getMonthName(b.consumptionMonth)} {b.consumptionYear} Consumption
                    </span>
                    <p className="text-slate-600 mt-0.5">
                      {b.consumedUnits} kWh units ({b.previousReading} &rarr; {b.currentReading})
                    </p>
                    <p className="font-bold text-amber-800 font-mono mt-1 text-base">
                      {formatBDT(b.totalBill)}
                    </p>
                  </div>
                  <button
                    onClick={() => onViewBill(b)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    View Bill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="p-2.5 bg-slate-100 text-slate-500 rounded-xl">
              <ZapOff className="w-5 h-5" />
            </span>
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                Electricity Sub-Meter Billing is OFF
              </span>
              <p className="text-slate-500 mt-0.5">
                Electricity billing and voucher receipts are currently disabled for Unit {flatId}. No electricity charges are added to your monthly dues.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Management & Office Contacts Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Building2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-slate-900 text-base">
                {COMPLEX_CONFIG.name} Management Office
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              {COMPLEX_CONFIG.address}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              For any urgent maintenance, security, billing queries, or emergency assistance, contact the authority directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="tel:01737-321998"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>Manager Russell:</span>
              <span className="font-mono">01737-321998</span>
            </a>
            <a
              href="tel:01913-858775"
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <span>Raju (Block B Owner):</span>
              <span className="font-mono">01913-858775</span>
            </a>
          </div>
        </div>
      </div>

      {/* Direct Shortcuts for Complaints & Chat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigateToView('complaints')}
          className="p-5 bg-white hover:bg-blue-50/50 border border-slate-200 rounded-2xl shadow-xs text-left transition-colors flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Submit Maintenance Complaint</h4>
              <p className="text-xs text-slate-500">Report plumbing, electricity, lift, or cleaning issues</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </button>

        <button
          onClick={() => onNavigateToView('messages')}
          className="p-5 bg-white hover:bg-blue-50/50 border border-slate-200 rounded-2xl shadow-xs text-left transition-colors flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Chat with Management</h4>
              <p className="text-xs text-slate-500">Direct message with Manager Russell or Block Owner</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
