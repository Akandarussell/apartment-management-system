import React, { useState, useEffect } from 'react';
import {
  Building2,
  LayoutDashboard,
  FileSpreadsheet,
  Wallet,
  Zap,
  Car,
  Warehouse,
  MessageSquare,
  AlertCircle,
  CreditCard,
  Settings,
  Users,
  History,
  Database,
  Printer,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Menu,
  X,
  Bell,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Home,
  User,
  ExternalLink,
} from 'lucide-react';
import {
  AppDatabaseState,
  UserProfile,
  PrintableReceipt,
  ElectricityBill,
  PaymentMethod,
  PaymentStatus,
  NescoTariffConfig,
  ComplaintCategory,
  ComplaintStatus,
  Unit,
  MonthlyLedgerItem,
  OnlinePaymentRequest,
} from './types';
import {
  loadDatabaseState,
  saveDatabaseState,
  resetDatabaseToDefault,
  INITIAL_PROFILES,
  generateInitialLedger,
  fetchDatabaseFromServer,
} from './lib/storage';
import { formatBDT, getMonthName, calculateNescoElectricityBill } from './lib/nescoTariff';
import { getSupabaseCredentials } from './lib/supabase';
import { COMPLEX_CONFIG } from './lib/complexConfig';
import {
  formatBillingPeriod,
  parseBillingPeriod,
  fetchRemoteMonthlyRentRecords,
  upsertRemoteMonthlyRentRecord,
  upsertBatchRemoteMonthlyRentRecords,
} from './lib/api';

