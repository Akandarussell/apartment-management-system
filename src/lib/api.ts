import { getSupabaseClient } from './supabase';
import { INITIAL_UNITS } from './storage';
import {
  MonthlyLedgerItem,
  Unit,
  Tenant,
  ElectricityBill,
  PaymentTransaction,
  Complaint,
  ChatMessage,
  OnlinePaymentRequest,
  PaymentMethod,
  PaymentStatus,
} from '../types';

export interface SupabaseConnectionStatus {
  isConnected: boolean;
  message: string;
  tableCount?: number;
}

/**
 * Format month and year into strict 'YYYY-MM' billing period string
 * e.g., month = 10, year = 2026 -> '2026-10'
 */
export function formatBillingPeriod(month: number, year: number): string {
  const safeMonth = Math.min(12, Math.max(1, month));
  return `${year}-${String(safeMonth).padStart(2, '0')}`;
}

/**
 * Parse 'YYYY-MM' billing period string into { month, year }
 */
export function parseBillingPeriod(period: string): { month: number; year: number } {
  if (!period || !period.includes('-')) {
    return { month: 10, year: 2026 };
  }
  const parts = period.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 10;
  return { month, year };
}

/**
 * Validates connection to the remote Supabase PostgreSQL database
 */
export async function testRemoteSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      isConnected: false,
      message: 'Supabase URL and Anon Key are not configured in environment variables or UI.',
    };
  }

  try {
    // Check connection to monthly_rent_records or units
    const { count, error } = await supabase
      .from('monthly_rent_records')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // If monthly_rent_records table isn't created yet, check units
      const { count: unitCount, error: unitError } = await supabase
        .from('units')
        .select('*', { count: 'exact', head: true });

      if (unitError) {
        console.error('[Supabase Connection/RLS Error]', unitError);
        return {
          isConnected: false,
          message: `Database connection/RLS error: ${unitError.message} (Code: ${unitError.code})`,
        };
      }

      return {
        isConnected: true,
        message: `Connected to Supabase! (Found 'units' table with ${unitCount ?? 0} units. Note: run SQL migration to create 'monthly_rent_records').`,
        tableCount: unitCount ?? 0,
      };
    }

    return {
      isConnected: true,
      message: `Successfully connected to Supabase PostgreSQL! Database has ${count ?? 0} monthly rent records.`,
      tableCount: count ?? 0,
    };
  } catch (err: any) {
    console.error('[Supabase Network Failure]', err);
    return {
      isConnected: false,
      message: `Network or configuration failure: ${err?.message || err}`,
    };
  }
}

// Cached detected period column name on remote database: 'period' | 'billing_period'
let activePeriodColumn: 'period' | 'billing_period' = 'billing_period';

/**
 * Resolves which column name ('period' or 'billing_period') is supported on monthly_rent_records.
 * Defaults strictly to 'billing_period' matching the primary database schema and unique constraint.
 */
async function resolvePeriodColumn(supabase: any): Promise<'period' | 'billing_period'> {
  if (activePeriodColumn) return activePeriodColumn;
  activePeriodColumn = 'billing_period';
  return 'billing_period';
}

/**
 * Maps a flat ID or unit ID (e.g. 'A1', 'u-a1', 'B2', 'C4') to its canonical block key:
 * 'blockA', 'blockB', or 'blockC'
 */
export function deriveBlockKey(flatIdOrUnitId: string, blockName?: string): string {
  const str = (flatIdOrUnitId || '').trim();
  const cleanId = str.replace(/^u-/, '').toUpperCase();

  if (cleanId.startsWith('A')) return 'blockA';
  if (cleanId.startsWith('B')) return 'blockB';
  if (cleanId.startsWith('C')) return 'blockC';

  if (blockName) {
    const bn = blockName.toLowerCase();
    if (bn.includes('a')) return 'blockA';
    if (bn.includes('b')) return 'blockB';
    if (bn.includes('c')) return 'blockC';
  }

  return 'blockA';
}

/**
 * Validates and normalizes status values for the PostgreSQL payment_status enum
 * ('Paid' | 'Not Paid' | 'Partially Paid' | 'N/A')
 */
export function normalizePaymentStatus(val?: string): 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' {
  if (val === 'Paid' || val === 'Partially Paid' || val === 'Adjusted' || val === 'N/A') return val;
  return 'Not Paid';
}

/**
 * Maps a raw Supabase PostgreSQL row to a typed MonthlyLedgerItem
 */
