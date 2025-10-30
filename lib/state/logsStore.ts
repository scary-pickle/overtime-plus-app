import { create } from 'zustand';
import { OvertimeLog, ExportBatch, MinutesCalculation } from '../../types';
import { database } from '../db/sqlite';
import { computeMinutes, roundToNearest5 } from '../time';

interface LogsState {
  logs: OvertimeLog[];
  exportBatches: ExportBatch[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadLogs: () => Promise<void>;
  loadExportBatches: () => Promise<void>;
  addLog: (log: OvertimeLog) => Promise<void>;
  updateLog: (log: OvertimeLog) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  markReady: (id: string) => Promise<void>;
  batchExport: (logIds: string[], pdfUri?: string) => Promise<ExportBatch>;
  updateExportBatch: (batch: ExportBatch) => Promise<void>;
  deleteExportBatch: (id: string) => Promise<void>;
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
}

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  exportBatches: [],
  isLoading: false,
  error: null,

  loadLogs: async () => {
    console.log('🔄 loadLogs: Starting to load logs from database...');
    set({ isLoading: true, error: null });
    try {
      const logs = await database.getOvertimeLogs();
      console.log('✅ loadLogs: Loaded', logs.length, 'logs from database');
      console.log('📋 loadLogs: Logs details:', logs.map(l => ({ id: l.id, status: l.status, isActiveShift: l.isActiveShift })));
      set({ 
        logs, 
        isLoading: false,
        error: null 
      });
      console.log('✅ loadLogs: Store updated with loaded logs');
    } catch (error) {
      console.error('❌ loadLogs: Error loading logs:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load logs' 
      });
    }
  },

  loadExportBatches: async () => {
    set({ isLoading: true, error: null });
    try {
      const exportBatches = await database.getExportBatches();
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

  addLog: async (log: OvertimeLog) => {
    console.log('💾 addLog called with:', { id: log.id, status: log.status, isActiveShift: log.isActiveShift });
    set({ isLoading: true, error: null });
    try {
      await database.createOvertimeLog(log);
      console.log('✅ Database save successful');
      const { logs } = get();
      console.log('📊 Current logs count before add:', logs.length);
      set({ 
        logs: [log, ...logs], 
        isLoading: false,
        error: null 
      });
      console.log('✅ Log added to store, new count:', [log, ...logs].length);
    } catch (error) {
      console.error('❌ Error adding log:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add log' 
      });
    }
  },

  updateLog: async (log: OvertimeLog) => {
    set({ isLoading: true, error: null });
    try {
      await database.updateOvertimeLog(log);
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

  deleteLog: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteOvertimeLog(id);
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

  markReady: async (id: string) => {
    const { logs, updateLog } = get();
    const log = logs.find(l => l.id === id);
    if (!log) return;

    const updatedLog: OvertimeLog = {
      ...log,
      status: 'ready',
      updatedAt: new Date().toISOString()
    };

    await updateLog(updatedLog);
  },

  batchExport: async (logIds: string[], pdfUri?: string) => {
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

      await database.createExportBatch(batch);
      
      // Update logs to exported status in both database and store
      const updatedLogs = logs.map(log => 
        logIds.includes(log.id) 
          ? { ...log, status: 'exported' as const, exportBatchId: batch.id, updatedAt: new Date().toISOString() }
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

      return batch;
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to export batch' 
      });
      throw error;
    }
  },

  updateExportBatch: async (batch: ExportBatch) => {
    set({ isLoading: true, error: null });
    try {
      await database.updateExportBatch(batch);
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

  deleteExportBatch: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteExportBatch(id);
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
    console.log('🔍 getActiveShiftDraft: Searching through', logs.length, 'logs');
    const draftLogs = logs.filter(log => log.status === 'draft');
    console.log('📝 Draft logs:', draftLogs.length);
    const activeDrafts = logs.filter(log => log.status === 'draft' && log.isActiveShift === true);
    console.log('⭐ Active shift drafts:', activeDrafts.length);
    if (activeDrafts.length > 0) {
      console.log('✅ Found active draft:', activeDrafts[0].id);
    }
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
  }
}));