// Components
import { ManagerDashboard } from './components/ManagerDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { MainLedger } from './components/MainLedger';
import { AdvancePaymentManager } from './components/AdvancePaymentManager';
import { ElectricityManager } from './components/ElectricityManager';
import { TenantPortal } from './components/TenantPortal';
import { ComplaintsManager } from './components/ComplaintsManager';
import { ChatSystem } from './components/ChatSystem';
import { OnlinePaymentWorkflow } from './components/OnlinePaymentWorkflow';
import { UnitManager } from './components/UnitManager';
import { UserManagement } from './components/UserManagement';
import { AuditLogView } from './components/AuditLogView';
import { PrintableReceiptModal } from './components/PrintableReceiptModal';
import { PrintableBillModal } from './components/PrintableBillModal';
import { TariffSettingsModal } from './components/TariffSettingsModal';
import { DatabaseSetupModal } from './components/DatabaseSetupModal';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [data, setData] = useState<AppDatabaseState>(() => loadDatabaseState());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mbd_logged_in_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse stored user:', e);
    }
    return null; // Start at Login page
  });
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Active user safe helpers for handlers
  const activeUserFullName = currentUser?.fullName || 'Manager Russell';
  const activeUserRole = currentUser?.role || 'manager';
  const activeUserId = currentUser?.id || 'user-manager-russell';
  const activeUserFlatId = currentUser?.flatId || 'A2';

  // Modals
  const [activeReceipt, setActiveReceipt] = useState<PrintableReceipt | null>(null);
  const [activeBill, setActiveBill] = useState<ElectricityBill | null>(null);
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // Fetch latest persistent state from server database and Supabase on mount
  useEffect(() => {
    fetchDatabaseFromServer()
      .then((serverData) => {
        const baseData = serverData && serverData.ledgerItems ? serverData : data;
        if (serverData && serverData.ledgerItems) {
          setData(serverData);
        } else {
          saveDatabaseState(data);
        }

        const initialPeriod = formatBillingPeriod(baseData.selectedMonth, baseData.selectedYear);
        fetchRemoteMonthlyRentRecords(initialPeriod)
          .then((remoteRecords) => {
            if (remoteRecords && remoteRecords.length > 0) {
              updateData((prev) => {
                const otherItems = prev.ledgerItems.filter(
                  (i) => !(i.month === baseData.selectedMonth && i.year === baseData.selectedYear)
                );
                return {
                  ...prev,
                  ledgerItems: [...otherItems, ...remoteRecords],
                };
              });
              console.log(`[Supabase Initial Mount] Synced ${remoteRecords.length} records for ${initialPeriod}`);
            }
          })
          .catch((err) => {
            console.warn('[Supabase Initial Load Notice] Using local server state:', err?.message || err);
          });
      })
      .catch((err) => {
        console.warn('Could not sync with server database:', err);
      });
  }, []);

  // Save changes to storage whenever data changes
  const updateData = (updater: (prev: AppDatabaseState) => AppDatabaseState) => {
    setData((prev) => {
      const next = updater(prev);
      saveDatabaseState(next);
      return next;
    });
  };

  // Switch month and year across system (1. Monthly Scoping: fetches from Supabase where billing_period = selectedPeriod)
  const handleUpdateMonthYear = async (month: number, year: number) => {
    const billingPeriod = formatBillingPeriod(month, year);
    console.log(`[Supabase Monthly Scoping] Switching to billing_period = "${billingPeriod}" (${getMonthName(month)} ${year})`);

    updateData((prev) => ({
      ...prev,
      selectedMonth: month,
      selectedYear: year,
    }));

    try {
      const remoteRecords = await fetchRemoteMonthlyRentRecords(billingPeriod);
      if (remoteRecords && remoteRecords.length > 0) {
        updateData((prev) => {
          const otherItems = prev.ledgerItems.filter((i) => !(i.month === month && i.year === year));
          return {
            ...prev,
            ledgerItems: [...otherItems, ...remoteRecords],
          };
        });
        console.log(`[Supabase Monthly Sync] Synced ${remoteRecords.length} records for ${billingPeriod} from Supabase.`);
      } else {
        console.log(
          `[Supabase Monthly Scoping] 0 records found in Supabase for billing_period = "${billingPeriod}". Roster can be cloned from previous month.`
        );
      }
    } catch (err: any) {
      console.warn(`[Supabase Monthly Scoping Notice] Could not sync monthly_rent_records for ${billingPeriod}:`, err?.message || err);
    }
  };

  // Record Payment
  const handleRecordPayment = (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    category: 'Combined' | 'Flat Rent' | 'Electricity' | 'Parking' | 'Godown',
    transactionId?: string,
    notes?: string
  ) => {
    updateData((prev) => {
      const receiptNo = `REC-${flatId}-${prev.selectedMonth}-${Date.now().toString().slice(-4)}`;
      const tenant = prev.tenants.find((t) => t.flatId === flatId);
      const unit = prev.units.find((u) => u.flatId === flatId);

      // Create Payment Transaction
      const newTx = {
        id: `ptxn-${Date.now()}`,
        receiptNo,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        category,
        month: prev.selectedMonth,
        year: prev.selectedYear,
        amount,
        paymentMethod: method,
        transactionId: transactionId || `TX-${Date.now().toString().slice(-6)}`,
        paymentDate: new Date().toISOString().split('T')[0],
        verificationStatus: 'Verified' as const,
        recordedBy: activeUserFullName,
        notes,
        createdAt: new Date().toISOString(),
      };

      // Update Monthly Ledger item with strict monthly scoping
      const currentBillingPeriod = formatBillingPeriod(prev.selectedMonth, prev.selectedYear);
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const newTotalPaid = item.totalPaid + amount;
          const newTotalDue = Math.max(0, item.totalPayable - newTotalPaid);
          let newStatus: PaymentStatus = 'Paid';
          if (newTotalPaid === 0) newStatus = 'Not Paid';
          else if (newTotalDue > 0) newStatus = 'Partially Paid';

          let rentStatus = item.rentStatus;
          let rentPaymentDate = item.rentPaymentDate;
          let electricityStatus = item.electricityStatus;
          let electricityDate = item.electricityDate;

          if (category === 'Flat Rent') {
            rentStatus = newTotalDue === 0 ? 'Paid' : 'Partially Paid';
            rentPaymentDate = newTx.paymentDate;
          } else if (category === 'Electricity') {
            electricityStatus = 'Paid';
            electricityDate = newTx.paymentDate;
          } else if (category === 'Combined') {
            rentStatus = newTotalDue === 0 ? 'Paid' : 'Partially Paid';
            rentPaymentDate = newTx.paymentDate;
            if (item.electricityBill > 0) {
              electricityStatus = 'Paid';
              electricityDate = newTx.paymentDate;
            }
          }

          return {
            ...item,
            billingPeriod: currentBillingPeriod,
            totalPaid: newTotalPaid,
            totalDue: newTotalDue,
            paymentStatus: newStatus,
            rentStatus,
            rentPaymentDate,
            electricityStatus,
            electricityDate,
            lastPaymentDate: newTx.paymentDate,
          };
        }
        return item;
      });

      // Audit Log
      const auditLog = {
        id: `log-${Date.now()}`,
        action: 'RECORD_PAYMENT',
        entity: 'PaymentTransaction',
        entityId: newTx.id,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Recorded payment of ${formatBDT(amount)} via ${method} for Flat ${flatId} in period ${currentBillingPeriod}`,
        timestamp: new Date().toISOString(),
      };

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      const updatedItem = updatedLedger.find(
        (i) => i.flatId === flatId && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert payment for flat ${flatId} (period: ${currentBillingPeriod}):`,
              err
            );
          }
        });
      }

      return {
        ...prev,
        payments: [newTx, ...prev.payments],
        ledgerItems: updatedLedger,
        auditLogs: [auditLog, ...prev.auditLogs],
      };
    });
  };

  // Adjust from Advance
  const handleAdjustFromAdvance = (flatId: string, amount: number, notes?: string) => {
    const advance = data.advanceAccounts.find((a) => a.flatId === flatId);
    if (!advance || advance.amountPaid < amount) {
      return { success: false, message: 'Adjustment exceeds available security advance balance!' };
    }

    updateData((prev) => {
      const receiptNo = `ADJ-${flatId}-${Date.now().toString().slice(-4)}`;
      const tenant = prev.tenants.find((t) => t.flatId === flatId);

      // Deduct from advance account
      const updatedAdvance = prev.advanceAccounts.map((a) => {
        if (a.flatId === flatId) {
          const remainingPaid = a.amountPaid - amount;
          return {
            ...a,
            amountPaid: remainingPaid,
            remainingAdvance: remainingPaid,
            status: remainingPaid <= 0 ? ('not_paid' as const) : ('partially_paid' as const),
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      // Advance Transaction
      const advTx = {
        id: `atx-${Date.now()}`,
        advanceAccountId: advance.id,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        amount,
        type: 'adjustment_deduction' as const,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Advance Adjustment' as PaymentMethod,
        receiptNo,
        notes: notes || 'Rent adjusted from advance deposit',
        recordedBy: activeUserFullName,
        createdAt: new Date().toISOString(),
      };

      // Update Ledger item
      const currentBillingPeriod = formatBillingPeriod(prev.selectedMonth, prev.selectedYear);
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const newTotalPaid = item.totalPaid + amount;
          const newTotalDue = Math.max(0, item.totalPayable - newTotalPaid);
          return {
            ...item,
            billingPeriod: currentBillingPeriod,
            adjustedFromAdvance: item.adjustedFromAdvance + amount,
            totalPaid: newTotalPaid,
            totalDue: newTotalDue,
            rentStatus: (newTotalDue === 0 ? 'Paid' : 'Partially Paid') as any,
            paymentStatus: (newTotalDue === 0 ? 'Adjusted' : 'Partially Paid') as PaymentStatus,
            lastPaymentDate: advTx.paymentDate,
          };
        }
        return item;
      });

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      const updatedItem = updatedLedger.find(
        (i) => i.flatId === flatId && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert advance adjustment for flat ${flatId} (${currentBillingPeriod}):`,
              err
            );
          }
        });
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: 'ADJUST_ADVANCE',
        entity: 'MonthlyLedger',
        entityId: flatId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Adjusted rent of ${formatBDT(amount)} from advance balance for Flat ${flatId} in period ${currentBillingPeriod}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        advanceAccounts: updatedAdvance,
        advanceTransactions: [advTx, ...prev.advanceTransactions],
        ledgerItems: updatedLedger,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    return { success: true, message: 'Rent successfully adjusted from advance.' };
  };

  // Record Advance Payment
  const handleRecordAdvancePayment = (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    transactionId?: string,
    notes?: string
  ) => {
    updateData((prev) => {
      const tenant = prev.tenants.find((t) => t.flatId === flatId);
      const receiptNo = `ADV-${prev.selectedYear}-${Date.now().toString().slice(-4)}`;

      // Update advance account
      const updatedAccounts = prev.advanceAccounts.map((a) => {
        if (a.flatId === flatId) {
          const newPaid = a.amountPaid + amount;
          const newRemaining = Math.max(0, a.totalRequired - newPaid);
          return {
            ...a,
            amountPaid: newPaid,
            remainingAdvance: newPaid,
            status: (newPaid >= a.totalRequired ? 'paid' : 'partially_paid') as any,
            lastPaymentDate: new Date().toISOString().split('T')[0],
            notes,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      const advTx = {
        id: `atx-${Date.now()}`,
        advanceAccountId: `adv-${flatId}`,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        amount,
        type: 'deposit' as const,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: method,
        receiptNo,
        transactionId,
        notes,
        recordedBy: activeUserFullName,
        createdAt: new Date().toISOString(),
      };

      const audit = {
        id: `log-${Date.now()}`,
        action: 'DEPOSIT_ADVANCE',
        entity: 'AdvanceAccount',
        entityId: flatId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Deposited advance ${formatBDT(amount)} for Flat ${flatId}`,
        timestamp: new Date().toISOString(),
      };

      // Also sync active month ledger item advance payment & status
      const updatedLedgerItems = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const matchingAcc = updatedAccounts.find((a) => a.flatId === flatId);
          const totalPaidAdv = matchingAcc ? matchingAcc.amountPaid : amount;
          return {
            ...item,
            advancePayment: totalPaidAdv,
            advanceStatus: 'Paid' as const,
            advanceDate: new Date().toISOString().split('T')[0],
          };
        }
        return item;
      });

      return {
        ...prev,
        ledgerItems: updatedLedgerItems,
        advanceAccounts: updatedAccounts,
        advanceTransactions: [advTx, ...prev.advanceTransactions],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Toggle Unit Electricity Billing ON / OFF (for specific flats and godowns)
  const handleToggleUnitElectricity = (flatId: string, enabled: boolean) => {
    updateData((prev) => {
      const targetUnit = prev.units.find((u) => u.flatId === flatId);
      if (!targetUnit) return prev;

      // Update unit configuration
      const updatedUnits = prev.units.map((u) => {
        if (u.flatId === flatId) {
          return {
            ...u,
            isElectricityEnabled: enabled,
            electricityBillingType: enabled ? ('nesco_submeter' as const) : ('none' as const),
          };
        }
        return u;
      });

      // Update ledger items for this flat
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId) {
          if (!enabled) {
            // Turning OFF: electricity bill becomes 0, status N/A
            const newTotalPayable = item.flatRent + item.parkingRent + item.godownRent;
            const newTotalDue = Math.max(0, newTotalPayable - item.totalPaid);
            return {
              ...item,
              electricityBill: 0,
              electricityStatus: 'N/A' as const,
              totalPayable: newTotalPayable,
              totalDue: newTotalDue,
            };
          } else {
            // Turning ON: find if there was a bill or recalculate
            const existingBill = prev.electricityBills.find(
              (b) => b.flatId === flatId && b.billingMonth === item.month && b.billingYear === item.year
            );
            if (existingBill) {
              const newTotalPayable = item.flatRent + existingBill.totalBill + item.parkingRent + item.godownRent;
              const newTotalDue = Math.max(0, newTotalPayable - item.totalPaid);
              return {
                ...item,
                electricityBill: existingBill.totalBill,
                electricityStatus: (item.totalPaid >= newTotalPayable ? 'Paid' : 'Not Paid') as any,
                totalPayable: newTotalPayable,
                totalDue: newTotalDue,
              };
            }
          }
        }
        return item;
      });

      // When turning OFF, remove unverified / unpaid bills for this flat
      let updatedBills = prev.electricityBills;
      if (!enabled) {
        updatedBills = prev.electricityBills.filter(
          (b) => !(b.flatId === flatId && b.paymentStatus !== 'Paid')
        );
      }

      // Persist toggled unit monthly rent record to Supabase
      const updatedItem = updatedLedger.find(
        (i) => i.flatId === flatId && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert toggled electricity for Flat ${flatId} in period ${formatBillingPeriod(prev.selectedMonth, prev.selectedYear)}:`,
              err
            );
          }
        });
      }

      // Audit Log
      const auditLog = {
        id: `log-${Date.now()}`,
        action: 'UPDATE_UNIT_ELECTRICITY',
        entity: 'Unit',
        entityId: targetUnit.id,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Electricity billing & receipt generation toggled ${enabled ? 'ON' : 'OFF'} for ${targetUnit.unitType === 'godown' ? 'Godown' : 'Flat'} ${flatId}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        units: updatedUnits,
        ledgerItems: updatedLedger,
        electricityBills: updatedBills,
        auditLogs: [auditLog, ...prev.auditLogs],
      };
    });
  };

  // Generate Electricity Bills
  const handleGenerateElectricityBills = (
    consumptionMonth: number,
    consumptionYear: number,
    billingMonth: number,
    billingYear: number
  ) => {
    updateData((prev) => {
      // Only generate for flats and godowns where electricity is toggled ON (excluding garage/parking and disabled units)
      const nescoUnits = prev.units.filter(
        (u) =>
          (u.unitType === 'residential' || u.unitType === 'godown') &&
          (u.isElectricityEnabled ?? (u.electricityBillingType === 'nesco_submeter')) &&
          u.electricityBillingType !== 'none'
      );
      const newBills: ElectricityBill[] = nescoUnits.map((u) => {
        const mr = prev.meterReadings.find((r) => r.unitId === u.id && r.month === consumptionMonth);
        const prevReading = mr?.previousReading || 1500;
        const currentReading = mr?.currentReading || prevReading + 220;
        const calc = calculateNescoElectricityBill(currentReading, prevReading, prev.tariffConfig, 2);
        const tenant = prev.tenants.find((t) => t.flatId === u.flatId);

        return {
          id: `eb-${u.flatId.toLowerCase()}-${consumptionMonth}-${consumptionYear}`,
          unitId: u.id,
          flatId: u.flatId,
          tenantId: tenant?.id || '',
          tenantName: tenant?.fullName || 'Resident',
          consumptionMonth,
          consumptionYear,
          billingMonth,
          billingYear,
          previousReading: prevReading,
          currentReading,
          consumedUnits: calc.consumedUnits,
          slabBreakdown: calc.slabBreakdown,
          baseEnergyCost: calc.baseEnergyCost,
          demandCharge: calc.demandCharge,
          vatAmount: calc.vatAmount,
          meterRent: calc.meterRent,
          rebateAmount: calc.rebateAmount,
          totalBill: calc.totalBill,
          paidAmount: 0,
          dueAmount: calc.totalBill,
          paymentStatus: 'Not Paid',
          generatedDate: new Date().toISOString().split('T')[0],
          tariffSnapshotTitle: prev.tariffConfig.title,
        };
      });

      // Update Ledger with new electricity bills for billingMonth
      const targetBillingPeriod = formatBillingPeriod(billingMonth, billingYear);
      const updatedLedger = prev.ledgerItems.map((item) => {
        const matchingBill = newBills.find((b) => b.flatId === item.flatId);
        const unit = prev.units.find((u) => u.flatId === item.flatId);
        const isElecOn =
          (unit?.unitType === 'residential' || unit?.unitType === 'godown') &&
          (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter')) &&
          unit?.electricityBillingType !== 'none';

        if (item.month === billingMonth && item.year === billingYear) {
          if (matchingBill && isElecOn) {
            const totalPayable = item.flatRent + matchingBill.totalBill + item.parkingRent + item.godownRent;
            const totalDue = Math.max(0, totalPayable - item.totalPaid);
            return {
              ...item,
              billingPeriod: targetBillingPeriod,
              electricityBill: matchingBill.totalBill,
              electricityStatus: (item.totalPaid >= totalPayable ? 'Paid' : 'Not Paid') as any,
              totalPayable,
              totalDue,
            };
          } else if (!isElecOn) {
            const totalPayable = item.flatRent + item.parkingRent + item.godownRent;
            const totalDue = Math.max(0, totalPayable - item.totalPaid);
            return {
              ...item,
              billingPeriod: targetBillingPeriod,
              electricityBill: 0,
              electricityStatus: 'N/A' as const,
              totalPayable,
              totalDue,
            };
          }
        }
        return item;
      });

      // Persist updated electricity bill records to Supabase monthly_rent_records
      const itemsForBillingPeriod = updatedLedger.filter(
        (i) => i.month === billingMonth && i.year === billingYear
      );
      if (itemsForBillingPeriod.length > 0) {
        upsertBatchRemoteMonthlyRentRecords(itemsForBillingPeriod).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to batch upsert electricity bills for billing_period = "${targetBillingPeriod}":`,
              err
            );
          }
        });
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: 'CREATE_BILL',
        entity: 'ElectricityBill',
        entityId: `eb-batch-${consumptionMonth}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Generated ${newBills.length} electricity bills for ${getMonthName(consumptionMonth)} consumption (excluding disabled flats & parking)`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        electricityBills: [...newBills, ...prev.electricityBills.filter((b) => !(b.consumptionMonth === consumptionMonth && b.consumptionYear === consumptionYear))],
        ledgerItems: updatedLedger,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Manual Save / Update Ledger Item (2. Data Upsert / Persistence: Supabase .upsert() matching on (unit_id, period))
  const handleSaveLedgerItem = (savedItem: MonthlyLedgerItem) => {
    const itemToPersist: MonthlyLedgerItem = {
      ...savedItem,
      billingPeriod: savedItem.billingPeriod || formatBillingPeriod(savedItem.month, savedItem.year),
    };

    console.log(
      `[Supabase Save Operation] Saving Flat ${savedItem.flatId} (period: "${itemToPersist.billingPeriod}", block_key: "${itemToPersist.blockKey || 'auto'}") to Supabase...`
    );

    upsertRemoteMonthlyRentRecord(itemToPersist)
      .then((res) => {
        if (res.success) {
          console.log(`[Supabase Save Success] Flat ${savedItem.flatId} saved successfully:`, res.data);
        } else {
          const creds = getSupabaseCredentials();
          if (!creds.isConfigured) {
            console.log(`[Supabase Remote Notice] Remote database not configured; Flat ${savedItem.flatId} saved to server disk.`);
          } else {
            console.error(`[Supabase Save Error] Failed to save Flat ${savedItem.flatId}:`, res.error?.message || res.error);
          }
        }
      })
      .catch((err: any) => {
        console.error(`[Supabase Save Exception] Failed to save Flat ${savedItem.flatId}:`, err);
      });

    updateData((prev) => {
      const existingIdx = prev.ledgerItems.findIndex(
        (i) => i.flatId === savedItem.flatId && i.month === savedItem.month && i.year === savedItem.year
      );

      let updatedLedger: MonthlyLedgerItem[];
      if (existingIdx >= 0) {
        updatedLedger = [...prev.ledgerItems];
        updatedLedger[existingIdx] = {
          ...updatedLedger[existingIdx],
          ...itemToPersist,
        };
      } else {
        updatedLedger = [itemToPersist, ...prev.ledgerItems];
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: existingIdx >= 0 ? 'UPDATE_LEDGER_MANUAL' : 'ADD_LEDGER_MANUAL',
        entity: 'MonthlyLedger',
        entityId: `${savedItem.flatId}-${savedItem.month}-${savedItem.year}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Manual ledger data ${existingIdx >= 0 ? 'updated' : 'added'} for Flat ${savedItem.flatId} (${savedItem.month}/${savedItem.year})`,
        timestamp: new Date().toISOString(),
      };

      // Sync advance accounts
      let updatedAdvanceAccounts = prev.advanceAccounts;
      if (savedItem.advancePayment !== undefined) {
        const advIndex = prev.advanceAccounts.findIndex((a) => a.flatId === savedItem.flatId);
        if (advIndex >= 0) {
          updatedAdvanceAccounts = [...prev.advanceAccounts];
          const acc = updatedAdvanceAccounts[advIndex];
          const advPaid = Number(savedItem.advancePayment || 0);
          updatedAdvanceAccounts[advIndex] = {
            ...acc,
            amountPaid: advPaid,
            remainingAdvance: advPaid,
            status: advPaid >= (acc.totalRequired || advPaid) ? 'paid' : (advPaid > 0 ? 'partially_paid' : 'not_paid'),
            lastPaymentDate: savedItem.advanceDate || acc.lastPaymentDate || new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          };
        }
      }

      return {
        ...prev,
        ledgerItems: updatedLedger,
        advanceAccounts: updatedAdvanceAccounts,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Copy Ledger Data from Previous Month
  // As requested:
  // 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance, 6. Flat Rent are copied
  // 7. Electricity, 8. Parking data are set to EMPTY (0) for manual input
  // Resets payment statuses: rentStatus = 'Not Paid', totalPaid = 0, totalDue = totalPayable, paymentStatus = 'Not Paid'
  const handleCopyPreviousMonthLedger = (
    targetMonth: number,
    targetYear: number,
    sourceMonth?: number,
    sourceYear?: number
  ) => {
    const srcMonth = sourceMonth || (targetMonth === 1 ? 12 : targetMonth - 1);
    const srcYear = sourceYear || (targetMonth === 1 ? targetYear - 1 : targetYear);
    const targetPeriod = formatBillingPeriod(targetMonth, targetYear);
    const sourcePeriod = formatBillingPeriod(srcMonth, srcYear);

    console.log(
      `[Supabase Clone Roster] Cloning tenant roster from ${sourcePeriod} into target billing_period = "${targetPeriod}"...`
    );

    updateData((prev) => {
      // Find source month items
      let sourceItems = prev.ledgerItems.filter((i) => i.month === srcMonth && i.year === srcYear);

      // If no items in source month, fallback to generating baseline
      if (sourceItems.length === 0) {
        sourceItems = generateInitialLedger(srcMonth, srcYear);
      }

      // Existing items in other months
      const otherMonthsItems = prev.ledgerItems.filter((i) => !(i.month === targetMonth && i.year === targetYear));

      // Build copied items with reset payment statuses
      const newTargetItems: MonthlyLedgerItem[] = sourceItems.map((src) => {
        const isOwnerFlat = src.flatId.includes('Owner') || src.tenantName === 'Owner Occupied' || src.tenantName === 'Vacant Flat';
        const flatRent = isOwnerFlat ? 0 : src.flatRent;
        const electricityBill = 0; // 7. Electricity EMPTY (0) for manual input
        const parkingRent = 0;     // 8. Parking EMPTY (0) for manual input
        const godownRent = src.godownRent || 0;
        const totalPayable = flatRent + godownRent; // Ready for electricity & parking manual inputs
        const totalPaid = 0;
        const totalDue = isOwnerFlat ? 0 : totalPayable;
        const paymentStatus: PaymentStatus = isOwnerFlat ? 'N/A' : 'Not Paid';
        const rentStatus: PaymentStatus = isOwnerFlat ? 'N/A' : 'Not Paid';

        return {
          id: `led-${src.flatId.toLowerCase()}-${targetPeriod}`,
          unitId: src.unitId || `u-${src.flatId}`,
          flatId: src.flatId,           // 1. Flat ID copied
          blockName: src.blockName,
          tenantId: src.tenantId,
          tenantName: src.tenantName,   // 2. Tenant Name copied
          tenantPhone: src.tenantPhone, // 3. Mobile copied
          entryDate: src.entryDate,     // 4. Entry Date copied
          billingPeriod: targetPeriod,  // Strict YYYY-MM column
          month: targetMonth,
          year: targetYear,
          advancePayment: isOwnerFlat ? 0 : src.advancePayment, // 5. Advance copied
          advanceStatus: isOwnerFlat ? 'N/A' : (src.advanceStatus || (src.advancePayment > 0 ? 'Paid' : 'Not Paid')),
          advanceDate: isOwnerFlat ? undefined : src.advanceDate,
          flatRent,                     // 6. Flat Rent copied
          rentStatus,
          rentPaymentDate: undefined,
          electricityBill: 0,           // 7. Electricity EMPTY for manual input
          electricityStatus: 'N/A',
          electricityDate: undefined,
          parkingRent: 0,               // 8. Parking EMPTY for manual input
          godownRent,
          totalPayable,
          totalPaid,
          totalDue,
          paymentStatus,
          adjustedFromAdvance: 0,
          lastPaymentDate: undefined,
          notes: src.notes || '',
        };
      });

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      upsertBatchRemoteMonthlyRentRecords(newTargetItems).catch((err: any) => {
        console.warn(
          `[Supabase Sync Notice] Remote batch upsert for ${targetPeriod}:`,
          err?.message || err
        );
      });

      const audit = {
        id: `log-${Date.now()}`,
        action: 'COPY_PREVIOUS_MONTH_LEDGER',
        entity: 'MonthlyLedger',
        entityId: `ledger-${targetPeriod}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Copied tenant roster from ${sourcePeriod} to ${targetPeriod} with reset payment statuses (Advance & Rent preserved; Electricity & Parking reset to 0; Status: Not Paid)`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        ledgerItems: [...newTargetItems, ...otherMonthsItems],
        selectedMonth: targetMonth,
        selectedYear: targetYear,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Handle Import from Excel or Google Sheet
  // Strictly: 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance
  // If any field is empty, it leaves it as it is and proceeds to next
  const handleImportLedgerData = (
    importedItems: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => {
    updateData((prev) => {
      // 1. Merge into ledgerItems for targetMonth and targetYear
      const otherMonthsItems = prev.ledgerItems.filter(
        (i) => !(i.month === targetMonth && i.year === targetYear)
      );
      const existingThisMonth = prev.ledgerItems.filter(
        (i) => i.month === targetMonth && i.year === targetYear
      );

      const updatedThisMonth = [...existingThisMonth];
      importedItems.forEach((newItem) => {
        const idx = updatedThisMonth.findIndex((i) => i.flatId === newItem.flatId);
        if (idx >= 0) {
          const existing = updatedThisMonth[idx];
          // Strictly only upload: 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance
          // If any field is empty, leave it as it is and do next
          const tenantName =
            newItem.tenantName && newItem.tenantName.trim() ? newItem.tenantName.trim() : existing.tenantName;
          const tenantPhone =
            newItem.tenantPhone && newItem.tenantPhone.trim() ? newItem.tenantPhone.trim() : existing.tenantPhone;
          const entryDate =
            newItem.entryDate && newItem.entryDate.trim() ? newItem.entryDate.trim() : existing.entryDate;
          const advancePayment =
            newItem.advancePayment !== undefined && newItem.advancePayment !== null && !isNaN(newItem.advancePayment)
              ? newItem.advancePayment
              : existing.advancePayment;
          const advanceStatus = newItem.advanceStatus || existing.advanceStatus;

          updatedThisMonth[idx] = {
            ...existing,
            tenantName,
            tenantPhone,
            entryDate,
            advancePayment,
            advanceStatus,
            // Strictly preserve: flatRent, electricityBill, parkingRent, godownRent, paymentStatus, rentStatus, electricityStatus, totalPaid, totalPayable, totalDue
          };
        } else {
          updatedThisMonth.push(newItem);
        }
      });

      const audit = {
        id: `log-${Date.now()}`,
        action: 'IMPORT_EXCEL_LEDGER',
        entity: 'MonthlyLedger',
        entityId: `ledger-${targetMonth}-${targetYear}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Overrode ledger data for ${getMonthName(targetMonth)} ${targetYear} only (${importedItems.length} flats updated). Other months remain unchanged.`,
        timestamp: new Date().toISOString(),
      };

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      upsertBatchRemoteMonthlyRentRecords(updatedThisMonth).catch((err) => {
        if (getSupabaseCredentials().isConfigured) {
          console.error('[Supabase RLS/Error] Failed to batch upsert imported ledger items into Supabase:', err);
        }
      });

      return {
        ...prev,
        ledgerItems: [...otherMonthsItems, ...updatedThisMonth],
        selectedMonth: targetMonth,
        selectedYear: targetYear,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Update Meter Reading
  const handleUpdateMeterReading = (
    flatId: string,
    currentReading: number,
    month: number,
    year: number
  ) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === flatId);
      const existing = prev.meterReadings.find((r) => r.flatId === flatId && r.month === month && r.year === year);
      const prevReading = existing?.previousReading || 1500;
      const consumedUnits = Math.max(0, currentReading - prevReading);

      const newReading = {
        id: `mr-${flatId}-${month}-${year}`,
        unitId: unit?.id || '',
        flatId,
        month,
        year,
        previousReading: prevReading,
        currentReading,
        consumedUnits,
        readingDate: new Date().toISOString().split('T')[0],
        recordedBy: activeUserFullName,
      };

      return {
        ...prev,
        meterReadings: [
          newReading,
          ...prev.meterReadings.filter((r) => !(r.flatId === flatId && r.month === month && r.year === year)),
        ],
      };
    });
  };

  // Submit Complaint
  const handleSubmitComplaint = (category: ComplaintCategory, subject: string, description: string) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === activeUserFlatId);
      const newComplaint = {
        id: `comp-${Date.now().toString().slice(-4)}`,
        tenantId: activeUserId,
        tenantName: activeUserFullName,
        flatId: activeUserFlatId,
        blockName: unit?.blockName || 'Block A',
        category,
        subject,
        description,
        submissionDate: new Date().toISOString(),
        status: 'Submitted' as ComplaintStatus,
        messages: [],
      };
      return {
        ...prev,
        complaints: [newComplaint, ...prev.complaints],
      };
    });
  };

  // Update Complaint Status
  const handleUpdateComplaintStatus = (complaintId: string, status: ComplaintStatus) => {
    updateData((prev) => ({
      ...prev,
      complaints: prev.complaints.map((c) => (c.id === complaintId ? { ...c, status } : c)),
    }));
  };

  // Add Message to Complaint
  const handleAddComplaintMessage = (complaintId: string, message: string) => {
    updateData((prev) => ({
      ...prev,
      complaints: prev.complaints.map((c) => {
        if (c.id === complaintId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: `cm-${Date.now()}`,
                senderName: activeUserFullName,
                senderRole: activeUserRole,
                message,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }
        return c;
      }),
    }));
  };

  // Send Direct Chat Message
  const handleSendMessage = (recipientId: string, recipientName: string, message: string) => {
    updateData((prev) => {
      const newMsg = {
        id: `msg-${Date.now()}`,
        conversationId: `conv-${recipientId}`,
        senderId: activeUserId,
        senderName: activeUserFullName,
        senderRole: activeUserRole,
        recipientId,
        message,
        timestamp: new Date().toISOString(),
        isRead: false,
      };
      return {
        ...prev,
        chatMessages: [...prev.chatMessages, newMsg],
      };
    });
  };

  // Submit Online Payment Request (bKash/Nagad/Rocket with 1.8% fee)
  const handleSubmitOnlinePayment = (
    flatId: string,
    baseAmount: number,
    feeAmount: number,
    totalAmount: number,
    method: 'bKash' | 'Nagad' | 'Rocket',
    transactionId: string,
    category: string,
    recipientNumber?: string,
    recipientOwnerName?: string
  ) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === flatId);
      const newReq: OnlinePaymentRequest = {
        id: `onl-${Date.now()}`,
        tenantId: activeUserId,
        tenantName: activeUserFullName,
        flatId,
        blockName: unit?.blockName,
        month: prev.selectedMonth,
        year: prev.selectedYear,
        category,
        baseAmount,
        feeAmount,
        amount: totalAmount,
        paymentMethod: method,
        recipientNumber,
        recipientOwnerName,
        transactionId,
        submissionDate: new Date().toISOString(),
        verificationStatus: 'Pending',
      };
      return {
        ...prev,
        onlineRequests: [newReq, ...prev.onlineRequests],
      };
    });
  };

  // Verify Online Payment Request
  const handleVerifyPayment = (requestId: string, status: 'Verified' | 'Rejected') => {
    const req = data.onlineRequests.find((r) => r.id === requestId);
    if (!req) return;

    if (status === 'Verified') {
      const creditAmount = req.baseAmount || req.amount;
      handleRecordPayment(
        req.flatId,
        creditAmount,
        req.paymentMethod,
        'Combined',
        req.transactionId,
        `Verified online MFS payment (Total sent: ৳${req.amount}, 1.8% MFS cashout fee: ৳${req.feeAmount || 0})`
      );
    }

    updateData((prev) => ({
      ...prev,
      onlineRequests: prev.onlineRequests.map((r) =>
        r.id === requestId ? { ...r, verificationStatus: status, verifiedBy: activeUserFullName } : r
      ),
    }));
  };

  // Unit Operations
  const handleAddUnit = (unit: Omit<Unit, 'id'>) => {
    updateData((prev) => ({
      ...prev,
      units: [...prev.units, { ...unit, id: `u-${Date.now()}` }],
    }));
  };

  const handleUpdateUnitRent = (unitId: string, monthlyRent: number) => {
    updateData((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === unitId ? { ...u, monthlyRent } : u)),
    }));
  };

  const handleVacateUnit = (unitId: string) => {
    updateData((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === unitId ? { ...u, isOccupied: false, tenantId: undefined } : u)),
    }));
  };

  // User Accounts
  const handleAddUser = (user: Omit<UserProfile, 'id' | 'createdAt'>) => {
    updateData((prev) => ({
      ...prev,
      profiles: [...prev.profiles, { ...user, id: `user-${Date.now()}`, createdAt: new Date().toISOString() }],
    }));
  };

  const handleToggleUserStatus = (userId: string) => {
    updateData((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, isActive: !p.isActive } : p)),
    }));
  };

  const handleResetPassword = (userId: string) => {
    // Password reset simulation with audit log
    updateData((prev) => ({
      ...prev,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'RESET_PASSWORD',
          entity: 'UserProfile',
          entityId: userId,
          performedBy: activeUserFullName,
          userRole: activeUserRole,
          details: `Manager reset password for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        ...prev.auditLogs,
      ],
    }));
  };

  // Switch role handler (e.g. Manager Russell, Owner Rashed, Owner Raju, Owner Rony, or Resident)
  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('mbd_logged_in_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setIsRoleDropdownOpen(false);
    // Reset view to dashboard
    setCurrentView('dashboard');
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('mbd_logged_in_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('mbd_logged_in_user');
    } catch (e) {
      console.error(e);
    }
    setIsRoleDropdownOpen(false);
    setIsMobileMenuOpen(false);
    setCurrentView('dashboard');
  };

  // Predefined Quick Accounts for Fast Role Switching in demo/testing
  const quickAccounts: { label: string; user: UserProfile }[] = [
    { label: `Russell (Manager - ${COMPLEX_CONFIG.managerPhone})`, user: data.profiles[0] },
    { label: 'Rashed (Block A Owner)', user: data.profiles[1] },
    { label: `Raju (Block B Owner - ${COMPLEX_CONFIG.rajuPhone})`, user: data.profiles[2] },
    { label: 'Rony (Block C Owner)', user: data.profiles[3] },
    {
      label: 'Tanvir Ahmed (Tenant - Flat A2)',
      user: {
        id: 't-a2',
        email: 'tanvir.a2@gmail.com',
        fullName: 'Tanvir Ahmed Chy',
        phone: '01819-223344',
        role: 'tenant',
        flatId: 'A2',
        isActive: true,
        createdAt: '2024-03-01',
      },
    },
    {
      label: 'Farhana Begum (Tenant - Flat B3)',
      user: {
        id: 't-b3',
        email: 'farhana.b3@gmail.com',
        fullName: 'Farhana Begum',
        phone: '01922-345678',
        role: 'tenant',
        flatId: 'B3',
        isActive: true,
        createdAt: '2024-05-01',
      },
    },
  ];

  // Navigation items based on role
  const getNavItems = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'manager') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'monthly-ledger', label: 'Monthly Ledger', icon: FileSpreadsheet },
        { id: 'advance-payments', label: 'Advance Payments', icon: Wallet },
        { id: 'electricity', label: 'Electricity (NESCO)', icon: Zap },
        { id: 'online-payments', label: 'Online Payments', icon: CreditCard },
        { id: 'units', label: 'Flats & Rental Units', icon: Home },
        { id: 'complaints', label: 'Complaints', icon: AlertCircle },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'audit-logs', label: 'Audit Logs', icon: History },
      ];
    } else if (currentUser.role === 'owner') {
      return [
        { id: 'dashboard', label: `${currentUser.assignedBlock} Dashboard`, icon: LayoutDashboard },
        { id: 'monthly-ledger', label: `${currentUser.assignedBlock} Ledger`, icon: FileSpreadsheet },
        { id: 'advance-payments', label: 'Advance Accounts', icon: Wallet },
        { id: 'electricity', label: 'Electricity Bills', icon: Zap },
        { id: 'complaints', label: 'Complaints', icon: AlertCircle },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
      ];
    } else {
      return [
        { id: 'dashboard', label: 'My Dashboard & Bills', icon: LayoutDashboard },
        { id: 'complaints', label: 'Maintenance Requests', icon: AlertCircle },
        { id: 'messages', label: 'Chat with Management', icon: MessageSquare },
      ];
    }
  };

  const navItems = getNavItems();
  const dbCreds = getSupabaseCredentials();

  // List of billing periods for header dropdown (strict YYYY-MM scoping)
  const headerBillingPeriods = React.useMemo(() => {
    const list: { period: string; label: string; month: number; year: number }[] = [];
    for (let y = 2027; y >= 2025; y--) {
      for (let m = 12; m >= 1; m--) {
        const period = formatBillingPeriod(m, y);
        list.push({
          period,
          label: `${period} (${getMonthName(m)} ${y})`,
          month: m,
          year: y,
        });
      }
    }
    return list;
  }, []);

  // If not logged in, render the Login Page
  if (!currentUser) {
    return (
      <LoginPage
        profiles={data.profiles}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Complex Bar */}
      <header className="no-print bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Complex Identity */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-300 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-black text-white text-xs sm:text-sm shadow-sm tracking-wider shrink-0">
                MBD
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-tight block truncate text-white">
                  {COMPLEX_CONFIG.name.toUpperCase()}
                </span>
                <span className="text-[10px] text-blue-200 block font-medium truncate max-w-[220px] sm:max-w-md lg:max-w-xl">
                  {COMPLEX_CONFIG.address} &bull; Hotline: <span className="font-bold text-white">{COMPLEX_CONFIG.contacts}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Current Period & Database Status & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Database indicator - ONLY DISPLAY ON MANAGER'S DASHBOARD */}
            {currentUser.role === 'manager' && currentView === 'dashboard' && (
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700 cursor-pointer"
                title="Supabase Database Configuration"
              >
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>{dbCreds.isConfigured ? 'Supabase Live' : 'Database'}</span>
                <span className={`w-2 h-2 rounded-full ${dbCreds.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}></span>
              </button>
            )}

            {/* Header Billing Period Dropdown (Strict YYYY-MM Scoping) */}
            <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 text-xs shadow-xs">
              <button
                onClick={() => {
                  let newM = data.selectedMonth - 1;
                  let newY = data.selectedYear;
                  if (newM < 1) {
                    newM = 12;
                    newY -= 1;
                  }
                  handleUpdateMonthYear(newM, newY);
                }}
                title="Previous Billing Period"
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 px-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0 hidden sm:inline" />
                <span className="text-[10px] text-slate-400 font-sans hidden xl:inline">Period:</span>
                <select
                  value={formatBillingPeriod(data.selectedMonth, data.selectedYear)}
                  onChange={(e) => {
                    const { month, year } = parseBillingPeriod(e.target.value);
                    handleUpdateMonthYear(month, year);
                  }}
                  className="bg-transparent text-blue-400 font-bold text-xs focus:outline-hidden cursor-pointer py-0.5 border-none font-mono"
                  title="Select Billing Period (strict YYYY-MM format)"
                >
                  {headerBillingPeriods.map((bp) => (
                    <option key={bp.period} value={bp.period} className="bg-slate-900 text-white font-mono">
                      {bp.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  let newM = data.selectedMonth + 1;
                  let newY = data.selectedYear;
                  if (newM > 12) {
                    newM = 1;
                    newY += 1;
                  }
                  handleUpdateMonthYear(newM, newY);
                }}
                title="Next Billing Period"
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span className="max-w-[130px] sm:max-w-[170px] truncate">
                  {currentUser.fullName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Role / Account (Demo Mode)
                    </p>
                    <p className="font-semibold text-slate-700 mt-0.5 truncate">
                      Active: {currentUser.fullName}
                    </p>
                  </div>

                  <div className="py-1">
                    {quickAccounts.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSwitchUser(item.user)}
                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                          currentUser.id === item.user.id ? 'bg-blue-50/80 font-bold text-blue-700' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-900">{item.label}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{item.user.role}</p>
                        </div>
                        {currentUser.id === item.user.id && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-2 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center gap-2 transition-colors cursor-pointer text-xs"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Sign Out to Login Screen</span>
                    </button>
                  </div>

                  <div className="px-4 py-2 border-t border-slate-100 flex flex-col gap-0.5 text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-700">{COMPLEX_CONFIG.address}</span>
                    <span>Contact: {COMPLEX_CONFIG.contacts}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Logout Button in Header */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-xs"
              title="Sign out of your account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Left Sidebar Navigation (Desktop) */}
        <aside className="no-print hidden lg:block w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-1 sticky top-22">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {currentUser.role === 'manager'
                ? 'Super Admin ERP'
                : currentUser.role === 'owner'
                ? `${currentUser.assignedBlock} Owner`
                : 'Resident Portal'}
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
              {currentUser.role === 'manager' && currentView === 'dashboard' && (
                <button
                  onClick={() => setIsDbModalOpen(true)}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Supabase & SQL</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px]">
                <p className="font-bold text-slate-800 leading-tight">{COMPLEX_CONFIG.name}</p>
                <p className="text-slate-500 text-[10px] mt-1 leading-normal">{COMPLEX_CONFIG.address}</p>
                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-0.5 text-[10px]">
                  <p className="text-slate-600 font-medium">
                    Manager: <a href="tel:01737-321998" className="font-bold text-blue-700 hover:underline">01737-321998</a>
                  </p>
                  <p className="text-slate-600 font-medium">
                    Raju: <a href="tel:01913-858775" className="font-bold text-blue-700 hover:underline">01913-858775</a>
                  </p>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-72 bg-white h-full p-4 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{COMPLEX_CONFIG.name}</span>
                    <span className="text-[10px] text-slate-500">Rajshahi-6201</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Mobile Billing Period Selector */}
                <div className="p-2.5 bg-slate-900 text-white rounded-xl my-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Billing Period (Monthly Scoping)</span>
                  </div>
                  <select
                    value={formatBillingPeriod(data.selectedMonth, data.selectedYear)}
                    onChange={(e) => {
                      const { month, year } = parseBillingPeriod(e.target.value);
                      handleUpdateMonthYear(month, year);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-slate-800 text-blue-300 font-mono text-xs rounded-lg px-2.5 py-2 font-bold border border-slate-700"
                  >
                    {headerBillingPeriods.map((bp) => (
                      <option key={bp.period} value={bp.period} className="bg-slate-900 text-white">
                        {bp.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-1 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentView(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                          currentView === item.id ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                {currentUser.role === 'manager' && currentView === 'dashboard' && (
                  <button
                    onClick={() => {
                      setIsDbModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700"
                  >
                    Database Setup
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600">
                  <p className="font-bold text-slate-800">{COMPLEX_CONFIG.address}</p>
                  <p className="mt-1 font-semibold text-blue-700">Hotline: {COMPLEX_CONFIG.contacts}</p>
                </div>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)}></div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* VIEW ROUTING */}
          {currentUser.role === 'tenant' ? (
            /* Tenant View */
            currentView === 'dashboard' ? (
              <TenantPortal
                currentUser={currentUser}
                data={data}
                onViewReceipt={setActiveReceipt}
                onViewBill={setActiveBill}
                onSubmitOnlinePayment={handleSubmitOnlinePayment}
                onNavigateToView={setCurrentView}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
              />
            )
          ) : currentUser.role === 'owner' ? (
            /* Block Owner View */
            currentView === 'dashboard' ? (
              <OwnerDashboard
                currentUser={currentUser}
                data={data}
                onViewReceipt={setActiveReceipt}
                onSaveLedgerItem={handleSaveLedgerItem}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onUpdateMonthYear={handleUpdateMonthYear}
                onImportLedgerData={handleImportLedgerData}
                onUpdatePaymentSettings={(settings) =>
                  updateData((prev) => ({ ...prev, paymentSettings: settings }))
                }
              />
            ) : currentView === 'monthly-ledger' ? (
              <MainLedger
                data={data}
                onRecordPayment={handleRecordPayment}
                onAdjustFromAdvance={handleAdjustFromAdvance}
                onViewReceipt={setActiveReceipt}
                onUpdateMonthYear={handleUpdateMonthYear}
                onSaveLedgerItem={handleSaveLedgerItem}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onImportLedgerData={handleImportLedgerData}
                userRole={currentUser.role}
                assignedBlock={currentUser.assignedBlock}
                currentUser={currentUser}
              />
            ) : currentView === 'advance-payments' ? (
              <AdvancePaymentManager
                data={data}
                onRecordAdvancePayment={handleRecordAdvancePayment}
                onViewReceipt={setActiveReceipt}
                userRole={currentUser.role}
                assignedBlock={currentUser.assignedBlock}
              />
            ) : currentView === 'electricity' ? (
              <ElectricityManager
                data={data}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onUpdateMeterReading={handleUpdateMeterReading}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onViewBill={setActiveBill}
                onViewReceipt={setActiveReceipt}
                onOpenTariffModal={() => setIsTariffModalOpen(true)}
                userRole={currentUser.role}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
              />
            )
          ) : (
            /* Manager (Super Admin) View */
            currentView === 'dashboard' ? (
              <ManagerDashboard
                data={data}
                onUpdateMonthYear={handleUpdateMonthYear}
                onNavigateToView={setCurrentView}
                onOpenDbModal={() => setIsDbModalOpen(true)}
              />
            ) : currentView === 'monthly-ledger' ? (
              <MainLedger
                data={data}
                onRecordPayment={handleRecordPayment}
                onAdjustFromAdvance={handleAdjustFromAdvance}
                onViewReceipt={setActiveReceipt}
                onUpdateMonthYear={handleUpdateMonthYear}
                onSaveLedgerItem={handleSaveLedgerItem}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onImportLedgerData={handleImportLedgerData}
                userRole={currentUser.role}
                currentUser={currentUser}
              />
            ) : currentView === 'advance-payments' ? (
              <AdvancePaymentManager
                data={data}
                onRecordAdvancePayment={handleRecordAdvancePayment}
                onViewReceipt={setActiveReceipt}
                userRole={currentUser.role}
              />
            ) : currentView === 'electricity' ? (
              <ElectricityManager
                data={data}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onUpdateMeterReading={handleUpdateMeterReading}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onViewBill={setActiveBill}
                onViewReceipt={setActiveReceipt}
                onOpenTariffModal={() => setIsTariffModalOpen(true)}
                userRole={currentUser.role}
              />
            ) : currentView === 'online-payments' ? (
              <OnlinePaymentWorkflow
                data={data}
                onVerifyPayment={handleVerifyPayment}
                onUpdatePaymentSettings={(settings) =>
                  updateData((prev) => ({ ...prev, paymentSettings: settings }))
                }
              />
            ) : currentView === 'units' ? (
              <UnitManager
                data={data}
                onAddUnit={handleAddUnit}
                onUpdateUnitRent={handleUpdateUnitRent}
                onVacateUnit={handleVacateUnit}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : currentView === 'messages' ? (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
              />
            ) : currentView === 'users' ? (
              <UserManagement
                data={data}
                onAddUser={handleAddUser}
                onToggleUserStatus={handleToggleUserStatus}
                onResetPassword={handleResetPassword}
              />
            ) : (
              <AuditLogView data={data} />
            )
          )}
        </main>
      </div>

      {/* Complex Permanent Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 border-t border-slate-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-center md:text-left">
            <p className="font-extrabold text-white text-sm tracking-tight">
              {COMPLEX_CONFIG.name.toUpperCase()}
            </p>
            <p className="text-slate-400 mt-0.5">
              {COMPLEX_CONFIG.address}
            </p>
            <p className="text-slate-300 mt-1 font-medium">
              Hotline Contacts: <a href="tel:01737-321998" className="text-blue-400 font-bold hover:underline">01737-321998 (Manager)</a>, <a href="tel:01913-858775" className="text-blue-400 font-bold hover:underline">01913-858775 (Raju)</a>
            </p>
          </div>
          <div className="text-center md:text-right text-[11px] text-slate-500">
            <p>Apartment Management ERP &bull; Residential Complex System</p>
            <p className="mt-0.5">Currency: {COMPLEX_CONFIG.currency} &bull; Timezone: {COMPLEX_CONFIG.timezone}</p>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <PrintableReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <PrintableBillModal
        bill={activeBill}
        onClose={() => setActiveBill(null)}
      />

      {isTariffModalOpen && (
        <TariffSettingsModal
          tariffConfig={data.tariffConfig}
          onSave={(cfg) => updateData((prev) => ({ ...prev, tariffConfig: cfg }))}
          onClose={() => setIsTariffModalOpen(false)}
        />
      )}

      {isDbModalOpen && currentUser.role === 'manager' && (
        <DatabaseSetupModal
          onClose={() => setIsDbModalOpen(false)}
          onResetDemoData={() => setData(resetDatabaseToDefault())}
        />
      )}
    </div>
  );
}