export function mapDbRowToMonthlyLedgerItem(
  item: any,
  fallbackPeriod: string,
  fallbackMonth?: number,
  fallbackYear?: number
): MonthlyLedgerItem {
  const billingPeriod = item.billing_period || item.period || fallbackPeriod;
  const { month: parsedM, year: parsedY } = parseBillingPeriod(billingPeriod);
  const m = item.month || (fallbackMonth ?? parsedM);
  const y = item.year || (fallbackYear ?? parsedY);

  const unit = INITIAL_UNITS.find(
    (u) => u.id === item.unit_id || u.flatId === item.unit_id || u.flatId === item.flat_id
  );

  const flatId = item.flat_id || unit?.flatId || item.unit_id || 'A1';
  const blockName = item.block_name || unit?.blockName || 'Block A';
  const blockKey = item.block_key || deriveBlockKey(flatId, blockName);
  const flatRent = Number(item.flat_rent ?? item.monthly_rent ?? unit?.monthlyRent ?? 0);
  const electricityBill = Number(item.electricity_bill ?? item.e_bill_amount ?? 0);
  const parkingRent = Number(item.parking_rent ?? 0);
  const godownRent = Number(item.godown_rent ?? 0);
  const advancePayment = Number(item.advance_payment ?? item.advance_paid ?? 0);
  const totalPaid = Number(item.total_paid ?? item.paid_amount ?? 0);
  const calculatedPayable = flatRent + electricityBill + parkingRent + godownRent;
  const totalPayable = Number(item.total_payable ?? calculatedPayable);
  const totalDue = Number(item.total_due ?? item.due_amount ?? Math.max(0, totalPayable - totalPaid));

  let rentStatus = item.rent_status;
  if (!rentStatus) {
    if (totalPaid >= flatRent && flatRent > 0) rentStatus = 'Paid';
    else if (totalPaid > 0) rentStatus = 'Partially Paid';
    else rentStatus = 'Not Paid';
  }

  let paymentStatus = item.payment_status;
  if (!paymentStatus) {
    if (totalDue <= 0 && totalPaid > 0) paymentStatus = 'Paid';
    else if (totalPaid > 0) paymentStatus = 'Partially Paid';
    else paymentStatus = 'Not Paid';
  }

  return {
    id: item.id || `led-${flatId.toLowerCase().replace(/\s+/g, '-')}-${billingPeriod}`,
    unitId: item.unit_id || unit?.id || `u-${flatId.toLowerCase()}`,
    flatId,
    blockName,
    blockKey,
    tenantId: item.tenant_id || '',
    tenantName: item.tenant_name || 'Resident',
    tenantPhone: item.tenant_phone || '',
    entryDate: item.entry_date || '2026-01-01',
    billingPeriod,
    month: m,
    year: y,
    advancePayment,
    advanceStatus: item.advance_status || item.advanceStatus || 'Not Paid',
    advanceDate: item.advanceDate || item.advance_date || undefined,
    flatRent,
    rentStatus,
    rentPaymentDate: item.rent_payment_date || item.last_payment_date || item.payment_date || undefined,
    electricityBill,
    electricityStatus: item.electricity_status || item.e_bill_status || (electricityBill > 0 ? 'Not Paid' : 'N/A'),
    electricityDate: item.electricity_date || undefined,
    parkingRent,
    godownRent,
    totalPayable,
    totalPaid,
    totalDue,
    paymentStatus,
    adjustedFromAdvance: Number(item.adjusted_from_advance ?? item.adjustment_amount ?? 0),
    lastPaymentDate: item.last_payment_date || item.payment_date || undefined,
    notes: item.notes || '',
  };
}

/**
 * 1. MONTHLY SCOPING: Fetch records from Supabase strictly where billing_period (or period) = selectedPeriod
 * Target table: monthly_rent_records (with seamless adaptive column detection and fallback)
 */
