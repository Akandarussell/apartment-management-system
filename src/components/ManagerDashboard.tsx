import React, { useState } from 'react';
import {
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Wallet,
  Zap,
  Car,
  Warehouse,
  ArrowUpRight,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { AppDatabaseState, MonthlyLedgerItem } from '../types';
import { formatBDT, MONTH_NAMES, getMonthName } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { getSupabaseCredentials } from '../lib/supabase';

interface Props {
  data: AppDatabaseState;
  onUpdateMonthYear: (month: number, year: number) => void;
  onNavigateToView: (view: string) => void;
  onOpenDbModal?: () => void;
}

export const ManagerDashboard: React.FC<Props> = ({
  data,
  onUpdateMonthYear,
  onNavigateToView,
  onOpenDbModal,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(data.selectedMonth);
  const [selectedYear, setSelectedYear] = useState<number>(data.selectedYear);

  const dbCreds = getSupabaseCredentials();

  const handleApplyFilter = (month: number = selectedMonth, year: number = selectedYear) => {
    onUpdateMonthYear(month, year);
  };

  const handlePrevMonth = () => {
    let newM = selectedMonth - 1;
    let newY = selectedYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
    handleApplyFilter(newM, newY);
  };

  const handleNextMonth = () => {
    let newM = selectedMonth + 1;
    let newY = selectedYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
    handleApplyFilter(newM, newY);
  };

  // Calculations for current selected month
  const currentLedger = data.ledgerItems.filter(
    (item) => item.month === data.selectedMonth && item.year === data.selectedYear
  );

  const residentialFlats = data.units.filter((u) => u.unitType === 'residential');
  const totalFlats = residentialFlats.length;
  const occupiedFlats = residentialFlats.filter((u) => u.isOccupied).length;
  const vacantFlats = totalFlats - occupiedFlats;
  const totalTenants = data.tenants.filter((t) => t.status === 'active').length;

  // Collections and Dues
  const totalPayable = currentLedger.reduce((sum, item) => sum + item.totalPayable, 0);
  const totalCollection = currentLedger.reduce((sum, item) => sum + item.totalPaid, 0);
  const totalDues = currentLedger.reduce((sum, item) => sum + item.totalDue, 0);

  // Category collections
  const flatRentCollection = currentLedger
    .filter((item) => item.paymentStatus === 'Paid' || item.paymentStatus === 'Partially Paid' || item.paymentStatus === 'Adjusted')
    .reduce((sum, item) => sum + Math.min(item.totalPaid, item.flatRent), 0);

  const electricityCollection = currentLedger
    .filter((item) => item.paymentStatus === 'Paid' || item.paymentStatus === 'Partially Paid')
    .reduce((sum, item) => sum + Math.min(item.electricityBill, Math.max(0, item.totalPaid - item.flatRent)), 0);

  const parkingCollection = currentLedger
    .filter((item) => item.parkingRent > 0 && item.totalPaid > 0)
    .reduce((sum, item) => sum + item.parkingRent, 0);

  const godownCollection = currentLedger
    .filter((item) => item.godownRent > 0 && item.totalPaid > 0)
    .reduce((sum, item) => sum + item.godownRent, 0);

  const advanceTotal = data.advanceAccounts.reduce((sum, a) => sum + a.amountPaid, 0);

  // Block-wise statistics
  const blocks = ['Block A', 'Block B', 'Block C'] as const;
  const blockStats = blocks.map((blockName) => {
    const blockUnits = residentialFlats.filter((u) => u.blockName === blockName);
    const blockOccupied = blockUnits.filter((u) => u.isOccupied).length;
    const blockLedger = currentLedger.filter((item) => item.blockName === blockName);
    const blockPayable = blockLedger.reduce((sum, item) => sum + item.totalPayable, 0);
    const blockCollected = blockLedger.reduce((sum, item) => sum + item.totalPaid, 0);
    const blockDue = blockLedger.reduce((sum, item) => sum + item.totalDue, 0);
    const blockAdvance = data.advanceAccounts
      .filter((a) => {
        const u = data.units.find((unit) => unit.flatId === a.flatId);
        return u?.blockName === blockName;
      })
      .reduce((sum, a) => sum + a.amountPaid, 0);

    return {
      name: blockName,
      owner: blockName === 'Block A' ? 'Rashed' : blockName === 'Block B' ? 'Raju' : 'Rony',
      totalUnits: blockUnits.length,
      occupied: blockOccupied,
      vacant: blockUnits.length - blockOccupied,
      payable: blockPayable,
      collected: blockCollected,
      due: blockDue,
      advance: blockAdvance,
      collectionRate: blockPayable > 0 ? Math.round((blockCollected / blockPayable) * 100) : 0,
    };
  });

  // Category breakdown percentages
  const categories = [
    { label: 'Flat Rent', amount: flatRentCollection, color: 'bg-blue-600', text: 'text-blue-600' },
    { label: 'Electricity (NESCO)', amount: electricityCollection, color: 'bg-amber-500', text: 'text-amber-500' },
    { label: 'Parking Rent', amount: parkingCollection, color: 'bg-emerald-600', text: 'text-emerald-600' },
    { label: 'Godown Rent', amount: godownCollection, color: 'bg-purple-600', text: 'text-purple-600' },
  ];
  const catTotal = categories.reduce((sum, c) => sum + c.amount, 0) || 1;

  // Generate Year options 2024 to 2100
  const yearOptions = Array.from({ length: 77 }, (_, i) => 2024 + i);

  return (
    <div className="space-y-6">
      {/* Month & Year Selection Header with ENTER Button */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {COMPLEX_CONFIG.name.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-700 font-medium mt-0.5">
                {COMPLEX_CONFIG.address}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Hotline Contacts: <strong className="text-blue-700">{COMPLEX_CONFIG.contacts}</strong> &bull; Super Admin ERP
              </p>
            </div>
          </div>
        </div>

        {/* Month, Year & ENTER Button */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={handlePrevMonth}
            title="Previous Month"
            className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            title="Next Month"
            className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleApplyFilter(selectedMonth, selectedYear)}
            className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ml-1"
          >
            <Filter className="w-3.5 h-3.5" />
            ENTER
          </button>
        </div>
      </div>

      {/* Manager's Dedicated Supabase Database Live Connection Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white">
                PostgreSQL & Supabase Database Live Connection
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                dbCreds.isConfigured
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dbCreds.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}></span>
                {dbCreds.isConfigured ? 'Supabase Live Connected' : 'Database Ready (Local / Cloud)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Manager Super Admin Console &bull; Real-time synchronization & escrow financial ledgers
            </p>
          </div>
        </div>

        {onOpenDbModal && (
          <button
            onClick={onOpenDbModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
          >
            <Server className="w-4 h-4" />
            <span>Database Setup & SQL</span>
          </button>
        )}
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Flats & Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Flats Occupancy</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {occupiedFlats} / {totalFlats}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              {occupiedFlats} Occupied &bull; {vacantFlats} Vacant
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${(occupiedFlats / (totalFlats || 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Current Month Collection */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {getMonthName(data.selectedMonth)} Collection
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700">
              {formatBDT(totalCollection)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Of {formatBDT(totalPayable)} total payable ({totalPayable > 0 ? Math.round((totalCollection / totalPayable) * 100) : 0}%)
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, (totalCollection / (totalPayable || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Current Month Total Due */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {getMonthName(data.selectedMonth)} Dues
            </span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">
              {formatBDT(totalDues)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Outstanding balance this period
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-rose-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, (totalDues / (totalPayable || 1)) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Total Security Advance Holding */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Advance Held</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-indigo-700">
              {formatBDT(advanceTotal)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              From {data.advanceAccounts.length} active tenant deposits
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-indigo-700 font-semibold">
            <span>Security Deposit Reserve</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Breakdown Sub-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Flat Rent</p>
            <p className="text-base font-bold text-slate-900">{formatBDT(flatRentCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Electricity (NESCO)</p>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                {data.units.filter((u) => (u.unitType === 'residential' || u.unitType === 'godown') && (u.isElectricityEnabled ?? (u.electricityBillingType === 'nesco_submeter')) && u.electricityBillingType !== 'none').length} ON
              </span>
            </div>
            <p className="text-base font-bold text-slate-900">{formatBDT(electricityCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Parking Rental</p>
            <p className="text-base font-bold text-slate-900">{formatBDT(parkingCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase">Godown Rental</p>
            <p className="text-base font-bold text-slate-900">{formatBDT(godownCollection)}</p>
          </div>
        </div>
      </div>

      {/* BLOCK A, BLOCK B, BLOCK C SIDE-BY-SIDE FINANCIAL SUMMARIES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Block A, Block B & Block C Financial Comparison
            </h2>
            <p className="text-xs text-slate-500">
              Separate financial breakdown and owner accounting for {getMonthName(data.selectedMonth)} {data.selectedYear}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blockStats.map((b) => (
            <div
              key={b.name}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 transition-all shadow-xs p-5 flex flex-col justify-between"
            >
              <div>
                {/* Block Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-900 text-white">
                      {b.name}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      Owner: {b.owner}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Occupancy</span>
                    <p className="font-bold text-sm text-slate-900">
                      {b.occupied} / {b.totalUnits} Units
                    </p>
                  </div>
                </div>

                {/* Financial details */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Billed:</span>
                    <span className="font-bold text-slate-900 font-mono">{formatBDT(b.payable)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Collection:</span>
                    <span className="font-bold text-emerald-600 font-mono">{formatBDT(b.collected)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Total Due:</span>
                    <span className={`font-bold font-mono ${b.due > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatBDT(b.due)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Security Advance:</span>
                    <span className="font-bold text-indigo-600 font-mono">{formatBDT(b.advance)}</span>
                  </div>
                </div>
              </div>

              {/* Collection Progress & Action */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-xs mb-1.5 font-semibold">
                  <span className="text-slate-600">Collection Rate</span>
                  <span className="text-blue-700">{b.collectionRate}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${b.collectionRate}%` }}
                  ></div>
                </div>
                <button
                  onClick={() => onNavigateToView('monthly-ledger')}
                  className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors text-center"
                >
                  View {b.name} Ledger &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Analytics Grid: Category Breakdown & Historical Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Collection by Revenue Stream
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {getMonthName(data.selectedMonth)} {data.selectedYear}
            </span>
          </div>

          {/* Visual Progress Bars */}
          <div className="space-y-4 my-2">
            {categories.map((cat) => {
              const pct = Math.round((cat.amount / catTotal) * 100);
              return (
                <div key={cat.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{cat.label}</span>
                    <span className="font-mono text-slate-900">{formatBDT(cat.amount)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${cat.color} h-2.5 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Categorized Revenue</span>
            <span className="font-bold text-slate-900 text-sm font-mono">{formatBDT(catTotal)}</span>
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                ERP Management Actions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Access the main operational financial modules for {COMPLEX_CONFIG.name}:
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                onClick={() => onNavigateToView('monthly-ledger')}
                className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <p className="font-bold text-slate-900">Main Ledger</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Spreadsheet table & exports</p>
              </button>

              <button
                onClick={() => onNavigateToView('electricity')}
                className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <p className="font-bold text-slate-900">NESCO Electricity</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Sub-meter progressive slabs</p>
              </button>

              <button
                onClick={() => onNavigateToView('advance-payments')}
                className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <p className="font-bold text-slate-900">Advance Accounts</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Deposits & Adjustments</p>
              </button>

              <button
                onClick={() => onNavigateToView('online-payments')}
                className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Online Payments</p>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                    {data.onlineRequests.filter((r) => r.verificationStatus === 'Pending').length} Pending
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">3 Block Owners MFS & +1.8% fee</p>
                <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
                  {(['Block A', 'Block B', 'Block C'] as const).map((b) => {
                    const active = data.paymentSettings?.blockConfigs?.[b]?.isMfsEnabled ?? true;
                    return (
                      <span
                        key={b}
                        className={`px-1.5 py-0.5 rounded ${
                          active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {b.split(' ')[1]}: {active ? 'ON' : 'OFF'}
                      </span>
                    );
                  })}
                </div>
              </button>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Unresolved complaints:</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">
              {data.complaints.filter((c) => c.status !== 'Resolved').length} Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
