import {
  UserProfile,
  Block,
  Unit,
  Tenant,
  AdvanceAccount,
  AdvanceTransaction,
  MonthlyLedgerItem,
  MeterReading,
  ElectricityBill,
  PaymentTransaction,
  PrintableReceipt,
  Complaint,
  ChatMessage,
  OnlinePaymentRequest,
  AuditLog,
  PaymentSettings,
  BlockMfsConfig,
  NescoTariffConfig,
  PaymentStatus,
  AppDatabaseState,
} from '../types';
import { DEFAULT_NESCO_TARIFF, calculateNescoElectricityBill } from './nescoTariff';
import { COMPLEX_CONFIG } from './complexConfig';

// Initial Authority Accounts
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user-manager-russell',
    email: 'akandarussell@gmail.com',
    fullName: 'Russell (Manager)',
    phone: COMPLEX_CONFIG.managerPhone, // 01737-321998
    role: 'manager',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-rashed-a',
    email: 'rashed.blocka@mbdapartment.com',
    fullName: 'Rashed (Block A Owner)',
    phone: '01712-345678',
    role: 'owner',
    assignedBlock: 'Block A',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-raju-b',
    email: 'raju.blockb@mbdapartment.com',
    fullName: 'Raju (Block B Owner)',
    phone: COMPLEX_CONFIG.rajuPhone, // 01913-858775
    role: 'owner',
    assignedBlock: 'Block B',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-rony-c',
    email: 'rony.blockc@mbdapartment.com',
    fullName: 'Rony (Block C Owner)',
    phone: '01714-567890',
    role: 'owner',
    assignedBlock: 'Block C',
    isActive: true,
    createdAt: '2024-01-01',
  },
];

export const INITIAL_BLOCKS: Block[] = [
  {
    id: 'block-a',
    name: 'Block A',
    ownerId: 'user-owner-rashed-a',
    ownerName: 'Rashed',
    totalFloors: 7,
    totalUnits: 8,
    description: 'Premier residential wing with private lift and generator backup.',
  },
  {
    id: 'block-b',
    name: 'Block B',
    ownerId: 'user-owner-raju-b',
    ownerName: 'Raju',
    totalFloors: 7,
    totalUnits: 7,
    description: 'Central residential block overlooking garden courtyard.',
  },
  {
    id: 'block-c',
    name: 'Block C',
    ownerId: 'user-owner-rony-c',
    ownerName: 'Rony',
    totalFloors: 7,
    totalUnits: 7,
    description: 'Quiet east-facing residential block with rooftop terrace.',
  },
];