export async function fetchRemoteMonthlyRentRecords(
  billingPeriod: string
): Promise<MonthlyLedgerItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { month, year } = parseBillingPeriod(billingPeriod);
  const targetCol = await resolvePeriodColumn(supabase);

  try {
    console.log(`[Supabase Scoping] Querying monthly_rent_records where ${targetCol} = "${billingPeriod}"...`);
    let { data, error } = await supabase
      .from('monthly_rent_records')
      .select('*')
      .eq(targetCol, billingPeriod);

    if (error) {
      // Column does not exist on table (code 42703) -> try alternate column
      if (error.code === '42703' || error.message?.toLowerCase().includes('does not exist')) {
        const alternateCol = targetCol === 'period' ? 'billing_period' : 'period';
        console.log(`[Supabase Scoping] Column '${targetCol}' not present, checking '${alternateCol}'...`);
        const retry = await supabase
          .from('monthly_rent_records')
          .select('*')
          .eq(alternateCol, billingPeriod);

        if (!retry.error) {
          activePeriodColumn = alternateCol;
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        // Table does not exist (code 42P01 or PGRST205)
        if (error.code === '42P01' || error.code === 'PGRST205') {
          console.warn(`[Supabase Schema Notice] Table 'monthly_rent_records' not found in database. Checking fallback.`);
          return await fetchRemoteLedgerFallback(month, year);
        }

        // Permission denied (RLS violation)
        if (error.code === '42501') {
          console.warn(
            `[Supabase RLS Notice] Read access restricted on monthly_rent_records for ${billingPeriod}. Verify RLS policies allow SELECT.`
          );
          return [];
        }

        console.warn(`[Supabase Query Notice] Failed to query monthly_rent_records for ${billingPeriod}:`, error.message);
        return await fetchRemoteLedgerFallback(month, year);
      }
    }

    if (!data || data.length === 0) {
      console.log(`[Supabase Query] ${targetCol} = "${billingPeriod}": 0 records found in Supabase.`);
      return [];
    }

    console.log(
      `[Supabase Query Success] ${targetCol} = "${billingPeriod}": Successfully fetched ${data.length} records from monthly_rent_records.`
    );

    return data.map((item: any) => mapDbRowToMonthlyLedgerItem(item, billingPeriod, month, year));
  } catch (err: any) {
    console.warn(`[Supabase Exception] Failed to query monthly_rent_records:`, err);
    return await fetchRemoteLedgerFallback(month, year);
  }
}

/**
 * Helper to build payload matching the database schema.
 * Ensures block_key and all required non-null fields are always explicitly defined.
 * 1. Maps block_key properly from flat record or derives from unit ID prefix (A -> blockA, B -> blockB, C -> blockC)
 * 2. Contains all required non-null fields: period, unit_id, block_key, tenant_name, tenant_phone, flat_rent, rent_status, paid_amount, due_amount, electricity_bill, electricity_status
 */
// Set of columns reported by PostgREST as not existing in schema cache
// 'tenant_id', 'total_due', 'total_paid', 'total_payable', 'advance_paid', 'e_bill_amount', 'e_bill_status', 'adjustment_amount', 'rent_payment_date', and 'electricity_date' are excluded by default
const unsupportedColumns = new Set<string>([
  'tenant_id',
  'total_due',
  'total_paid',
  'total_payable',
  'advance_paid',
  'e_bill_amount',
  'e_bill_status',
  'adjustment_amount',
  'rent_payment_date',
  'electricity_date',
]);

/**
 * Helper to build payload matching the database schema.
 * Ensures block_key, monthly_rent, flat_rent and all required non-null fields are always explicitly defined.
 * 1. Maps block_key properly from flat record or derives from unit ID prefix (A -> blockA, B -> blockB, C -> blockC)
 * 2. Contains all required non-null fields: period, unit_id, block_key, tenant_name, tenant_phone, monthly_rent, flat_rent, rent_status, paid_amount, due_amount, electricity_bill, electricity_status, last_payment_date
 */
