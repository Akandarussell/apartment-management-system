import { NescoTariffConfig, SlabBreakdownItem } from '../types';

export const DEFAULT_NESCO_TARIFF: NescoTariffConfig = {
  id: 'nesco-2024-standard',
  title: 'NESCO Residential Tariff (LT-A Postpaid 2024-2026)',
  effectiveFrom: '2024-03-01',
  slabs: [
    { minUnits: 0, maxUnits: 75, ratePerUnit: 5.26, slabName: 'Slab 1 (1 - 75 units)' },
    { minUnits: 76, maxUnits: 200, ratePerUnit: 7.20, slabName: 'Slab 2 (76 - 200 units)' },
    { minUnits: 201, maxUnits: 300, ratePerUnit: 7.59, slabName: 'Slab 3 (201 - 300 units)' },
    { minUnits: 301, maxUnits: 400, ratePerUnit: 8.02, slabName: 'Slab 4 (301 - 400 units)' },
    { minUnits: 401, maxUnits: 600, ratePerUnit: 12.67, slabName: 'Slab 5 (401 - 600 units)' },
    { minUnits: 601, maxUnits: null, ratePerUnit: 14.61, slabName: 'Slab 6 (Above 600 units)' },
  ],
  demandChargePerKW: 42.00,
  vatPercentage: 5.0,
  meterRent: 40.00,
  rebatePercentage: 0,
  isActive: true,
};

export interface TariffCalculationResult {
  consumedUnits: number;
  slabBreakdown: SlabBreakdownItem[];
  baseEnergyCost: number;
  demandCharge: number;
  meterRent: number;
  subtotal: number;
  vatAmount: number;
  rebateAmount: number;
  totalBill: number;
  sanctionedLoadKW: number;
  tariffConfigSnapshot: NescoTariffConfig;
}

/**
 * Calculates progressive electricity bill based on Bangladesh NESCO LT-A Residential Tariff.
 * Consumed units = Current Reading - Previous Reading
 */
export function calculateNescoElectricityBill(
  currentReading: number,
  previousReading: number,
  tariffConfig: NescoTariffConfig = DEFAULT_NESCO_TARIFF,
  sanctionedLoadKW: number = 2
): TariffCalculationResult {
  const consumedUnits = Math.max(0, currentReading - previousReading);
  const slabBreakdown: SlabBreakdownItem[] = [];
  let remainingUnits = consumedUnits;
  let baseEnergyCost = 0;

  // Check Lifeline eligibility (0 - 50 units)
  if (consumedUnits <= 50 && consumedUnits > 0) {
    const lifelineRate = 4.63; // Lifeline slab rate in Bangladesh
    const cost = Number((consumedUnits * lifelineRate).toFixed(2));
    slabBreakdown.push({
      slabName: 'Lifeline (1 - 50 units)',
      units: consumedUnits,
      rate: lifelineRate,
      amount: cost,
    });
    baseEnergyCost = cost;
  } else {
    // Progressive slab calculation
    // Slabs: 0-75, 76-200 (125 units), 201-300 (100 units), 301-400 (100 units), 401-600 (200 units), >600 (remaining)
    const slabRanges = [
      { name: 'Slab 1 (1 - 75 units)', cap: 75, rate: tariffConfig.slabs[0]?.ratePerUnit || 5.26 },
      { name: 'Slab 2 (76 - 200 units)', cap: 125, rate: tariffConfig.slabs[1]?.ratePerUnit || 7.20 },
      { name: 'Slab 3 (201 - 300 units)', cap: 100, rate: tariffConfig.slabs[2]?.ratePerUnit || 7.59 },
      { name: 'Slab 4 (301 - 400 units)', cap: 100, rate: tariffConfig.slabs[3]?.ratePerUnit || 8.02 },
      { name: 'Slab 5 (401 - 600 units)', cap: 200, rate: tariffConfig.slabs[4]?.ratePerUnit || 12.67 },
      { name: 'Slab 6 (Above 600 units)', cap: Infinity, rate: tariffConfig.slabs[5]?.ratePerUnit || 14.61 },
    ];

    for (const slab of slabRanges) {
      if (remainingUnits <= 0) break;
      const unitsInThisSlab = Math.min(remainingUnits, slab.cap);
      const amount = Number((unitsInThisSlab * slab.rate).toFixed(2));
      slabBreakdown.push({
        slabName: slab.name,
        units: unitsInThisSlab,
        rate: slab.rate,
        amount: amount,
      });
      baseEnergyCost += amount;
      remainingUnits -= unitsInThisSlab;
    }
  }

  baseEnergyCost = Number(baseEnergyCost.toFixed(2));
  const demandCharge = Number((sanctionedLoadKW * tariffConfig.demandChargePerKW).toFixed(2));
  const meterRent = Number(tariffConfig.meterRent.toFixed(2));
  const subtotal = Number((baseEnergyCost + demandCharge + meterRent).toFixed(2));

  // 5% Government VAT on subtotal
  const vatAmount = Number(((subtotal * tariffConfig.vatPercentage) / 100).toFixed(2));
  const rebateAmount = tariffConfig.rebatePercentage > 0
    ? Number(((baseEnergyCost * tariffConfig.rebatePercentage) / 100).toFixed(2))
    : 0;

  const totalBill = Math.round(subtotal + vatAmount - rebateAmount);

  return {
    consumedUnits,
    slabBreakdown,
    baseEnergyCost,
    demandCharge,
    meterRent,
    subtotal,
    vatAmount,
    rebateAmount,
    totalBill,
    sanctionedLoadKW,
    tariffConfigSnapshot: tariffConfig,
  };
}

/**
 * Bangladeshi Taka Currency Formatter (BDT / ৳)
 */
export function formatBDT(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '৳0';
  return `৳${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Format Date to DD-MM-YYYY as strictly required by prompt
 */
export function formatDateDDMMYYYY(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || `Month ${monthNumber}`;
}