export const INITIAL_UNITS: Unit[] = [
  // Block A
  { id: 'u-a1', flatId: 'A1', blockId: 'block-a', blockName: 'Block A', floor: 1, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a2', flatId: 'A2', blockId: 'block-a', blockName: 'Block A', floor: 2, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P1' },
  { id: 'u-a3', flatId: 'A3', blockId: 'block-a', blockName: 'Block A', floor: 3, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a4', flatId: 'A4', blockId: 'block-a', blockName: 'Block A', floor: 4, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, godownSlot: 'G1' },
  { id: 'u-a5', flatId: 'A5', blockId: 'block-a', blockName: 'Block A', floor: 5, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a6', flatId: 'A6', blockId: 'block-a', blockName: 'Block A', floor: 6, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a7', flatId: 'A7', blockId: 'block-a', blockName: 'Block A', floor: 7, unitType: 'residential', monthlyRent: 26000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Block B
  { id: 'u-b1', flatId: 'B1', blockId: 'block-b', blockName: 'Block B', floor: 1, unitType: 'residential', monthlyRent: 21000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b2', flatId: 'B2', blockId: 'block-b', blockName: 'Block B', floor: 2, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P2' },
  { id: 'u-b3', flatId: 'B3', blockId: 'block-b', blockName: 'Block B', floor: 3, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b4', flatId: 'B4', blockId: 'block-b', blockName: 'Block B', floor: 4, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, godownSlot: 'G2' },
  { id: 'u-b5', flatId: 'B5', blockId: 'block-b', blockName: 'Block B', floor: 5, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b6', flatId: 'B6', blockId: 'block-b', blockName: 'Block B', floor: 6, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b7', flatId: 'B7', blockId: 'block-b', blockName: 'Block B', floor: 7, unitType: 'residential', monthlyRent: 25000, isOccupied: false, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Block C
  { id: 'u-c1', flatId: 'C1', blockId: 'block-c', blockName: 'Block C', floor: 1, unitType: 'residential', monthlyRent: 20000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c2', flatId: 'C2', blockId: 'block-c', blockName: 'Block C', floor: 2, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P3' },
  { id: 'u-c3', flatId: 'C3', blockId: 'block-c', blockName: 'Block C', floor: 3, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c4', flatId: 'C4', blockId: 'block-c', blockName: 'Block C', floor: 4, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c5-owner', flatId: 'C5 Owner', blockId: 'block-c', blockName: 'Block C', floor: 5, unitType: 'residential', monthlyRent: 0, isOccupied: true, electricityBillingType: 'fixed', isElectricityEnabled: false, fixedElectricityAmount: 0, notes: 'Owner residence' },
  { id: 'u-c6', flatId: 'C6', blockId: 'block-c', blockName: 'Block C', floor: 6, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c7', flatId: 'C7', blockId: 'block-c', blockName: 'Block C', floor: 7, unitType: 'residential', monthlyRent: 25000, isOccupied: false, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Parking & Godowns (Flats and Godowns can be toggled ON/OFF; Parking has no electricity)
  { id: 'u-p1', flatId: 'P1', blockId: 'block-a', blockName: 'Block A', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-p2', flatId: 'P2', blockId: 'block-b', blockName: 'Block B', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-p3', flatId: 'P3', blockId: 'block-c', blockName: 'Block C', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-g1', flatId: 'G1', blockId: 'block-a', blockName: 'Block A', floor: 0, unitType: 'godown', monthlyRent: 6000, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-g2', flatId: 'G2', blockId: 'block-b', blockName: 'Block B', floor: 0, unitType: 'godown', monthlyRent: 6000, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
];

export const INITIAL_TENANTS: Tenant[] = [
  { id: 't-a1', unitId: 'u-a1', flatId: 'A1', blockName: 'Block A', fullName: 'SHOJIB', phone: '8801650000000', nidNumber: '19842691234567891', email: 'shojib.a1@gmail.com', entryDate: '2024-11-01', emergencyContact: '8801650000000', status: 'active' },
  { id: 't-a2', unitId: 'u-a2', flatId: 'A2', blockName: 'Block A', fullName: 'MAMUN', phone: '8801310000000', nidNumber: '19902692345678902', email: 'mamun.a2@gmail.com', entryDate: '2026-05-01', emergencyContact: '8801310000000', status: 'active' },
  { id: 't-a3', unitId: 'u-a3', flatId: 'A3', blockName: 'Block A', fullName: 'SHARIFUL', phone: '8801760000000', nidNumber: '19882693456789013', email: 'shariful.a3@gmail.com', entryDate: '2024-07-01', emergencyContact: '8801760000000', status: 'active' },
  { id: 't-a4', unitId: 'u-a4', flatId: 'A4', blockName: 'Block A', fullName: 'MST. SABI', phone: '8801700000000', nidNumber: '19922694567890124', email: 'sabi.a4@gmail.com', entryDate: '2025-08-01', emergencyContact: '8801700000000', status: 'active' },
  { id: 't-a5', unitId: 'u-a5', flatId: 'A5', blockName: 'Block A', fullName: 'RASHED V', phone: '8801720000000', nidNumber: '19852695678901235', email: 'rashed.a5@gmail.com', entryDate: '2025-08-01', emergencyContact: '8801720000000', status: 'active' },
  { id: 't-a6', unitId: 'u-a6', flatId: 'A6', blockName: 'Block A', fullName: 'SUMAIYA', phone: '8801310000000', nidNumber: '19872696789012346', email: 'sumaiya.a6@gmail.com', entryDate: '2024-06-03', emergencyContact: '8801310000000', status: 'active' },
  { id: 't-a7', unitId: 'u-a7', flatId: 'A7', blockName: 'Block A', fullName: 'GERMAN A', phone: '8801740000000', nidNumber: '19932697890123457', email: 'german.a7@gmail.com', entryDate: '2025-10-14', emergencyContact: '8801740000000', status: 'active' },

  { id: 't-b1', unitId: 'u-b1', flatId: 'B1', blockName: 'Block B', fullName: 'Al-Amin Hossain', phone: '01720-123456', nidNumber: '19862697890123457', email: 'alamin.b1@gmail.com', entryDate: '2024-02-01', emergencyContact: '01720-987654 (Cousin)', status: 'active' },
  { id: 't-b2', unitId: 'u-b2', flatId: 'B2', blockName: 'Block B', fullName: 'Md. Delwar Hossain', phone: '01821-234567', nidNumber: '19832698901234568', email: 'delwar.b2@gmail.com', entryDate: '2024-01-10', emergencyContact: '01821-876543 (Son)', status: 'active' },
  { id: 't-b3', unitId: 'u-b3', flatId: 'B3', blockName: 'Block B', fullName: 'Farhana Begum', phone: '01922-345678', nidNumber: '19912699012345679', email: 'farhana.b3@gmail.com', entryDate: '2024-05-01', emergencyContact: '01922-765432 (Husband)', status: 'active' },
  { id: 't-b4', unitId: 'u-b4', flatId: 'B4', blockName: 'Block B', fullName: 'Tariqul Islam Tushar', phone: '01623-456789', nidNumber: '19942690123456780', email: 'tariq.b4@gmail.com', entryDate: '2024-03-15', emergencyContact: '01623-654321 (Brother)', status: 'active' },
  { id: 't-b5', unitId: 'u-b5', flatId: 'B5', blockName: 'Block B', fullName: 'Sajjad Hossain Mollah', phone: '01524-567890', nidNumber: '19892691234567891', email: 'sajjad.b5@gmail.com', entryDate: '2024-04-10', emergencyContact: '01524-543210 (Father)', status: 'active' },
  { id: 't-b6', unitId: 'u-b6', flatId: 'B6', blockName: 'Block B', fullName: 'Ashikur Rahman', phone: '01725-678901', nidNumber: '19932692345678902', email: 'ashik.b6@gmail.com', entryDate: '2024-02-15', emergencyContact: '01725-432109 (Mother)', status: 'active' },

  { id: 't-c1', unitId: 'u-c1', flatId: 'C1', blockName: 'Block C', fullName: 'Golam Mostafa', phone: '01730-112244', nidNumber: '19822693456789013', email: 'mostafa.c1@gmail.com', entryDate: '2024-01-01', emergencyContact: '01730-998866 (Wife)', status: 'active' },
  { id: 't-c2', unitId: 'u-c2', flatId: 'C2', blockName: 'Block C', fullName: 'Mizanur Rahman Kiron', phone: '01831-223355', nidNumber: '19852694567890124', email: 'mizan.c2@gmail.com', entryDate: '2024-03-01', emergencyContact: '01831-887755 (Brother)', status: 'active' },
  { id: 't-c3', unitId: 'u-c3', flatId: 'C3', blockName: 'Block C', fullName: 'Zahidul Haque Shamim', phone: '01932-334466', nidNumber: '19922695678901235', email: 'zahid.c3@gmail.com', entryDate: '2024-02-01', emergencyContact: '01932-776644 (Sister)', status: 'active' },
  { id: 't-c4', unitId: 'u-c4', flatId: 'C4', blockName: 'Block C', fullName: 'Moniruzzaman Monir', phone: '01633-445577', nidNumber: '19882696789012346', email: 'monir.c4@gmail.com', entryDate: '2024-04-15', emergencyContact: '01633-665533 (Cousin)', status: 'active' },
  { id: 't-c6', unitId: 'u-c6', flatId: 'C6', blockName: 'Block C', fullName: 'Nasir Uddin Patwary', phone: '01735-667799', nidNumber: '19902697890123457', email: 'nasir.c6@gmail.com', entryDate: '2024-01-20', emergencyContact: '01735-443311 (Father)', status: 'active' },
];

export const INITIAL_ADVANCE_ACCOUNTS: AdvanceAccount[] = [
  { id: 'adv-a1', tenantId: 't-a1', unitId: 'u-a1', flatId: 'A1', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-01-15', updatedAt: '2024-01-15' },
  { id: 'adv-a2', tenantId: 't-a2', unitId: 'u-a2', flatId: 'A2', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-03-01', updatedAt: '2024-03-01' },
  { id: 'adv-a3', tenantId: 't-a3', unitId: 'u-a3', flatId: 'A3', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-02-10', updatedAt: '2024-02-10' },
  { id: 'adv-a4', tenantId: 't-a4', unitId: 'u-a4', flatId: 'A4', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2025-08-01', updatedAt: '2025-08-01' },
  { id: 'adv-a5', tenantId: 't-a5', unitId: 'u-a5', flatId: 'A5', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2025-08-01', updatedAt: '2025-08-01' },
  { id: 'adv-a6', tenantId: 't-a6', unitId: 'u-a6', flatId: 'A6', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2024-06-03', updatedAt: '2024-06-03' },
  { id: 'adv-a7', tenantId: 't-a7', unitId: 'u-a7', flatId: 'A7', totalRequired: 52000, amountPaid: 52000, remainingAdvance: 52000, status: 'paid', lastPaymentDate: '2025-10-14', updatedAt: '2025-10-14' },

  { id: 'adv-b1', tenantId: 't-b1', unitId: 'u-b1', flatId: 'B1', totalRequired: 42000, amountPaid: 42000, remainingAdvance: 42000, status: 'paid', lastPaymentDate: '2024-02-01', updatedAt: '2024-02-01' },
  { id: 'adv-b2', tenantId: 't-b2', unitId: 'u-b2', flatId: 'B2', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-01-10', updatedAt: '2024-01-10' },
  { id: 'adv-b3', tenantId: 't-b3', unitId: 'u-b3', flatId: 'B3', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-05-01', updatedAt: '2024-05-01' },
  { id: 'adv-b4', tenantId: 't-b4', unitId: 'u-b4', flatId: 'B4', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-03-15', updatedAt: '2024-03-15' },
  { id: 'adv-b5', tenantId: 't-b5', unitId: 'u-b5', flatId: 'B5', totalRequired: 48000, amountPaid: 25000, remainingAdvance: 25000, status: 'partially_paid', lastPaymentDate: '2024-04-10', updatedAt: '2024-04-10' },
  { id: 'adv-b6', tenantId: 't-b6', unitId: 'u-b6', flatId: 'B6', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2024-02-15', updatedAt: '2024-02-15' },

  { id: 'adv-c1', tenantId: 't-c1', unitId: 'u-c1', flatId: 'C1', totalRequired: 40000, amountPaid: 40000, remainingAdvance: 40000, status: 'paid', lastPaymentDate: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'adv-c2', tenantId: 't-c2', unitId: 'u-c2', flatId: 'C2', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-03-01', updatedAt: '2024-03-01' },
  { id: 'adv-c3', tenantId: 't-c3', unitId: 'u-c3', flatId: 'C3', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-02-01', updatedAt: '2024-02-01' },
  { id: 'adv-c4', tenantId: 't-c4', unitId: 'u-c4', flatId: 'C4', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-04-15', updatedAt: '2024-04-15' },
  { id: 'adv-c6', tenantId: 't-c6', unitId: 'u-c6', flatId: 'C6', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-01-20', updatedAt: '2024-01-20' },
];

export const INITIAL_ADVANCE_TRANSACTIONS: AdvanceTransaction[] = [
  { id: 'atx-1', advanceAccountId: 'adv-a1', tenantId: 't-a1', tenantName: 'Engr. Mahbubur Rahman', flatId: 'A1', amount: 44000, type: 'deposit', paymentDate: '2024-01-15', paymentMethod: 'Bank Transfer', receiptNo: 'ADV-2024-001', transactionId: 'TXN-IBBL-98124', notes: '2 months security deposit', recordedBy: 'Manager Russell', createdAt: '2024-01-15' },
  { id: 'atx-2', advanceAccountId: 'adv-a2', tenantId: 't-a2', tenantName: 'Tanvir Ahmed Chy', flatId: 'A2', amount: 48000, type: 'deposit', paymentDate: '2024-03-01', paymentMethod: 'Cash', receiptNo: 'ADV-2024-002', notes: 'Security advance paid in cash', recordedBy: 'Manager Russell', createdAt: '2024-03-01' },
  { id: 'atx-3', advanceAccountId: 'adv-b3', tenantId: 't-b3', tenantName: 'Farhana Begum', flatId: 'B3', amount: 46000, type: 'deposit', paymentDate: '2024-05-01', paymentMethod: 'bKash', receiptNo: 'ADV-2024-003', transactionId: 'BK-99214A', notes: 'bKash Merchant Payment', recordedBy: 'Manager Russell', createdAt: '2024-05-01' },
];

// Previous Month (September 2026) Meter Readings & Electricity Bills
// Postpaid rule: Sep consumption bill is billed & paid in Oct collection ledger!
export const INITIAL_METER_READINGS: MeterReading[] = [
  // Aug -> Sep readings (for Sep electricity consumption)
  { id: 'mr-a1-sep', unitId: 'u-a1', flatId: 'A1', month: 9, year: 2026, previousReading: 2150, currentReading: 2365, consumedUnits: 215, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a2-sep', unitId: 'u-a2', flatId: 'A2', month: 9, year: 2026, previousReading: 1820, currentReading: 2110, consumedUnits: 290, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a3-sep', unitId: 'u-a3', flatId: 'A3', month: 9, year: 2026, previousReading: 3100, currentReading: 3340, consumedUnits: 240, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a4-sep', unitId: 'u-a4', flatId: 'A4', month: 9, year: 2026, previousReading: 1450, currentReading: 1775, consumedUnits: 325, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a6-sep', unitId: 'u-a6', flatId: 'A6', month: 9, year: 2026, previousReading: 2600, currentReading: 2880, consumedUnits: 280, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },

  { id: 'mr-b1-sep', unitId: 'u-b1', flatId: 'B1', month: 9, year: 2026, previousReading: 1980, currentReading: 2175, consumedUnits: 195, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b2-sep', unitId: 'u-b2', flatId: 'B2', month: 9, year: 2026, previousReading: 3200, currentReading: 3460, consumedUnits: 260, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b3-sep', unitId: 'u-b3', flatId: 'B3', month: 9, year: 2026, previousReading: 1540, currentReading: 1765, consumedUnits: 225, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b4-sep', unitId: 'u-b4', flatId: 'B4', month: 9, year: 2026, previousReading: 2100, currentReading: 2380, consumedUnits: 280, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b5-sep', unitId: 'u-b5', flatId: 'B5', month: 9, year: 2026, previousReading: 1720, currentReading: 1930, consumedUnits: 210, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b6-sep', unitId: 'u-b6', flatId: 'B6', month: 9, year: 2026, previousReading: 2890, currentReading: 3190, consumedUnits: 300, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },

  { id: 'mr-c1-sep', unitId: 'u-c1', flatId: 'C1', month: 9, year: 2026, previousReading: 1800, currentReading: 1995, consumedUnits: 195, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c2-sep', unitId: 'u-c2', flatId: 'C2', month: 9, year: 2026, previousReading: 2310, currentReading: 2540, consumedUnits: 230, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c3-sep', unitId: 'u-c3', flatId: 'C3', month: 9, year: 2026, previousReading: 1420, currentReading: 1650, consumedUnits: 230, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c4-sep', unitId: 'u-c4', flatId: 'C4', month: 9, year: 2026, previousReading: 2050, currentReading: 2310, consumedUnits: 260, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c6-sep', unitId: 'u-c6', flatId: 'C6', month: 9, year: 2026, previousReading: 3100, currentReading: 3375, consumedUnits: 275, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
];

// Electricity Bills for September consumption applied in October 2026 collection ledger
export function generateInitialElectricityBills(): ElectricityBill[] {
  return INITIAL_METER_READINGS.map((mr) => {
    const calc = calculateNescoElectricityBill(mr.currentReading, mr.previousReading, DEFAULT_NESCO_TARIFF, 2);
    const tenant = INITIAL_TENANTS.find((t) => t.flatId === mr.flatId);
    return {
      id: `eb-${mr.flatId.toLowerCase()}-sep2026`,
      unitId: mr.unitId,
      flatId: mr.flatId,
      tenantId: tenant?.id || '',
      tenantName: tenant?.fullName || 'N/A',
      consumptionMonth: 9,
      consumptionYear: 2026,
      billingMonth: 10,
      billingYear: 2026,
      previousReading: mr.previousReading,
      currentReading: mr.currentReading,
      consumedUnits: mr.consumedUnits,
      slabBreakdown: calc.slabBreakdown,
      baseEnergyCost: calc.baseEnergyCost,
      demandCharge: calc.demandCharge,
      vatAmount: calc.vatAmount,
      meterRent: calc.meterRent,
      rebateAmount: calc.rebateAmount,
      totalBill: calc.totalBill,
      paidAmount: mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? calc.totalBill : 0,
      dueAmount: mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? 0 : calc.totalBill,
      paymentStatus: (mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? 'Paid' : 'Not Paid') as PaymentStatus,
      generatedDate: '2026-10-01',
      receiptNo: mr.flatId === 'A1' ? 'REC-ELEC-2026-10-A1' : undefined,
      tariffSnapshotTitle: DEFAULT_NESCO_TARIFF.title,
    };
  });
}

// Initial Main Monthly Financial Ledger for Current Month (October 2026)
export function generateInitialLedger(month: number = 10, year: number = 2026): MonthlyLedgerItem[] {
  const bills = generateInitialElectricityBills();

  return INITIAL_UNITS.map((unit) => {
    const tenant = INITIAL_TENANTS.find((t) => t.flatId === unit.flatId);
    const advance = INITIAL_ADVANCE_ACCOUNTS.find((a) => a.flatId === unit.flatId);
    const elecBill = bills.find((b) => b.flatId === unit.flatId);

    const flatRent = unit.monthlyRent;
    const electricityAmount = unit.electricityBillingType === 'fixed'
      ? (unit.fixedElectricityAmount || 0)
      : (elecBill ? elecBill.totalBill : 0);

    const parkingRent = unit.parkingSlot ? 2500 : 0;
    const godownRent = unit.godownSlot ? 6000 : 0;

    const totalPayable = flatRent + electricityAmount + parkingRent + godownRent;

    // Simulate payment statuses for October 2026
    let totalPaid = 0;
    let paymentStatus: PaymentStatus = 'Not Paid';
    let adjustedFromAdvance = 0;
    let lastPaymentDate: string | undefined = undefined;

    if (!unit.isOccupied) {
      paymentStatus = 'N/A';
    } else if (unit.flatId === 'A5 Owner' || unit.flatId === 'C5 Owner') {
      paymentStatus = 'N/A';
    } else if (unit.flatId === 'A1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-03';
    } else if (unit.flatId === 'A2') {
      totalPaid = 15000; // partial
      paymentStatus = 'Partially Paid';
      lastPaymentDate = '2026-10-05';
    } else if (unit.flatId === 'B1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-04';
    } else if (unit.flatId === 'B3') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-02';
    } else if (unit.flatId === 'C1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-06';
    } else if (unit.flatId === 'C6') {
      // Adjusted from advance
      adjustedFromAdvance = flatRent;
      totalPaid = totalPayable;
      paymentStatus = 'Adjusted';
      lastPaymentDate = '2026-10-01';
    } else {
      totalPaid = 0;
      paymentStatus = 'Not Paid';
    }

    const totalDue = Math.max(0, totalPayable - totalPaid);
    const cleanFlatId = unit.flatId.replace(/^u-/, '').trim();
    const blockKey =
      unit.blockName === 'Block A'
        ? 'blockA'
        : unit.blockName === 'Block B'
        ? 'blockB'
        : unit.blockName === 'Block C'
        ? 'blockC'
        : cleanFlatId.startsWith('A')
        ? 'blockA'
        : cleanFlatId.startsWith('B')
        ? 'blockB'
        : cleanFlatId.startsWith('C')
        ? 'blockC'
        : 'blockA';

    return {
      id: `led-${unit.flatId.toLowerCase()}-${month}-${year}`,
      unitId: unit.id,
      flatId: unit.flatId,
      blockName: unit.blockName,
      blockKey,
      tenantId: tenant?.id || '',
      tenantName: tenant ? tenant.fullName : (unit.flatId.includes('Owner') ? 'Owner Occupied' : 'Vacant Flat'),
      tenantPhone: tenant?.phone || 'N/A',
      entryDate: tenant?.entryDate || 'N/A',
      billingPeriod: `${year}-${String(month).padStart(2, '0')}`,
      month,
      year,
      advancePayment: advance?.amountPaid || 0,
      flatRent,
      electricityBill: electricityAmount,
      parkingRent,
      godownRent,
      totalPayable,
      totalPaid,
      totalDue,
      paymentStatus,
      adjustedFromAdvance,
      lastPaymentDate,
    };
  });
}

// Initial Payments
export const INITIAL_PAYMENT_TRANSACTIONS: PaymentTransaction[] = [
  { id: 'ptxn-01', receiptNo: 'REC-2026-10-A1', tenantId: 't-a1', tenantName: 'Engr. Mahbubur Rahman', flatId: 'A1', category: 'Combined', month: 10, year: 2026, amount: 23850, paymentMethod: 'Bank Transfer', transactionId: 'IBBL-OCT-88912', paymentDate: '2026-10-03', verificationStatus: 'Verified', recordedBy: 'Manager Russell', notes: 'Rent & Electricity' , createdAt: '2026-10-03' },
  { id: 'ptxn-02', receiptNo: 'REC-2026-10-A2', tenantId: 't-a2', tenantName: 'Tanvir Ahmed Chy', flatId: 'A2', category: 'Flat Rent', month: 10, year: 2026, amount: 15000, paymentMethod: 'bKash', transactionId: 'BK912903AA', paymentDate: '2026-10-05', verificationStatus: 'Verified', recordedBy: 'Manager Russell', notes: 'Partial rent payment', createdAt: '2026-10-05' },
  { id: 'ptxn-03', receiptNo: 'REC-2026-10-B1', tenantId: 't-b1', tenantName: 'Al-Amin Hossain', flatId: 'B1', category: 'Combined', month: 10, year: 2026, amount: 22680, paymentMethod: 'Cash', paymentDate: '2026-10-04', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-04' },
  { id: 'ptxn-04', receiptNo: 'REC-2026-10-B3', tenantId: 't-b3', tenantName: 'Farhana Begum', flatId: 'B3', category: 'Combined', month: 10, year: 2026, amount: 24920, paymentMethod: 'bKash', transactionId: 'BK778811XX', paymentDate: '2026-10-02', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-02' },
  { id: 'ptxn-05', receiptNo: 'REC-2026-10-C1', tenantId: 't-c1', tenantName: 'Golam Mostafa', flatId: 'C1', category: 'Combined', month: 10, year: 2026, amount: 21680, paymentMethod: 'Nagad', transactionId: 'NG66224411', paymentDate: '2026-10-06', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-06' },
];

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'comp-1',
    tenantId: 't-a2',
    tenantName: 'Tanvir Ahmed Chy',
    flatId: 'A2',
    blockName: 'Block A',
    category: 'Water',
    subject: 'Low water pressure in master bathroom',
    description: 'Since yesterday evening, the rooftop overhead tank water pressure is very slow in the master bath faucet.',
    submissionDate: '2026-10-04T10:30:00Z',
    status: 'In Progress',
    assignedTo: 'Plumber Abdul Kalam',
    messages: [
      { id: 'cm-1', senderName: 'Tanvir Ahmed Chy', senderRole: 'tenant', message: 'Please send the plumber in the afternoon after 3 PM if possible.', timestamp: '2026-10-04T10:32:00Z' },
      { id: 'cm-2', senderName: 'Russell (Manager)', senderRole: 'manager', message: 'Abdul Kalam is assigned and will inspect the pressure valve at 3:30 PM today.', timestamp: '2026-10-04T11:15:00Z' },
    ],
  },
  {
    id: 'comp-2',
    tenantId: 't-b3',
    tenantName: 'Farhana Begum',
    flatId: 'B3',
    blockName: 'Block B',
    category: 'Electricity',
    subject: 'Corridor emergency light flickering',
    description: 'The 3rd floor corridor emergency tube light flickers continuously during generator changeover.',
    submissionDate: '2026-10-02T14:00:00Z',
    status: 'Resolved',
    assignedTo: 'Electrician Nurul',
    messages: [
      { id: 'cm-3', senderName: 'Russell (Manager)', senderRole: 'manager', message: 'Replaced ballast and starter on 2nd Oct evening. Tested with generator load successfully.', timestamp: '2026-10-02T18:00:00Z' },
    ],
  },
  {
    id: 'comp-3',
    tenantId: 't-c4',
    tenantName: 'Moniruzzaman Monir',
    flatId: 'C4',
    blockName: 'Block C',
    category: 'Lift',
    subject: 'Lift door sensor sensitivity in Block C',
    description: 'Lift doors close too quickly before elder passengers can comfortably enter.',
    submissionDate: '2026-10-05T09:15:00Z',
    status: 'Submitted',
    messages: [],
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'msg-1', conversationId: 'conv-a2', senderId: 'user-manager-russell', senderName: 'Russell (Manager)', senderRole: 'manager', recipientId: 't-a2', message: 'Assalamu Alaikum Tanvir bhai, October electricity bill of September consumption has been published.', timestamp: '2026-10-01T10:00:00Z', isRead: true },
  { id: 'msg-2', conversationId: 'conv-a2', senderId: 't-a2', senderName: 'Tanvir Ahmed Chy', senderRole: 'tenant', recipientId: 'user-manager-russell', message: 'Walaikum Assalam Russell bhai. I have made partial payment of 15,000 via bKash. Will clear the rest on Sunday.', timestamp: '2026-10-05T12:00:00Z', isRead: true },
  { id: 'msg-3', conversationId: 'conv-a2', senderId: 'user-manager-russell', senderName: 'Russell (Manager)', senderRole: 'manager', recipientId: 't-a2', message: 'Received and verified. Your payment receipt is available to download.', timestamp: '2026-10-05T12:05:00Z', isRead: false },
  { id: 'msg-4', conversationId: 'conv-b3', senderId: 't-b3', senderName: 'Farhana Begum', senderRole: 'tenant', recipientId: 'user-owner-raju-b', message: 'Assalamu Alaikum Raju bhai, October total payable has been sent via bKash merchant payment.', timestamp: '2026-10-02T15:20:00Z', isRead: true },
  { id: 'msg-5', conversationId: 'conv-b3', senderId: 'user-owner-raju-b', senderName: 'Raju (Block B Owner)', senderRole: 'owner', recipientId: 't-b3', message: 'Thank you Bhabi. The system ledger has recorded your payment status as Paid.', timestamp: '2026-10-02T15:35:00Z', isRead: true },
];

export const INITIAL_BLOCK_MFS_CONFIGS: Record<'Block A' | 'Block B' | 'Block C', BlockMfsConfig> = {
  'Block A': {
    blockName: 'Block A',
    ownerId: 'user-owner-rashed-a',
    ownerName: 'Rashed',
    ownerPhone: '01712-345678',
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: '01712-345678',
    bkashType: 'Personal',
    nagadNumber: '01712-345678',
    nagadType: 'Personal',
    rocketNumber: '01712-345678-0',
    rocketType: 'Personal',
    instructions: 'Send Money to Block A Owner Rashed. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
  'Block B': {
    blockName: 'Block B',
    ownerId: 'user-owner-raju-b',
    ownerName: 'Raju',
    ownerPhone: COMPLEX_CONFIG.rajuPhone, // 01913-858775
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: COMPLEX_CONFIG.rajuPhone,
    bkashType: 'Personal',
    nagadNumber: COMPLEX_CONFIG.rajuPhone,
    nagadType: 'Personal',
    rocketNumber: `${COMPLEX_CONFIG.rajuPhone}-0`,
    rocketType: 'Personal',
    instructions: 'Send Money to Block B Owner Raju. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
  'Block C': {
    blockName: 'Block C',
    ownerId: 'user-owner-rony-c',
    ownerName: 'Rony',
    ownerPhone: '01714-567890',
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: '01714-567890',
    bkashType: 'Personal',
    nagadNumber: '01714-567890',
    nagadType: 'Personal',
    rocketNumber: '01714-567890-0',
    rocketType: 'Personal',
    instructions: 'Send Money to Block C Owner Rony. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
};

export const INITIAL_PAYMENT_SETTINGS: PaymentSettings = {
  bkashEnabled: true,
  bkashNumber: `${COMPLEX_CONFIG.managerPhone} (Manager Russell)`,
  nagadEnabled: true,
  nagadNumber: `${COMPLEX_CONFIG.rajuPhone} (Raju - Block B Owner)`,
  rocketEnabled: true,
  rocketNumber: `${COMPLEX_CONFIG.managerPhone}-0 (Manager)`,
  bankEnabled: true,
  bankName: 'Islami Bank Bangladesh Ltd (Rajshahi Branch)',
  bankAccountNo: '2050 3219 9801 8587',
  bankRouting: 'IBBLBDRJ050',
  blockConfigs: INITIAL_BLOCK_MFS_CONFIGS,
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-1', action: 'CREATE_BILL', entity: 'ElectricityBill', entityId: 'eb-all-sep2026', performedBy: 'Manager Russell', userRole: 'manager', details: 'Generated September 2026 postpaid NESCO electricity bills for 17 flats in Ma Babar Doa Apartment Complex', timestamp: '2026-10-01T09:00:00Z' },
  { id: 'log-2', action: 'RECORD_PAYMENT', entity: 'PaymentTransaction', entityId: 'ptxn-01', performedBy: 'Manager Russell', userRole: 'manager', details: 'Verified bank payment of ৳23,850 for Flat A1', timestamp: '2026-10-03T14:20:00Z' },
  { id: 'log-3', action: 'ADJUST_ADVANCE', entity: 'MonthlyLedger', entityId: 'led-c6-10-2026', performedBy: 'Manager Russell', userRole: 'manager', details: 'Adjusted rent of ৳24,000 from available advance balance for Flat C6 (departure notice month)', timestamp: '2026-10-01T11:45:00Z' },
];

// Persistent App State Engine
const STORAGE_KEY = 'ams_mbd_v2_database';

export function getInitialDatabaseState(): AppDatabaseState {
  return {
    profiles: INITIAL_PROFILES,
    blocks: INITIAL_BLOCKS,
    units: INITIAL_UNITS,
    tenants: INITIAL_TENANTS,
    advanceAccounts: INITIAL_ADVANCE_ACCOUNTS,
    advanceTransactions: INITIAL_ADVANCE_TRANSACTIONS,
    ledgerItems: [
      ...generateInitialLedger(8, 2026),
      ...generateInitialLedger(10, 2026),
    ],
    meterReadings: INITIAL_METER_READINGS,
    electricityBills: generateInitialElectricityBills(),
    payments: INITIAL_PAYMENT_TRANSACTIONS,
    complaints: INITIAL_COMPLAINTS,
    chatMessages: INITIAL_CHAT_MESSAGES,
    onlineRequests: [
      {
        id: 'onl-1',
        tenantId: 't-b4',
        tenantName: 'Tariqul Islam Tushar',
        flatId: 'B4',
        month: 10,
        year: 2026,
        category: 'Combined Bill (Rent + Elec)',
        amount: 26500,
        paymentMethod: 'bKash',
        transactionId: 'BK99482103',
        submissionDate: '2026-10-05T16:20:00Z',
        verificationStatus: 'Pending',
        notes: 'Submitted via bKash app',
      }
    ],
    paymentSettings: INITIAL_PAYMENT_SETTINGS,
    tariffConfig: DEFAULT_NESCO_TARIFF,
    auditLogs: INITIAL_AUDIT_LOGS,
    selectedMonth: 8,
    selectedYear: 2026,
  };
}

export function loadDatabaseState(): AppDatabaseState {
  if (typeof window === 'undefined') return getInitialDatabaseState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialDatabaseState();
      saveDatabaseState(initial);
      return initial;
    }
    const parsed: AppDatabaseState = JSON.parse(raw);
    if (parsed) {
      if (Array.isArray(parsed.units)) {
        parsed.units = parsed.units.map((u) => ({
          ...u,
          isElectricityEnabled:
            u.isElectricityEnabled !== undefined
              ? u.isElectricityEnabled
              : u.unitType === 'parking'
              ? false
              : u.flatId.includes('Owner')
              ? false
              : u.electricityBillingType === 'nesco_submeter',
        }));
        // Ensure Block A units have A1-A7
        const hasA5 = parsed.units.some((u) => u.flatId === 'A5');
        if (!hasA5) {
          parsed.units = parsed.units.filter((u) => !(u.blockName === 'Block A' || u.flatId.startsWith('A')));
          parsed.units.unshift(...INITIAL_UNITS.filter((u) => u.blockName === 'Block A'));
        }
      }
      if (Array.isArray(parsed.tenants)) {
        // Ensure Block A tenants match latest roster
        const hasShojib = parsed.tenants.some((t) => t.flatId === 'A1' && t.fullName === 'SHOJIB');
        if (!hasShojib) {
          parsed.tenants = parsed.tenants.filter((t) => !(t.blockName === 'Block A' || t.flatId.startsWith('A')));
          parsed.tenants.unshift(...INITIAL_TENANTS.filter((t) => t.blockName === 'Block A'));
        }
      }
      if (Array.isArray(parsed.ledgerItems)) {
        const hasAugShojib = parsed.ledgerItems.some(
          (i) => i.month === 8 && i.year === 2026 && i.flatId === 'A1' && i.tenantName === 'SHOJIB'
        );
        if (!hasAugShojib) {
          const augItems = generateInitialLedger(8, 2026);
          parsed.ledgerItems = [
            ...parsed.ledgerItems.filter((i) => !(i.month === 8 && i.year === 2026)),
            ...augItems,
          ];
        }
      }
    }
    if (parsed && parsed.paymentSettings) {
      parsed.paymentSettings.blockConfigs = {
        ...INITIAL_BLOCK_MFS_CONFIGS,
        ...(parsed.paymentSettings.blockConfigs || {}),
      };
    }
    return parsed;
  } catch (e) {
    console.error('Error loading database state from storage:', e);
    return getInitialDatabaseState();
  }
}

export function saveDatabaseState(state: AppDatabaseState): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save database state to localStorage:', e);
    }
    // Asynchronously persist to server database file
    saveDatabaseToServer(state).catch((err) => {
      console.warn('Failed background save to server:', err);
    });
  }
}

export async function fetchDatabaseFromServer(): Promise<AppDatabaseState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/database');
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.success && json.data) {
      const serverData = json.data as AppDatabaseState;
      // Sync local storage with latest server database
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
      } catch (e) {}
      return serverData;
    }
  } catch (err) {
    console.warn('Could not fetch database from server, using local cache:', err);
  }
  return null;
}

export async function saveDatabaseToServer(state: AppDatabaseState): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save database to server:', err);
    return false;
  }
}

export function resetDatabaseToDefault(): AppDatabaseState {
  const defaultState = getInitialDatabaseState();
  saveDatabaseState(defaultState);
  return defaultState;
}