export function buildUpsertPayload(flat: any, selectedPeriod: string): Record<string, any> {
  let cleanId = '';
  if (flat.flatId) {
    cleanId = String(flat.flatId).trim();
  } else if (flat.unit_id && !String(flat.unit_id).startsWith('led')) {
    cleanId = String(flat.unit_id).trim();
  } else if (flat.unitId && !String(flat.unitId).startsWith('led')) {
    cleanId = String(flat.unitId).trim();
  } else if (flat.id) {
    const idStr = String(flat.id).trim();
    if (idStr.startsWith('ledger-') || idStr.startsWith('led-')) {
      const parts = idStr.split('-');
      cleanId = parts[1] || idStr;
    } else {
      cleanId = idStr;
    }
  } else {
    cleanId = 'A1';
  }
  const unitId = cleanId.replace(/^u-/, '').trim();

  // 1. Map block_key properly from the flat record or derive it from the unit ID prefix
  const derivedBlockKey =
    unitId.toUpperCase().startsWith('A')
      ? 'blockA'
      : unitId.toUpperCase().startsWith('B')
      ? 'blockB'
      : unitId.toUpperCase().startsWith('C')
      ? 'blockC'
      : deriveBlockKey(unitId, flat.blockName || flat.block_name);

  const blockKey: string =
    flat.blockKey ||
    flat.block_key ||
    (unitId.startsWith('A') ? 'blockA' : unitId.startsWith('B') ? 'blockB' : unitId.startsWith('C') ? 'blockC' : derivedBlockKey) ||
    'blockA';

  const blockName =
    flat.blockName ||
    flat.block_name ||
    (blockKey === 'blockA' ? 'Block A' : blockKey === 'blockB' ? 'Block B' : 'Block C');

  const { month: parsedMonth, year: parsedYear } = parseBillingPeriod(selectedPeriod);
  const monthNum = flat.month || parsedMonth;
  const yearNum = flat.year || parsedYear;

  // 2. Make sure the upsert payload contains all required non-null fields
  // electricity_status and rent_status must strictly match the PostgreSQL payment_status enum:
  // ('Paid', 'Not Paid', 'Partially Paid', 'N/A') — never 'Unpaid'.
  const rentStatus = normalizePaymentStatus(flat.rent_status || flat.rentStatus);
  const electricityStatus = normalizePaymentStatus(
    flat.electricity_status || flat.eBillStatus || flat.electricityStatus
  );

  const flatRent = Number(flat.monthly_rent ?? flat.flat_rent ?? flat.rent ?? flat.flatRent ?? 0);
  const paidAmount = Number(flat.paid_amount ?? flat.total_paid ?? flat.totalPaid ?? 0);
  const dueAmount = Number(flat.due_amount ?? flat.total_due ?? flat.totalDue ?? 0);
  const eBillAmount = Number(flat.electricity_bill ?? flat.e_bill_amount ?? flat.eBill ?? flat.electricityBill ?? 0);
  const parkingRent = Number(flat.parking_rent ?? flat.parkingRent ?? 0);
  const godownRent = Number(flat.godown_rent ?? flat.godownRent ?? 0);
  const advancePayment = Number(flat.advance_payment ?? flat.advancePayment ?? 0);
  const advanceStatus = flat.advance_status || flat.advanceStatus || 'Not Paid';
  const adjustedFromAdvance = Number(flat.adjusted_from_advance ?? flat.adjustedFromAdvance ?? 0);
  const totalPayable = Number(flat.total_payable ?? flat.totalPayable ?? (flatRent + eBillAmount + parkingRent + godownRent));
  const paymentStatus = normalizePaymentStatus(flat.payment_status || flat.paymentStatus || (dueAmount === 0 && totalPayable > 0 ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Not Paid'));

  const rawAdvDate = flat.advance_date || flat.advanceDate;
  const rawRentDate = flat.rent_payment_date || flat.rentPaymentDate;
  const rawElecDate = flat.electricity_date || flat.electricityDate;
  const rawLastDate = flat.last_payment_date || flat.lastPaymentDate || rawRentDate || rawElecDate || rawAdvDate;

  const payload: Record<string, any> = {
    // Both 'period' and 'billing_period' to satisfy either database column schema
    period: selectedPeriod, // e.g. '2026-10'
    billing_period: selectedPeriod,
    unit_id: unitId, // e.g. 'A1'
    flat_id: unitId,
    block_key: blockKey,
    block_name: blockName,
    tenant_name: flat.tenant_name || flat.tenant || flat.tenantName || 'Resident',
    tenant_phone: flat.tenant_phone || flat.phone || flat.tenantPhone || '',
    entry_date: flat.entry_date || flat.entryDate || '2026-01-01',
    month: monthNum,
    year: yearNum,
    advance_payment: advancePayment,
    advance_status: advanceStatus,
    advance_date: rawAdvDate ? String(rawAdvDate).slice(0, 10) : null,
    flat_rent: flatRent,
    monthly_rent: flatRent, // satisfies NOT NULL constraint on monthly_rent
    rent_status: rentStatus,
    last_payment_date: rawLastDate ? String(rawLastDate).slice(0, 10) : null,
    paid_amount: paidAmount,
    due_amount: dueAmount,
    payment_status: paymentStatus,
    electricity_bill: eBillAmount,
    electricity_status: electricityStatus,
    parking_rent: 0,
    godown_rent: godownRent,
    adjusted_from_advance: adjustedFromAdvance,
    notes: flat.notes || '',
  };

  // Strip any columns previously confirmed to not exist in PostgREST schema cache
  for (const col of unsupportedColumns) {
    delete payload[col];
  }

  return payload;
}

/**
 * 2. DATA UPSERT / PERSISTENCE:
 * Perform a Supabase save matching on (unit_id, period) with explicit block_key,
 * resilient PostgREST schema cache tolerance (PGRST204), and conflict fallback.
 */
export async function upsertRemoteMonthlyRentRecord(
  flat: any
): Promise<{ success: boolean; data?: any; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const errorMsg = 'Supabase client is not configured. Please configure your Supabase URL & Anon Key in the Database Setup modal or .env file.';
    console.warn('[Supabase Upsert]', errorMsg);
    return { success: false, error: new Error(errorMsg) };
  }

  const selectedPeriod =
    flat.period ||
    flat.billingPeriod ||
    flat.billing_period ||
    (flat.month && flat.year ? formatBillingPeriod(flat.month, flat.year) : '2026-10');

  let payload: any = buildUpsertPayload(flat, selectedPeriod);

  console.log(`[Supabase Upsert] Saving Flat ${payload.unit_id} (period: "${payload.period}", block_key: "${payload.block_key}"):`, payload);

  let lastError: any = null;

  // Retry loop handles stale PostgREST schema cache (PGRST204) by stripping any uncached columns
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // Clean payload against current unsupportedColumns
      for (const col of unsupportedColumns) {
        delete payload[col];
      }

      // 1. Try upsert with onConflict on (unit_id, billing_period) or (unit_id, period)
      const conflictCol = activePeriodColumn === 'billing_period' ? 'unit_id,billing_period' : 'unit_id,period';
      let { data, error } = await supabase
        .from('monthly_rent_records')
        .upsert(payload, { onConflict: conflictCol })
        .select('id');

      if (!error) {
        console.log(`[Supabase Upsert OK] Flat ${payload.unit_id} (block_key: "${payload.block_key}") saved successfully to monthly_rent_records:`, data);
        return { success: true, data: data || { unit_id: payload.unit_id } };
      }

      let currentError = error;
      lastError = error;

      // Handle PostgREST schema cache missing column (PGRST204) immediately
      if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
        const match =
          currentError.message.match(/Could not find the '([^']+)' column/i) ||
          currentError.message.match(/'([^']+)' column/i) ||
          currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
          currentError.message.match(/column "([^"]+)"/i);
        const colName = match ? match[1] : null;
        if (colName) {
          console.warn(`[Supabase Schema Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
          unsupportedColumns.add(colName);
          delete payload[colName];

          // Also attempt simple upsert without select
          try {
            const noSelectRes = await supabase
              .from('monthly_rent_records')
              .upsert(payload, { onConflict: conflictCol });
            if (!noSelectRes.error) {
              console.log(`[Supabase Upsert OK Minimal] Flat ${payload.unit_id} saved successfully.`);
              return { success: true, data: { unit_id: payload.unit_id } };
            }
            if (noSelectRes.error.code === 'PGRST204' || noSelectRes.error.message?.includes('schema cache') || noSelectRes.error.message?.includes('column')) {
              const m2 =
                noSelectRes.error.message.match(/Could not find the '([^']+)' column/i) ||
                noSelectRes.error.message.match(/'([^']+)' column/i) ||
                noSelectRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
                noSelectRes.error.message.match(/column "([^"]+)"/i);
              if (m2?.[1]) {
                unsupportedColumns.add(m2[1]);
                delete payload[m2[1]];
              }
            }
          } catch {
            // continue retry loop
          }
          continue;
        }
      }

      // If missing unique constraint matching onConflict specification (error 42P10), try alternate conflict target
      if (error.code === '42P10' || error.message?.includes('ON CONFLICT specification') || error.message?.includes('exclusion constraint')) {
        const altConflict = conflictCol === 'unit_id,period' ? 'unit_id,billing_period' : 'unit_id,period';
        const altRes = await supabase
          .from('monthly_rent_records')
          .upsert(payload, { onConflict: altConflict })
          .select('id');

        if (!altRes.error) {
          activePeriodColumn = altConflict === 'unit_id,billing_period' ? 'billing_period' : 'period';
          console.log(`[Supabase Upsert OK with ${altConflict}] Flat ${payload.unit_id} saved successfully:`, altRes.data);
          return { success: true, data: altRes.data || { unit_id: payload.unit_id } };
        }

        if (altRes.error.code === 'PGRST204' || altRes.error.message?.includes('schema cache') || altRes.error.message?.includes('column')) {
          const match =
            altRes.error.message.match(/Could not find the '([^']+)' column/i) ||
            altRes.error.message.match(/'([^']+)' column/i) ||
            altRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            altRes.error.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            console.warn(`[Supabase Schema Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
            unsupportedColumns.add(colName);
            delete payload[colName];
            continue;
          }
        }

        console.warn(`[Supabase Notice] No unique constraint on (${conflictCol}); saving Flat ${payload.unit_id} via find-and-update/insert...`);
        const queryCol = activePeriodColumn === 'period' ? 'period' : 'billing_period';
        const queryPeriod = payload[queryCol] || payload.billing_period || payload.period;
        let existingId: string | null = null;
        try {
          const { data: exRow, error: exErr } = await supabase
            .from('monthly_rent_records')
            .select('id')
            .eq('unit_id', payload.unit_id)
            .eq(queryCol, queryPeriod)
            .maybeSingle();

          if (!exErr && exRow?.id) {
            existingId = exRow.id;
          } else if (exErr) {
            const altCol = queryCol === 'period' ? 'billing_period' : 'period';
            const altP = payload[altCol] || queryPeriod;
            const { data: altExRow } = await supabase
              .from('monthly_rent_records')
              .select('id')
              .eq('unit_id', payload.unit_id)
              .eq(altCol, altP)
              .maybeSingle();
            if (altExRow?.id) {
              existingId = altExRow.id;
              activePeriodColumn = altCol;
            }
          }
        } catch {
          // ignore lookup errors and fall through
        }

        if (existingId) {
          const updateRes = await supabase
            .from('monthly_rent_records')
            .update(payload)
            .eq('id', existingId)
            .select('id');

          if (!updateRes.error) {
            console.log(`[Supabase Update OK] Flat ${payload.unit_id} updated successfully via ID:`, updateRes.data);
            return { success: true, data: updateRes.data || { id: existingId, unit_id: payload.unit_id } };
          }
          currentError = updateRes.error;
          lastError = updateRes.error;
        } else {
          const insertRes = await supabase
            .from('monthly_rent_records')
            .insert(payload)
            .select('id');

          if (!insertRes.error) {
            console.log(`[Supabase Insert OK] Flat ${payload.unit_id} inserted successfully:`, insertRes.data);
            return { success: true, data: insertRes.data || { unit_id: payload.unit_id } };
          }
          currentError = insertRes.error;
          lastError = insertRes.error;
        }

        if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
          const match =
            currentError.message.match(/Could not find the '([^']+)' column/i) ||
            currentError.message.match(/'([^']+)' column/i) ||
            currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            currentError.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            unsupportedColumns.add(colName);
            delete payload[colName];
            continue;
          }
        }
      }

      console.error(`[Supabase Upsert Error] Failed to save Flat ${payload.unit_id} (${payload.block_key}):`, currentError.message, currentError);
      return { success: false, error: currentError };
    } catch (err: any) {
      console.error(`[Supabase Upsert Exception] Error saving Flat ${payload.unit_id}:`, err?.message || err, err);
      return { success: false, error: err };
    }
  }

  return { success: false, error: lastError || new Error('Max attempts exceeded') };
}

