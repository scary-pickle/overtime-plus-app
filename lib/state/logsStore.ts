import { create } from 'zustand';
import { OvertimeLog, ExportBatch, MinutesCalculation } from '../../types';
import { database } from '../db/sqlite';
import { computeMinutes, roundToNearest5, getPreviousISODate, getCurrentDate, calculateDuration } from '../time';
import { useProfileStore } from './profileStore';
import { useLocalUserStore } from './localUserStore';
import { useGeofenceStore } from './geofenceStore';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('logsStore');

/**
 * Validates that a log has all required fields to be marked as ready
 * Returns an object with isValid flag and array of missing field messages
 */
export function validateLogForReady(log: OvertimeLog): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  // Check actual start and finish times (must be present and not 'N/A')
  if (!log.actualStart || log.actualStart === 'N/A') {
    missingFields.push('Actual start time');
  }
  if (!log.actualFinish || log.actualFinish === 'N/A') {
    missingFields.push('Actual finish time');
  }

  // Check rostered times - both must be present OR both must be 'N/A'
  const hasRosteredStart = log.rosteredStart && log.rosteredStart !== 'N/A';
  const hasRosteredFinish = log.rosteredFinish && log.rosteredFinish !== 'N/A';
  const rosteredTimesNA = log.rosteredStart === 'N/A' && log.rosteredFinish === 'N/A';
  const bothRosteredPresent = hasRosteredStart && hasRosteredFinish;

  // Rostered times are valid if both are present OR both are 'N/A'
  if (!bothRosteredPresent && !rosteredTimesNA) {
    // Mixed state - one is N/A and one is not, or both are empty
    if (log.rosteredStart === 'N/A' || log.rosteredFinish === 'N/A') {
      missingFields.push('Rostered times must both be filled or both marked as N/A');
    } else {
      missingFields.push('Rostered start and finish times (or mark both as N/A)');
    }
  }

  // Check category
  if (!log.category) {
    missingFields.push('Category');
  }

  // Check minutesOvertime (must be > 0)
  if (!log.minutesOvertime || log.minutesOvertime <= 0) {
    missingFields.push('Overtime calculation (must be greater than 0)');
  }

  // Check initials
  if (!log.initials || log.initials.trim().length === 0) {
    missingFields.push('Employee initials');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

interface LogsState {
  logs: OvertimeLog[];
  exportBatches: ExportBatch[];
  isLoading: boolean;
  hasLoadedExportBatchesOnce: boolean;
  error: string | null;

  // Actions
  loadLogs: (userId?: string | null) => Promise<void>;
  loadExportBatches: (userId?: string | null) => Promise<void>;
  addLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
  addShiftSwapLogs: (data: {
    personADate: string;
    personBDate: string;
    personAInitials: string;
    personARosteredStart: string | 'N/A';
    personARosteredFinish: string | 'N/A';
    personAActualStart: string;
    personAActualFinish: string;
    personBInitials: string;
    personBName: string;
    personBPayrollNumber: string;
    personBPayLevel?: string;
    personBRosteredStart: string | 'N/A';
    personBRosteredFinish: string | 'N/A';
    personBActualStart: string;
    personBActualFinish: string;
    mealBreakMinutes: number;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
  updateShiftSwapLogs: (data: {
    shiftSwapId: string;
    personADate: string;
    personBDate: string;
    personAInitials: string;
    personARosteredStart: string | 'N/A';
    personARosteredFinish: string | 'N/A';
    personAActualStart: string;
    personAActualFinish: string;
    personBInitials: string;
    personBName: string;
    personBPayrollNumber: string;
    personBPayLevel?: string;
    personBRosteredStart: string | 'N/A';
    personBRosteredFinish: string | 'N/A';
    personBActualStart: string;
    personBActualFinish: string;
    mealBreakMinutes: number;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
  addLeaveLogs: (data: {
    leaveEntries: Array<{
      date: string;
      rosteredStart: string | 'N/A';
      rosteredFinish: string | 'N/A';
    }>;
    comments: string;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
  updateLeaveLogs: (data: {
    leaveGroupId: string;
    leaveEntries: Array<{
      logId: string;
      date: string;
      rosteredStart: string | 'N/A';
      rosteredFinish: string | 'N/A';
    }>;
    comments: string;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
  updateLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
  deleteLog: (id: string, userId?: string | null) => Promise<void>;
  markReady: (id: string, userId?: string | null) => Promise<void>;
  batchExport: (logIds: string[], pdfUri?: string, userId?: string | null) => Promise<ExportBatch>;
  updateExportBatch: (batch: ExportBatch, userId?: string | null) => Promise<void>;
  deleteExportBatch: (id: string, userId?: string | null) => Promise<void>;
  markBatchAsSubmitted: (batchId: string, method: 'email' | 'manual') => Promise<void>;
  resetLogsToReady: (logIds: string[]) => Promise<void>;
  clearError: () => void;

  // Helper methods
  getLogsByStatus: (status: 'draft' | 'ready' | 'exported') => OvertimeLog[];
  getDraftLogs: () => OvertimeLog[];
  getReadyLogs: () => OvertimeLog[];
  getExportedLogs: () => OvertimeLog[];
  computeMinutesForLog: (log: OvertimeLog) => MinutesCalculation;
  getTotalMinutes: (logs: OvertimeLog[]) => number;

  // Active shift management
  getActiveShiftDraft: () => OvertimeLog | null;
  clearActiveShift: (id: string) => Promise<void>;
  markDraftAsStale: (id: string) => Promise<void>;

  // Duplicate prevention
  hasLoggedShiftForDate: (date: string) => boolean;
  getLoggedShiftForDate: (date: string) => OvertimeLog | null;

  // Helper methods for template/yesterday features
  getYesterdayLog: () => OvertimeLog | null;
  getMostRecentLogBeforeDate: (date: string) => OvertimeLog | null;
}

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  exportBatches: [],
  isLoading: false,
  hasLoadedExportBatchesOnce: false,
  error: null,

  loadLogs: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const logs = await database.getOvertimeLogs(userId);
      set({
        logs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load logs'
      });
    }
  },

  loadExportBatches: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const exportBatches = await database.getExportBatches(userId);
      set({
        exportBatches,
        isLoading: false,
        hasLoadedExportBatchesOnce: true,
        error: null
      });
    } catch (error) {
      const hasLoadedOnce = get().hasLoadedExportBatchesOnce;
      set({
        isLoading: false,
        hasLoadedExportBatchesOnce: hasLoadedOnce,
        error: error instanceof Error ? error.message : 'Failed to load export batches'
      });
    }
  },

  addLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.createOvertimeLog(log, userId ?? null);
      const { logs } = get();
      set({
        logs: [log, ...logs],
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add log'
      });
    }
  },

  addShiftSwapLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const isSameDate = data.personADate === data.personBDate;

      // Validate based on scenario
      if (isSameDate) {
        // Same date: validate reciprocal swap
        if (data.personARosteredStart !== 'N/A' && data.personBRosteredStart !== 'N/A') {
          if (data.personAActualStart !== data.personBRosteredStart || data.personAActualFinish !== data.personBRosteredFinish) {
            throw new Error('Person A actual times must match Person B rostered times (reciprocal swap)');
          }
          if (data.personBActualStart !== data.personARosteredStart || data.personBActualFinish !== data.personARosteredFinish) {
            throw new Error('Person B actual times must match Person A rostered times (reciprocal swap)');
          }
        }
      } else {
        if (!data.personAActualStart || !data.personAActualFinish || data.personAActualStart === 'N/A' || data.personAActualFinish === 'N/A') {
          throw new Error('Person A actual times are required (these represent the shift worked on Date 2)');
        }
        if (data.personARosteredStart === 'N/A' || data.personARosteredFinish === 'N/A') {
          throw new Error('Person A rostered times are required (or mark as N/A)');
        }
      }

      // Generate shared shift swap ID
      const shiftSwapId = `shift_swap_${Date.now()}`;
      const baseTimestamp = Date.now();
      const timestamp = baseTimestamp;

      if (isSameDate) {
        // SAME DATE: Create 2 logs
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;

        const personBShiftDuration = data.personBRosteredStart !== 'N/A' && data.personBRosteredFinish !== 'N/A'
          ? calculateDuration(data.personBRosteredStart, data.personBRosteredFinish) - data.mealBreakMinutes
          : 0;

        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);

        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);

        const personACalc = computeMinutes(
          data.personAActualStart,
          data.personAActualFinish,
          data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          data.mealBreakMinutes
        );

        const personBCalc = computeMinutes(
          data.personBActualStart,
          data.personBActualFinish,
          data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          data.mealBreakMinutes
        );

        const logA: OvertimeLog = {
          id: `log_${timestamp}_A`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded,
          category: 'Change shift',
          comments: 'Shift swap',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const logB: OvertimeLog = {
          id: `log_${timestamp}_B`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded,
          category: 'Change shift',
          comments: 'Shift swap',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await database.createOvertimeLog(logA, userId ?? null);
        await database.createOvertimeLog(logB, userId ?? null);

        const { logs } = get();
        set({
          logs: [logA, logB, ...logs],
          isLoading: false,
          error: null
        });
      } else {
        // DIFFERENT DATES: Create 4 logs
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;

        const personBShiftDuration = data.personAActualStart !== 'N/A' && data.personAActualFinish !== 'N/A'
          ? calculateDuration(data.personAActualStart, data.personAActualFinish) - data.mealBreakMinutes
          : 0;

        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);

        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);

        const now = Date.now();
        const logA1CreatedAt = new Date(now + 3).toISOString();
        const logA2CreatedAt = new Date(now + 2).toISOString();
        const logB2CreatedAt = new Date(now + 1).toISOString();
        const logB1CreatedAt = new Date(now).toISOString();

        const logA1: OvertimeLog = {
          id: `log_${timestamp}_A1`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA1CreatedAt,
          updatedAt: logA1CreatedAt,
        };

        const logA2: OvertimeLog = {
          id: `log_${timestamp}_A2`,
          date: data.personBDate,
          rosteredStart: 'N/A',
          rosteredFinish: 'N/A',
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded,
          category: 'Change shift',
          comments: 'Shift swap - working Person B\'s shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA2CreatedAt,
          updatedAt: logA2CreatedAt,
        };

        const logB2: OvertimeLog = {
          id: `log_${timestamp}_B2`,
          date: data.personBDate,
          rosteredStart: data.personAActualStart !== 'N/A' ? data.personAActualStart : undefined,
          rosteredFinish: data.personAActualFinish !== 'N/A' ? data.personAActualFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB2CreatedAt,
          updatedAt: logB2CreatedAt,
        };

        const logB1: OvertimeLog = {
          id: `log_${timestamp}_B1`,
          date: data.personADate,
          rosteredStart: 'N/A',
          rosteredFinish: 'N/A',
          actualStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : 'N/A',
          actualFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded,
          category: 'Change shift',
          comments: 'Shift swap - working Person A\'s shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB1CreatedAt,
          updatedAt: logB1CreatedAt,
        };

        await database.createOvertimeLog(logA1, userId ?? null);
        await database.createOvertimeLog(logA2, userId ?? null);
        await database.createOvertimeLog(logB2, userId ?? null);
        await database.createOvertimeLog(logB1, userId ?? null);

        const { logs } = get();
        set({
          logs: [logA1, logA2, logB2, logB1, ...logs],
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create shift swap logs'
      });
      throw error;
    }
  },

  updateShiftSwapLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const existingLogs = logs.filter(l => l.shiftSwapId === data.shiftSwapId && l.isShiftSwap);

      for (const log of existingLogs) {
        await database.deleteOvertimeLog(log.id, userId ?? null);
      }

      const isSameDate = data.personADate === data.personBDate;
      const shiftSwapId = data.shiftSwapId;
      const baseTimestamp = Date.now();
      const timestamp = baseTimestamp;

      const newLogs: OvertimeLog[] = [];

      if (isSameDate) {
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;

        const personBShiftDuration = data.personBRosteredStart !== 'N/A' && data.personBRosteredFinish !== 'N/A'
          ? calculateDuration(data.personBRosteredStart, data.personBRosteredFinish) - data.mealBreakMinutes
          : 0;

        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);
        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);

        const personACalc = computeMinutes(
          data.personAActualStart,
          data.personAActualFinish,
          data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          data.mealBreakMinutes
        );

        const personBCalc = computeMinutes(
          data.personBActualStart,
          data.personBActualFinish,
          data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          data.mealBreakMinutes
        );

        const logA: OvertimeLog = {
          id: `log_${timestamp}_A`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded,
          category: 'Change shift',
          comments: personACalc?.roundedOvertime !== personAOvertimeRounded
            ? `Shift swap (calculated: ${personACalc?.roundedOvertime || 0}min, adjusted: ${personAOvertimeRounded}min)`
            : 'Shift swap',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const logB: OvertimeLog = {
          id: `log_${timestamp}_B`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded,
          category: 'Change shift',
          comments: personBCalc?.roundedOvertime !== personBOvertimeRounded
            ? `Shift swap (calculated: ${personBCalc?.roundedOvertime || 0}min, adjusted: ${personBOvertimeRounded}min)`
            : 'Shift swap',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newLogs.push(logA, logB);
      } else {
        const now = Date.now();
        const logA1CreatedAt = new Date(now + 3).toISOString();
        const logA2CreatedAt = new Date(now + 2).toISOString();
        const logB2CreatedAt = new Date(now + 1).toISOString();
        const logB1CreatedAt = new Date(now).toISOString();

        const logA1: OvertimeLog = {
          id: `log_${timestamp}_A1`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA1CreatedAt,
          updatedAt: logA1CreatedAt,
        };

        const logA2: OvertimeLog = {
          id: `log_${timestamp}_A2`,
          date: data.personBDate,
          rosteredStart: undefined,
          rosteredFinish: undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: computeMinutes(
            data.personAActualStart,
            data.personAActualFinish,
            undefined,
            undefined,
            data.mealBreakMinutes
          )?.roundedOvertime || 0,
          category: 'Change shift',
          comments: 'Shift swap - worked Person B\'s shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA2CreatedAt,
          updatedAt: logA2CreatedAt,
        };

        const logB1: OvertimeLog = {
          id: `log_${timestamp}_B1`,
          date: data.personADate,
          rosteredStart: undefined,
          rosteredFinish: undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: computeMinutes(
            data.personBActualStart,
            data.personBActualFinish,
            undefined,
            undefined,
            data.mealBreakMinutes
          )?.roundedOvertime || 0,
          category: 'Change shift',
          comments: 'Shift swap - worked Person A\'s shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB1CreatedAt,
          updatedAt: logB1CreatedAt,
        };

        const logB2: OvertimeLog = {
          id: `log_${timestamp}_B2`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB2CreatedAt,
          updatedAt: logB2CreatedAt,
        };

        newLogs.push(logA1, logA2, logB1, logB2);
      }

      for (const log of newLogs) {
        await database.createOvertimeLog(log, userId ?? null);
      }

      const logsWithoutGroup = logs.filter(l => l.shiftSwapId !== data.shiftSwapId);
      const updatedLogs = [...newLogs, ...logsWithoutGroup];

      set({
        logs: updatedLogs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update shift swap logs'
      });
      throw error;
    }
  },

  addLeaveLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { profile, initials } = useProfileStore.getState();

      if (!data.leaveEntries || data.leaveEntries.length === 0) {
        throw new Error('At least one leave entry is required');
      }

      const now = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const leaveGroupId = `leave_${now}_${randomSuffix}`;

      const uniqueEntries = new Map<string, typeof data.leaveEntries[0]>();
      for (const entry of data.leaveEntries) {
        const key = `${entry.date}_${entry.rosteredStart}_${entry.rosteredFinish}`;
        if (!uniqueEntries.has(key)) {
          uniqueEntries.set(key, entry);
        }
      }

      const deduplicatedEntries = Array.from(uniqueEntries.values());

      if (deduplicatedEntries.length !== data.leaveEntries.length) {
        debug.debug('Deduplicated leave entries', {
          original: data.leaveEntries.length,
          deduplicated: deduplicatedEntries.length,
        });
      }

      const leaveLogs: OvertimeLog[] = [];
      const logInitials = initials || profile?.employeeInitial || '';

      for (let i = 0; i < deduplicatedEntries.length; i++) {
        const entry = deduplicatedEntries[i];
        const timestamp = now + i;
        const uniqueId = `${timestamp}_${randomSuffix}_${i}`;

        if (!entry.date) {
          throw new Error(`Leave entry ${i + 1} is missing a date`);
        }

        const log: OvertimeLog = {
          id: `log_${uniqueId}_leave`,
          date: entry.date,
          rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
          rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: undefined,
          minutesOvertime: 0,
          category: 'Change shift - cancel leave',
          comments: data.comments || undefined,
          initials: logInitials,
          status: data.status,
          source: 'manual',
          leaveGroupId,
          isLeave: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        leaveLogs.push(log);
      }

      for (const log of leaveLogs) {
        await database.createOvertimeLog(log, userId ?? null);
      }

      const { logs } = get();
      set({
        logs: [...leaveLogs, ...logs],
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create leave logs'
      });
      throw error;
    }
  },

  updateLeaveLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { profile, initials } = useProfileStore.getState();

      if (!data.leaveEntries || data.leaveEntries.length === 0) {
        throw new Error('At least one leave entry is required');
      }

      const { logs } = get();
      const existingLogs = logs.filter(l => l.leaveGroupId === data.leaveGroupId && l.isLeave);

      if (existingLogs.length === 0) {
        throw new Error('Leave group not found');
      }

      const logInitials = initials || profile?.employeeInitial || '';
      const updatedLogs: OvertimeLog[] = [];
      const logsToDelete: string[] = [];

      for (const entry of data.leaveEntries) {
        const existingLog = existingLogs.find(l => l.id === entry.logId);

        if (existingLog) {
          const updatedLog: OvertimeLog = {
            ...existingLog,
            date: entry.date,
            rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
            rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
            comments: data.comments || undefined,
            status: data.status,
            initials: logInitials,
            updatedAt: new Date().toISOString(),
          };
          updatedLogs.push(updatedLog);
        } else {
          const newLog: OvertimeLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_leave`,
            date: entry.date,
            rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
            rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
            actualStart: 'N/A',
            actualFinish: 'N/A',
            mealBreakMinutes: undefined,
            minutesOvertime: 0,
            category: 'Change shift - cancel leave',
            comments: data.comments || undefined,
            initials: logInitials,
            status: data.status,
            source: 'manual',
            leaveGroupId: data.leaveGroupId,
            isLeave: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedLogs.push(newLog);
        }
      }

      const updatedLogIds = new Set(data.leaveEntries.map(e => e.logId).filter(Boolean));
      for (const existingLog of existingLogs) {
        if (!updatedLogIds.has(existingLog.id)) {
          logsToDelete.push(existingLog.id);
        }
      }

      for (const log of updatedLogs) {
        await database.createOvertimeLog(log, userId ?? null);
      }

      for (const logId of logsToDelete) {
        await database.deleteOvertimeLog(logId, userId ?? null);
      }

      const currentLogs = get().logs;
      const logsWithoutGroup = currentLogs.filter(l => l.leaveGroupId !== data.leaveGroupId);
      const newLogs = [...updatedLogs, ...logsWithoutGroup];

      set({
        logs: newLogs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update leave logs'
      });
      throw error;
    }
  },

  updateLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });

    // When a geofence-proposed log that was actively tracking a shift gets finalised
    // (user sets a finish time, or confirms/marks ready), clear the active-shift state
    // so the "Shift in progress" badge disappears and the background EXIT event is
    // correctly treated as a no-op rather than overwriting the user's manual changes.
    let finalLog = log;
    if (log.source === 'geofence-proposed' && log.isActiveShift) {
      const hasFinishTime = log.actualFinish && log.actualFinish !== 'N/A';
      const isConfirmed = log.status !== 'draft';
      if (hasFinishTime || isConfirmed) {
        finalLog = { ...log, isActiveShift: false };
        try {
          await useGeofenceStore.getState().setActiveGeofenceLogId(null);
        } catch {
          // Non-critical — background EXIT guards are the safety net
        }
      }
    }

    try {
      await database.updateOvertimeLog(finalLog, userId ?? null);
      const { logs } = get();
      const updatedLogs = logs.map(l => l.id === finalLog.id ? finalLog : l);
      set({
        logs: updatedLogs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update log'
      });
    }
  },

  deleteLog: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteOvertimeLog(id, userId ?? null);
      const { logs } = get();
      const filteredLogs = logs.filter(l => l.id !== id);
      set({
        logs: filteredLogs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete log'
      });
    }
  },

  markReady: async (id: string, userId?: string | null) => {
    const { logs, updateLog } = get();
    const log = logs.find(l => l.id === id);
    if (!log) {
      throw new Error('Log not found');
    }

    const validation = validateLogForReady(log);
    if (!validation.isValid) {
      const errorMessage = `Cannot mark log as ready. Missing required fields:\n• ${validation.missingFields.join('\n• ')}`;
      throw new Error(errorMessage);
    }

    const updatedLog: OvertimeLog = {
      ...log,
      status: 'ready',
      updatedAt: new Date().toISOString()
    };

    await updateLog(updatedLog, userId ?? null);
  },

  batchExport: async (logIds: string[], pdfUri?: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const logsToExport = logs.filter(log => logIds.includes(log.id) && log.status === 'ready');

      if (logsToExport.length === 0) {
        throw new Error('No ready logs to export');
      }

      const batchId = `batch_${Date.now()}`;

      const batch: ExportBatch = {
        id: batchId,
        createdAt: new Date().toISOString(),
        pdfUri: pdfUri || '',
        countLogs: logsToExport.length,
        totalMinutes: logsToExport.reduce((sum, log) => sum + log.minutesOvertime, 0),
        submittedToEmail: undefined
      };

      await database.createExportBatch(batch, userId ?? null);

      const updatedLogs = logs.map(log =>
        logIds.includes(log.id)
          ? { ...log, status: 'exported' as const, exportBatchId: batch.id, updatedAt: new Date().toISOString() }
          : log
      );

      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log, userId ?? null);
        }
      }

      const { exportBatches } = get();
      set({
        logs: updatedLogs,
        exportBatches: [batch, ...exportBatches],
        isLoading: false,
        error: null
      });

      return batch;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to export batch'
      });
      throw error;
    }
  },

  updateExportBatch: async (batch: ExportBatch, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.updateExportBatch(batch, userId ?? null);
      const { exportBatches } = get();
      const updatedBatches = exportBatches.map(b => b.id === batch.id ? batch : b);
      set({
        exportBatches: updatedBatches,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update export batch'
      });
    }
  },

  deleteExportBatch: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteExportBatch(id, userId ?? null);
      const { exportBatches } = get();
      const filteredBatches = exportBatches.filter(b => b.id !== id);
      set({
        exportBatches: filteredBatches,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete export batch'
      });
    }
  },

  markBatchAsSubmitted: async (batchId: string, method: 'email' | 'manual') => {
    set({ isLoading: true, error: null });
    try {
      const { exportBatches } = get();
      const batch = exportBatches.find(b => b.id === batchId);
      if (!batch) {
        throw new Error('Export batch not found');
      }

      const updatedBatch: ExportBatch = {
        ...batch,
        submittedAt: new Date().toISOString(),
        submittedVia: method
      };

      const localUserId = useLocalUserStore.getState().localUserId || null;

      await database.updateExportBatch(updatedBatch, localUserId);
      const updatedBatches = exportBatches.map(b => b.id === batchId ? updatedBatch : b);
      set({
        exportBatches: updatedBatches,
        isLoading: false,
        error: null
      });

      // Check and update unsubmitted AVAC notification after marking as submitted
      const { notificationManager } = require('../notifications');
      notificationManager.checkAndScheduleUnsubmittedAVACNotification(updatedBatches).catch((err: unknown) => {
        debug.error('Failed to check unsubmitted AVAC notification (non-fatal):', err);
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to mark batch as submitted'
      });
    }
  },

  resetLogsToReady: async (logIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const localUserId = useLocalUserStore.getState().localUserId || null;
      const updatedLogs = logs.map(log =>
        logIds.includes(log.id)
          ? { ...log, status: 'ready' as const, exportBatchId: undefined, updatedAt: new Date().toISOString() }
          : log
      );

      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log, localUserId);
        }
      }

      set({
        logs: updatedLogs,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reset logs to ready'
      });
    }
  },

  clearError: () => set({ error: null }),

  // Helper methods
  getLogsByStatus: (status: 'draft' | 'ready' | 'exported') => {
    const { logs } = get();
    return logs.filter(log => log.status === status);
  },

  getDraftLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('draft');
  },

  getReadyLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('ready');
  },

  getExportedLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('exported');
  },

  computeMinutesForLog: (log: OvertimeLog) => {
    return computeMinutes(
      log.actualStart,
      log.actualFinish,
      log.rosteredStart,
      log.rosteredFinish,
      log.mealBreakMinutes || 0
    );
  },

  getTotalMinutes: (logs: OvertimeLog[]) => {
    return logs.reduce((sum, log) => sum + log.minutesOvertime, 0);
  },

  // Active shift management
  getActiveShiftDraft: () => {
    const { logs } = get();
    return logs.find(log => log.status === 'draft' && log.isActiveShift === true) || null;
  },

  clearActiveShift: async (id: string) => {
    const { logs, updateLog } = get();
    const log = logs.find(l => l.id === id);
    if (!log) return;

    const updatedLog: OvertimeLog = {
      ...log,
      isActiveShift: false,
      updatedAt: new Date().toISOString()
    };

    await updateLog(updatedLog);
  },

  markDraftAsStale: async (id: string) => {
    await get().clearActiveShift(id);
  },

  // Duplicate prevention
  hasLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.some(log =>
      log.date === date &&
      (log.status === 'ready' || log.status === 'exported') &&
      !log.isShiftSwap
    );
  },

  getLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.find(log =>
      log.date === date &&
      (log.status === 'ready' || log.status === 'exported') &&
      !log.isShiftSwap
    ) || null;
  },

  // Helper methods for template/yesterday features
  getYesterdayLog: () => {
    const { logs } = get();
    const yesterday = getPreviousISODate(getCurrentDate());
    const yesterdayLogs = logs
      .filter(log => log.date === yesterday)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return yesterdayLogs[0] || null;
  },

  getMostRecentLogBeforeDate: (date: string) => {
    const { logs } = get();
    const logsBeforeDate = logs
      .filter(log => log.date < date)
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return logsBeforeDate[0] || null;
  }
}));
