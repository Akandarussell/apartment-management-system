import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Database,
  RefreshCw,
  FileText,
  Table,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MonthlyLedgerItem, PaymentStatus, AppDatabaseState } from '../types';
import { formatBDT, MONTH_NAMES, getMonthName } from '../lib/nescoTariff';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppDatabaseState;
  onImportSuccess: (
    items: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => void;
  initialMonth?: number;
  initialYear?: number;
  assignedBlock?: string;
  userRole?: string;
}

interface ColumnMapping {
  flatId: string;
  tenantName: string;
  phone: string;
  entryDate: string;
  advance: string;
  flatRent: string;
  electricity: string;
  parking: string;
  godown: string;
  paymentStatus: string;
  totalPaid: string;
}

export const ExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onImportSuccess,
  initialMonth = 10,
  initialYear = 2026,
  assignedBlock,
  userRole,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'googlesheet' | 'paste'>('upload');
  const [targetMonth, setTargetMonth] = useState<number>(initialMonth);
  const [targetYear, setTargetYear] = useState<number>(initialYear);

  // File & Raw Data State
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-fill Options
  const [updateUnits, setUpdateUnits] = useState(true);
  const [updateTenants, setUpdateTenants] = useState(true);
  const [updateAdvance, setUpdateAdvance] = useState(true);

  // Column Mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    flatId: '',
    tenantName: '',
    phone: '',
    entryDate: '',
    advance: '',
    flatRent: '',
    electricity: '',
    parking: '',
    godown: '',
    paymentStatus: '',
    totalPaid: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Smart Header Detection
  const autoDetectMapping = (headers: string[]): ColumnMapping => {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const findMatch = (patterns: string[]) => {
      for (const h of headers) {
        const ch = clean(h);
        if (patterns.some((p) => ch.includes(clean(p)))) return h;
      }
      return '';
    };

    return {
      flatId: findMatch(['flatid', 'flatno', 'flat', 'unit', 'apartment', 'বাসা', 'ফ্ল্যাট']),
      tenantName: findMatch(['tenantname', 'tenant', 'name', 'resident', 'নাম', 'ভাড়াটিয়া']),
      phone: findMatch(['phone', 'mobile', 'contact', 'cell', 'মোবাইল', 'ফোন']),
      entryDate: findMatch(['entrydate', 'entry', 'movein', 'joining', 'তারিখ']),
      advance: findMatch(['advance', 'security', 'deposit', 'অগ্রিম']),
      flatRent: findMatch(['flatrent', 'rent', 'monthlyrent', 'ভাড়া', 'মূলভাড়া']),
      electricity: findMatch(['electricity', 'electric', 'bill', 'বিদ্যুৎ', 'কারেন্ট']),
      parking: findMatch(['parking', 'car', 'পার্কিং']),
      godown: findMatch(['godown', 'warehouse', 'গোডাউন']),
      paymentStatus: findMatch(['status', 'paymentstatus', 'অবস্থা']),
      totalPaid: findMatch(['paid', 'totalpaid', 'পরিশোধ', 'জমা']),
    };
  };

  const handleProcessWorkbook = (wb: XLSX.WorkBook, sourceName: string) => {
    try {
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        setErrorMessage('The sheet appears to be empty or has no header row.');
        return;
      }

      // First non-empty row as header
      const headers = (jsonData[0] as any[]).map((h) => String(h || '').trim()).filter(Boolean);
      const rows = jsonData.slice(1).filter((r: any[]) => r.some((c) => c !== '' && c !== null));

      setRawHeaders(headers);
      setRawRows(rows);
      setFileName(sourceName);
      setErrorMessage(null);

      // Auto-detect columns
      const detected = autoDetectMapping(headers);
      setMapping(detected);
    } catch (err: any) {
      setErrorMessage(`Failed to parse spreadsheet: ${err.message}`);
    }
  };

  // 1. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        handleProcessWorkbook(wb, file.name);
      } catch (err: any) {
        setErrorMessage(`Error reading file: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  // 2. Google Sheet Link Handler
  const handleFetchGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      setErrorMessage('Please paste a valid Google Sheet link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/fetch-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to download Google Sheet.');
      }

      const wb = XLSX.read(json.csv, { type: 'string' });
      handleProcessWorkbook(wb, 'Google Sheet (Live Extract)');
    } catch (err: any) {
      setErrorMessage(
        `Failed to import from Google Sheet: ${err.message}. Tip: Make sure the Google Sheet sharing setting is set to "Anyone with the link can view".`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Paste Table Data Handler
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste table data from Excel or Google Sheets.');
      return;
    }

    try {
      const wb = XLSX.read(pastedText.trim(), { type: 'string' });
      handleProcessWorkbook(wb, 'Pasted Clipboard Data');
    } catch (err: any) {
      setErrorMessage(`Error parsing pasted data: ${err.message}`);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Flat ID': 'A1',
        'Tenant Name': 'Moshiur Rahman',
        'Mobile Number': '01711-234567',
        'Entry Date': '2024-03-01',
        'Security Advance': 60000,
        'Monthly Flat Rent': 26000,
        'Electricity Bill': 3450,
        'Parking Rent': 2500,
        'Godown Rent': 0,
        'Payment Status': 'Paid',
      },
      {
        'Flat ID': 'A2',
        'Tenant Name': 'Farhan Ahmed',
        'Mobile Number': '01819-876543',
        'Entry Date': '2024-05-15',
        'Security Advance': 50000,
        'Monthly Flat Rent': 25000,
        'Electricity Bill': 2890,
        'Parking Rent': 0,
        'Godown Rent': 0,
        'Payment Status': 'Not Paid',
      },
      {
        'Flat ID': 'B1',
        'Tenant Name': 'Ziaur Rahman',
        'Mobile Number': '01722-334455',
        'Entry Date': '2024-01-10',
        'Security Advance': 55000,
        'Monthly Flat Rent': 24000,
        'Electricity Bill': 2100,
        'Parking Rent': 2500,
        'Godown Rent': 0,
        'Payment Status': 'Paid',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LedgerTemplate');
    XLSX.writeFile(wb, `MBD_Apartment_Ledger_Template.xlsx`);
  };

  // Convert extracted rows into MonthlyLedgerItem records
  const handleExecuteImport = () => {
    if (!mapping.flatId) {
      setErrorMessage('Please map the Flat ID column before importing.');
      return;
    }

    const flatIdIdx = rawHeaders.indexOf(mapping.flatId);
    const nameIdx = rawHeaders.indexOf(mapping.tenantName);
    const phoneIdx = rawHeaders.indexOf(mapping.phone);
    const entryDateIdx = rawHeaders.indexOf(mapping.entryDate);
    const advanceIdx = rawHeaders.indexOf(mapping.advance);
    const rentIdx = rawHeaders.indexOf(mapping.flatRent);
    const elecIdx = rawHeaders.indexOf(mapping.electricity);
    const parkingIdx = rawHeaders.indexOf(mapping.parking);
    const godownIdx = rawHeaders.indexOf(mapping.godown);
    const statusIdx = rawHeaders.indexOf(mapping.paymentStatus);
    const paidIdx = rawHeaders.indexOf(mapping.totalPaid);

    const importedItems: MonthlyLedgerItem[] = [];

    rawRows.forEach((row, idx) => {
      const rawFlatId = String(row[flatIdIdx] || '').trim();
      if (!rawFlatId) return; // Skip empty rows

      // Normalize Flat ID (e.g. "a1" -> "A1")
      const flatIdUpper = rawFlatId.toUpperCase().replace(/\s+/g, '');

      // Determine Block Name
      let blockName: 'Block A' | 'Block B' | 'Block C' = 'Block A';
      if (flatIdUpper.startsWith('B')) blockName = 'Block B';
      else if (flatIdUpper.startsWith('C')) blockName = 'Block C';

      const unit = data.units.find((u) => u.flatId === flatIdUpper);
      const tenant = data.tenants.find((t) => t.flatId === flatIdUpper);

      const parsedRent = rentIdx >= 0 && row[rentIdx] !== '' ? Number(row[rentIdx]) || 0 : unit?.monthlyRent || 25000;
      const parsedAdvance = advanceIdx >= 0 && row[advanceIdx] !== '' ? Number(row[advanceIdx]) || 0 : 50000;
      const parsedElec = elecIdx >= 0 && row[elecIdx] !== '' ? Number(row[elecIdx]) || 0 : 0;
      const parsedParking = parkingIdx >= 0 && row[parkingIdx] !== '' ? Number(row[parkingIdx]) || 0 : 0;
      const parsedGodown = godownIdx >= 0 && row[godownIdx] !== '' ? Number(row[godownIdx]) || 0 : 0;

      const totalPayable = parsedRent + parsedElec + parsedParking + parsedGodown;

      let totalPaid = 0;
      if (paidIdx >= 0 && row[paidIdx] !== '') {
        totalPaid = Number(row[paidIdx]) || 0;
      }

      let paymentStatus: PaymentStatus = 'Not Paid';
      if (statusIdx >= 0 && row[statusIdx]) {
        const rawStatus = String(row[statusIdx]).toLowerCase();
        if (rawStatus.includes('paid') && !rawStatus.includes('not') && !rawStatus.includes('part')) {
          paymentStatus = 'Paid';
          if (totalPaid === 0) totalPaid = totalPayable;
        } else if (rawStatus.includes('part')) {
          paymentStatus = 'Partially Paid';
          if (totalPaid === 0) totalPaid = Math.round(totalPayable / 2);
        } else if (rawStatus.includes('adjust')) {
          paymentStatus = 'Adjusted';
          if (totalPaid === 0) totalPaid = totalPayable;
        }
      } else if (totalPaid >= totalPayable && totalPayable > 0) {
        paymentStatus = 'Paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'Partially Paid';
      }

      const totalDue = Math.max(0, totalPayable - totalPaid);

      const tenantName =
        nameIdx >= 0 && row[nameIdx]
          ? String(row[nameIdx]).trim()
          : tenant?.fullName || (flatIdUpper.includes('OWNER') ? 'Owner Occupied' : 'Resident');

      const tenantPhone =
        phoneIdx >= 0 && row[phoneIdx] ? String(row[phoneIdx]).trim() : tenant?.phone || '01700-000000';

      const entryDate =
        entryDateIdx >= 0 && row[entryDateIdx] ? String(row[entryDateIdx]).trim() : tenant?.entryDate || '2024-01-01';

      importedItems.push({
        id: `led-${flatIdUpper.toLowerCase()}-${targetMonth}-${targetYear}`,
        unitId: unit?.id || `u-${flatIdUpper}`,
        flatId: flatIdUpper,
        blockName,
        tenantId: tenant?.id || `t-${flatIdUpper}`,
        tenantName,
        tenantPhone,
        entryDate,
        month: targetMonth,
        year: targetYear,
        advancePayment: parsedAdvance,
        flatRent: parsedRent,
        electricityBill: parsedElec,
        parkingRent: parsedParking,
        godownRent: parsedGodown,
        totalPayable,
        totalPaid,
        totalDue,
        paymentStatus,
        adjustedFromAdvance: 0,
        lastPaymentDate: paymentStatus === 'Paid' ? `${targetYear}-${String(targetMonth).padStart(2, '0')}-05` : undefined,
      });
    });

    if (importedItems.length === 0) {
      setErrorMessage('No valid flat records could be extracted.');
      return;
    }

    onImportSuccess(importedItems, targetMonth, targetYear, {
      updateUnits,
      updateTenants,
      updateAdvance,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                Upload & Extract Data from Excel or Google Sheet
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Automatically extract and map tenant rosters, rents, advances, electricity, and parking into database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Target Month & Year Selector Banner */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-bold text-blue-900 text-sm block">Target Ledger Month & Year</span>
              <p className="text-blue-700 text-xs mt-0.5">
                Extracted data will be written into the selected monthly ledger in the server database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                className="bg-white border border-blue-300 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 shadow-2xs focus:ring-2 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="bg-white border border-blue-300 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 shadow-2xs focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs ml-2"
                title="Download formatted sample template (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>1. Upload File (.xlsx / .csv)</span>
            </button>

            <button
              onClick={() => setActiveTab('googlesheet')}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'googlesheet'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>2. Google Sheet Link</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>3. Paste Table Data</span>
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  Click to select or drag & drop your Excel / CSV file
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
                </p>
              </div>
              {fileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Loaded: {fileName} ({rawRows.length} rows)
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Google Sheet Link */}
          {activeTab === 'googlesheet' && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800">
                Paste Google Sheet Shareable URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleFetchGoogleSheet}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Fetch & Extract
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Note: The Google Sheet must be shared with <em>&quot;Anyone with the link can view&quot;</em>.
              </p>
            </div>
          )}

          {/* TAB 3: Paste Table Data */}
          {activeTab === 'paste' && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800">
                Paste rows copied directly from Excel or Google Sheet
              </label>
              <textarea
                rows={4}
                placeholder="Flat ID	Tenant Name	Phone	Flat Rent	Electricity	Parking...
A1	Moshiur Rahman	01711-234567	26000	3450	2500"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Extract Pasted Data
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Column Mapping Section (Visible once rows are extracted) */}
          {rawHeaders.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Table className="w-4 h-4 text-blue-600" />
                    Step 2: Verify & Map Sheet Columns
                  </h4>
                  <p className="text-slate-500 text-xs">
                    Columns were automatically detected. Adjust dropdowns if needed to match your sheet headers.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                  {rawRows.length} Rows Found
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                {/* Flat ID (Required) */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Flat ID <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={mapping.flatId}
                    onChange={(e) => setMapping({ ...mapping, flatId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tenant Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Tenant Name
                  </label>
                  <select
                    value={mapping.tenantName}
                    onChange={(e) => setMapping({ ...mapping, tenantName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile / Phone */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Mobile / Phone
                  </label>
                  <select
                    value={mapping.phone}
                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Entry Date */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Entry Date
                  </label>
                  <select
                    value={mapping.entryDate}
                    onChange={(e) => setMapping({ ...mapping, entryDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Security Advance */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Security Advance
                  </label>
                  <select
                    value={mapping.advance}
                    onChange={(e) => setMapping({ ...mapping, advance: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monthly Flat Rent */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Monthly Flat Rent
                  </label>
                  <select
                    value={mapping.flatRent}
                    onChange={(e) => setMapping({ ...mapping, flatRent: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Electricity Bill */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Electricity Bill
                  </label>
                  <select
                    value={mapping.electricity}
                    onChange={(e) => setMapping({ ...mapping, electricity: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parking Rent */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    Parking Rent
                  </label>
                  <select
                    value={mapping.parking}
                    onChange={(e) => setMapping({ ...mapping, parking: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Extraction Preview Table */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 text-xs block">
                  Extracted Data Preview (First 5 Rows):
                </span>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Flat ID</th>
                        <th className="p-2.5">Tenant Name</th>
                        <th className="p-2.5">Mobile</th>
                        <th className="p-2.5 text-right">Rent</th>
                        <th className="p-2.5 text-right">Advance</th>
                        <th className="p-2.5 text-right">Electricity</th>
                        <th className="p-2.5 text-right">Parking</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {rawRows.slice(0, 5).map((row, i) => {
                        const getVal = (col: string) => {
                          const idx = rawHeaders.indexOf(col);
                          return idx >= 0 ? row[idx] : '-';
                        };
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-blue-700 font-sans">
                              {getVal(mapping.flatId) || `Row ${i + 1}`}
                            </td>
                            <td className="p-2.5 font-sans">{getVal(mapping.tenantName)}</td>
                            <td className="p-2.5 text-slate-600">{getVal(mapping.phone)}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {formatBDT(Number(getVal(mapping.flatRent)) || 0)}
                            </td>
                            <td className="p-2.5 text-right text-indigo-700 font-bold">
                              {formatBDT(Number(getVal(mapping.advance)) || 0)}
                            </td>
                            <td className="p-2.5 text-right text-amber-700">
                              {formatBDT(Number(getVal(mapping.electricity)) || 0)}
                            </td>
                            <td className="p-2.5 text-right text-slate-600">
                              {formatBDT(Number(getVal(mapping.parking)) || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Master Sync Options */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-xs block">
                  Automatic Master Roster Synchronization:
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={updateUnits}
                      onChange={(e) => setUpdateUnits(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Update Units rent rates & occupancy</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={updateTenants}
                      onChange={(e) => setUpdateTenants(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Update Tenants profiles & phone numbers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={updateAdvance}
                      onChange={(e) => setUpdateAdvance(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>Update Advance Accounts security balances</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Target: {getMonthName(targetMonth)} {targetYear} Ledger</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={rawRows.length === 0 || !mapping.flatId}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Import & Auto-Fill Database ({rawRows.length} Flats)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
