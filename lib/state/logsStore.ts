import { create } from 'zustand';
import { OvertimeLog, ExportBatch, MinutesCalculation } from '../../types';
import { database } from '../db/sqlite';
import { computeMinutes, roundToNearest5, getPreviousISODate, getCurrentDate } from '../time';
import { useAuthStore } from './authStore';

interface LogsState {
  logs: OvertimeLog[];
  exportBatches: ExportBatch[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadLogs: (userId?: string | null) => Promise<void>;
  loadExportBatches: (userId?: string | null) => Promise<void>;
  addLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
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
        error: null 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load export batches' 
      });
    }
  },

  addLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.createOvertimeLog(log, finalUserId);
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

  updateLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.updateOvertimeLog(log, finalUserId);
      const { logs } = get();
      const updatedLogs = logs.map(l => l.id === log.id ? log : l);
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
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.deleteOvertimeLog(id, finalUserId);
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
    if (!log) return;

    const updatedLog: OvertimeLog = {
      ...log,
      status: 'ready',
      updatedAt: new Date().toISOString()
    };

    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    await updateLog(updatedLog, finalUserId);
  },

  batchExport: async (logIds: string[], pdfUri?: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const logsToExport = logs.filter(log => logIds.includes(log.id) && log.status === 'ready');
      
      if (logsToExport.length === 0) {
        throw new Error('No ready logs to export');
      }

      // Create export batch with PDF URI if provided
      const batch: ExportBatch = {
        id: `batch_${Date.now()}`,
        createdAt: new Date().toISOString(),
        pdfUri: pdfUri || '', // Use provided PDF URI or empty string
        countLogs: logsToExport.length,
        totalMinutes: logsToExport.reduce((sum, log) => sum + log.minutesOvertime, 0),
        submittedToEmail: undefined
      };

      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.createExportBatch(batch, finalUserId);
      
      // Update logs to exported status in both database and store
      const updatedLogs = logs.map(log => 
        logIds.includes(log.id) 
          ? { ...log, status: 'exported' as const, exportBatchId: batch.id, updatedAt: new Date().toISOString() }
          : log
      );

      // Persist each updated log to the database
      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log, finalUserId);
        }
      }

      set({ 
        logs: updatedLogs,
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
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.updateExportBatch(batch, finalUserId);
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
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      await database.deleteExportBatch(id, finalUserId);
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

      await database.updateExportBatch(updatedBatch);
      const updatedBatches = exportBatches.map(b => b.id === batchId ? updatedBatch : b);
      set({ 
        exportBatches: updatedBatches,
        isLoading: false,
        error: null 
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
      const updatedLogs = logs.map(log => 
        logIds.includes(log.id) 
          ? { ...log, status: 'ready' as const, exportBatchId: undefined, updatedAt: new Date().toISOString() }
          : log
      );

      // Persist each updated log to the database
      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log);
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
    // Mark as stale by clearing the active shift flag
    await get().clearActiveShift(id);
  },
  
  // Duplicate prevention
  hasLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.some(log => 
      log.date === date && 
      (log.status === 'ready' || log.status === 'exported')
    );
  },
  
  getLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.find(log => 
      log.date === date && 
      (log.status === 'ready' || log.status === 'exported')
    ) || null;
  },
  
  // Helper methods for template/yesterday features
  getYesterdayLog: () => {
    const { logs } = get();
    const yesterday = getPreviousISODate(getCurrentDate());
    // Find the most recent log from yesterday (could be draft, ready, or exported)
    // Sort by createdAt descending to get the most recent one
    const yesterdayLogs = logs
      .filter(log => log.date === yesterday)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return yesterdayLogs[0] || null;
  },
  
  getMostRecentLogBeforeDate: (date: string) => {
    const { logs } = get();
    // Find logs with date before the given date, sorted by date descending, then by createdAt descending
    const logsBeforeDate = logs
      .filter(log => log.date < date)
      .sort((a, b) => {
        // First sort by date descending
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        // Then sort by createdAt descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    
    return logsBeforeDate[0] || null;
  }
}));