/**
 * Batch Upsert multiple monthly rent records into Supabase on (unit_id, billing_period)
 * with explicit block_key, resilient schema cache tolerance, and conflict fallback.
 */
export async function upsertBatchRemoteMonthlyRentRecords(
  flats: any[]
): Promise<{ success: boolean; count: number; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const errorMsg = 'Supabase client is not configured. Please configure your Supabase URL & Anon Key in the Database Setup modal or .env file.';
    return { success: false, count: 0, error: new Error(errorMsg) };
  }
  if (!flats || flats.length === 0) {
    return { success: false, count: 0, error: new Error('No records provided to save.') };
  }

  const records = flats.map((flat) => {
    const selectedPeriod =
      flat.period ||
      flat.billingPeriod ||
      flat.billing_period ||
      (flat.month && flat.year ? formatBillingPeriod(flat.month, flat.year) : '2026-10');
    return buildUpsertPayload(flat, selectedPeriod);
  });

  console.log(`[Supabase Batch Upsert] Upserting ${records.length} records with explicit block_key to monthly_rent_records... Sample:`, records[0]);

  let currentRecords = records;
  let lastBatchError: any = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // Ensure records do not contain any known unsupportedColumns
      currentRecords = currentRecords.map((r: any) => {
        const copy = { ...r };
        for (const col of unsupportedColumns) {
          delete copy[col];
        }
        return copy;
      });

      const conflictCol = activePeriodColumn === 'billing_period' ? 'unit_id,billing_period' : 'unit_id,period';
      let { data, error } = await supabase
        .from('monthly_rent_records')
        .upsert(currentRecords, { onConflict: conflictCol })
        .select('id');

      if (!error) {
        console.log(`[Supabase Batch Upsert OK] Successfully saved ${currentRecords.length} records with explicit block_key.`);
        return { success: true, count: currentRecords.length };
      }

      let currentError = error;
      lastBatchError = error;

      // Handle PostgREST schema cache missing column (PGRST204) immediately
      if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
        const match =
          currentError.message.match(/Could not find the '([^']+)' column/i) ||
          currentError.message.match(/'([^']+)' column/i) ||
          currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
          currentError.message.match(/column "([^"]+)"/i);
        const colName = match ? match[1] : null;
        if (colName) {
          console.warn(`[Supabase Batch Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
          unsupportedColumns.add(colName);
          currentRecords = currentRecords.map((r: any) => {
            const copy = { ...r };
            delete copy[colName];
            return copy;
          });
          continue;
        }
      }

      // If missing unique constraint matching onConflict specification, try alternate conflict target
      if (error.code === '42P10' || error.message?.includes('ON CONFLICT specification') || error.message?.includes('exclusion constraint')) {
        const altConflict = conflictCol === 'unit_id,period' ? 'unit_id,billing_period' : 'unit_id,period';
        const altRes = await supabase
          .from('monthly_rent_records')
          .upsert(currentRecords, { onConflict: altConflict })
          .select('id');

        if (!altRes.error) {
          activePeriodColumn = altConflict === 'unit_id,billing_period' ? 'billing_period' : 'period';
          console.log(`[Supabase Batch Upsert OK with ${altConflict}] Successfully saved ${currentRecords.length} records.`);
          return { success: true, count: currentRecords.length };
        }

        if (altRes.error.code === 'PGRST204' || altRes.error.message?.includes('schema cache') || altRes.error.message?.includes('column')) {
          const match =
            altRes.error.message.match(/Could not find the '([^']+)' column/i) ||
            altRes.error.message.match(/'([^']+)' column/i) ||
            altRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            altRes.error.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            unsupportedColumns.add(colName);
            currentRecords = currentRecords.map((r: any) => {
              const copy = { ...r };
              delete copy[colName];
              return copy;
            });
            continue;
          }
        }

        console.warn(`[Supabase Batch Notice] No unique constraint on (${conflictCol}); saving records individually via find-and-update/insert...`);
        let savedCount = 0;
        let singleErrors: any[] = [];
        for (const item of currentRecords) {
          const res = await upsertRemoteMonthlyRentRecord(item);
          if (res.success) {
            savedCount++;
          } else if (res.error) {
            singleErrors.push(res.error);
          }
        }
        if (savedCount > 0) {
          return { success: true, count: savedCount };
        }
        return { success: false, count: 0, error: singleErrors[0] || currentError };
      }

      console.error('[Supabase Batch Upsert Error]:', currentError.message, currentError);
      return { success: false, count: 0, error: currentError };
    } catch (err: any) {
      console.error('[Supabase Batch Upsert Exception]:', err?.message || err, err);
      return { success: false, count: 0, error: err };
    }
  }

  return { success: false, count: 0, error: lastBatchError || new Error('Max retry attempts exceeded') };
}

/**
 * Copy/Clone tenant roster from a previous month into the current billing_period
 * with reset payment statuses (Electricity & Paid set to 0, Payment Status = 'Not Paid').
 */
export async function copyMonthlyRosterInSupabase(
  sourcePeriod: string,
  targetPeriod: string,
  fallbackSourceItems?: MonthlyLedgerItem[]
): Promise<{ success: boolean; count: number; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, count: 0, error: new Error('Supabase client is not configured.') };

  const { month: targetMonth, year: targetYear } = parseBillingPeriod(targetPeriod);

  // 1. Fetch source records
  let sourceRecords = await fetchRemoteMonthlyRentRecords(sourcePeriod);
  if (!sourceRecords || sourceRecords.length === 0) {
    sourceRecords = fallbackSourceItems || [];
  }

  if (sourceRecords.length === 0) {
    const err = new Error(`No source records found for ${sourcePeriod} to clone.`);
    console.warn(`[Supabase Clone Roster] ${err.message}`);
    return { success: false, count: 0, error: err };
  }

  // 2. Transform into target period records with reset payment statuses
  const targetRecords: MonthlyLedgerItem[] = sourceRecords.map((item) => {
    const totalPayable = item.flatRent + item.godownRent; // Electricity reset to 0
    const paymentStatus: PaymentStatus =
      item.tenantName === 'Owner Occupied' || item.tenantName === 'Vacant Flat' ? 'N/A' : 'Not Paid';

    return {
      id: `led-${item.flatId.toLowerCase()}-${targetPeriod}`,
      unitId: item.unitId || `u-${item.flatId}`,
      flatId: item.flatId,
      blockName: item.blockName,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      entryDate: item.entryDate,
      billingPeriod: targetPeriod,
      month: targetMonth,
      year: targetYear,
      advancePayment: item.advancePayment,
      advanceStatus: item.advanceStatus || (item.advancePayment > 0 ? 'Paid' : 'Not Paid'),
      advanceDate: item.advanceDate,
      flatRent: item.flatRent,
      rentStatus: 'Not Paid',
      rentPaymentDate: undefined,
      electricityBill: 0,
      electricityStatus: 'N/A',
      electricityDate: undefined,
      parkingRent: 0,
      godownRent: item.godownRent || 0,
      totalPayable,
      totalPaid: 0,
      totalDue: totalPayable,
      paymentStatus,
      adjustedFromAdvance: 0,
      lastPaymentDate: undefined,
      notes: '',
    };
  });

  const result = await upsertBatchRemoteMonthlyRentRecords(targetRecords);
  if (result.success) {
    console.log(
      `[Supabase Clone OK] Cloned ${result.count} tenant records from ${sourcePeriod} into billing_period = "${targetPeriod}" with reset payment statuses.`
    );
  }
  return result;
}

/**
 * Secondary fallback to legacy monthly_rent_charges if monthly_rent_records table isn't migrated
 */
async function fetchRemoteLedgerFallback(
  month: number,
  year: number
): Promise<MonthlyLedgerItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('monthly_rent_charges')
      .select('*')
      .eq('month', month)
      .eq('year', year);

    if (error || !data) return null;

    const billingPeriod = formatBillingPeriod(month, year);
    return data.map((item: any) => ({
      id: item.id,
      unitId: item.unit_id,
      flatId: item.flat_id,
      blockName: item.block_name,
      tenantId: item.tenant_id || '',
      tenantName: item.tenant_name || 'Resident',
      tenantPhone: item.tenant_phone || '',
      entryDate: item.entry_date || '2026-01-01',
      billingPeriod,
      month: item.month,
      year: item.year,
      advancePayment: Number(item.advance_payment || 0),
      flatRent: Number(item.flat_rent || 0),
      electricityBill: Number(item.electricity_bill || 0),
      parkingRent: Number(item.parking_rent || 0),
      godownRent: Number(item.godown_rent || 0),
      totalPayable: Number(item.total_payable || 0),
      totalPaid: Number(item.total_paid || 0),
      totalDue: Number(item.total_due || 0),
      paymentStatus: item.payment_status || 'Not Paid',
      adjustedFromAdvance: Number(item.adjusted_from_advance || 0),
      lastPaymentDate: item.last_payment_date,
      notes: item.notes,
    }));
  } catch {
    return null;
  }
}

/**
 * Legacy alias for backwards compatibility
 */
export async function fetchRemoteLedger(
  month: number,
  year: number
): Promise<MonthlyLedgerItem[] | null> {
  const period = formatBillingPeriod(month, year);
  return fetchRemoteMonthlyRentRecords(period);
}

/**
 * Call privileged RPC to provision a new tenant
 */
export async function rpcProvisionTenant(params: {
  flatId: string;
  fullName: string;
  email: string;
  phone: string;
  nidNumber: string;
  tempPassword: string;
  entryDate: string;
  requiredAdvance: number;
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: 'Supabase client not configured.' };

  try {
    const { data, error } = await supabase.rpc('provision_tenant_account', {
      p_flat_id: params.flatId,
      p_full_name: params.fullName,
      p_email: params.email,
      p_phone: params.phone,
      p_nid_number: params.nidNumber,
      p_temp_password: params.tempPassword,
      p_entry_date: params.entryDate,
      p_required_advance: params.requiredAdvance,
    });

    if (error) {
      console.error('[Supabase RLS/Error] provision_tenant_account RPC error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: `Account provisioned for Flat ${params.flatId}` };
  } catch (err: any) {
    console.error('[Supabase Exception] provision_tenant_account exception:', err);
    return { success: false, message: err?.message || 'RPC invocation failed' };
  }
}

/**
 * Call privileged RPC to reset a user password
 */
export async function rpcAdminResetPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: 'Supabase client not configured.' };

  try {
    const { data, error } = await supabase.rpc('admin_reset_user_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    });

    if (error) {
      console.error('[Supabase RLS/Error] admin_reset_user_password RPC error:', error);
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Password reset successfully in auth system.' };
  } catch (err: any) {
    console.error('[Supabase Exception] admin_reset_user_password exception:', err);
    return { success: false, message: err?.message || 'RPC invocation failed' };
  }
}
