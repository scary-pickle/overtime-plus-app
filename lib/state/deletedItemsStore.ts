import { create } from 'zustand';
import { OvertimeLog, UsualShift, ExportBatch } from '../../types';
import { database } from '../db/sqlite';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('deletedItemsStore');

interface DeletedItemsState {
  deletedLogs: OvertimeLog[];
  deletedShifts: UsualShift[];
  deletedBatches: ExportBatch[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDeletedItems: (userId?: string | null) => Promise<void>;
  restoreLog: (id: string, userId?: string | null) => Promise<void>;
  restoreShift: (id: string, userId?: string | null) => Promise<void>;
  restoreBatch: (id: string, userId?: string | null) => Promise<void>;
  permanentlyDeleteLog: (id: string, userId?: string | null) => Promise<void>;
  permanentlyDeleteShift: (id: string, userId?: string | null) => Promise<void>;
  permanentlyDeleteBatch: (id: string, userId?: string | null) => Promise<void>;
  cleanupOldItems: (userId?: string | null) => Promise<{ logsDeleted: number; shiftsDeleted: number; batchesDeleted: number }>;
  deleteAllItems: (userId?: string | null) => Promise<{ logsDeleted: number; shiftsDeleted: number; batchesDeleted: number }>;
  clearError: () => void;
}

export const useDeletedItemsStore = create<DeletedItemsState>((set, get) => ({
  deletedLogs: [],
  deletedShifts: [],
  deletedBatches: [],
  isLoading: false,
  error: null,

  loadDeletedItems: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const [logs, shifts, batches] = await Promise.all([
        database.getDeletedLogs(userId ?? null),
        database.getDeletedShifts(userId ?? null),
        database.getDeletedExportBatches(userId ?? null),
      ]);

      set({
        deletedLogs: logs,
        deletedShifts: shifts,
        deletedBatches: batches,
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load deleted items'
      });
    }
  },

  restoreLog: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.restoreLog(id, userId ?? null);

      const { deletedLogs } = get();
      set({
        deletedLogs: deletedLogs.filter(l => l.id !== id),
        isLoading: false,
        error: null
      });

      // Reload the logs in the main store
      const { useLogsStore } = await import('./logsStore');
      await useLogsStore.getState().loadLogs(userId ?? null);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to restore log'
      });
    }
  },

  restoreShift: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.restoreShift(id, userId ?? null);

      const { deletedShifts } = get();
      set({
        deletedShifts: deletedShifts.filter(s => s.id !== id),
        isLoading: false,
        error: null
      });

      // Reload the shifts in the main store
      const { useShiftsStore } = await import('./shiftsStore');
      await useShiftsStore.getState().loadShifts(userId ?? null);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to restore shift'
      });
    }
  },

  restoreBatch: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.restoreExportBatch(id, userId ?? null);

      const { deletedBatches } = get();
      set({
        deletedBatches: deletedBatches.filter(b => b.id !== id),
        isLoading: false,
        error: null
      });

      // Reload the export batches in the main store
      const { useLogsStore } = await import('./logsStore');
      await useLogsStore.getState().loadExportBatches(userId ?? null);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to restore export batch'
      });
    }
  },

  permanentlyDeleteLog: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.permanentlyDeleteLog(id, userId ?? null);

      const { deletedLogs } = get();
      set({
        deletedLogs: deletedLogs.filter(l => l.id !== id),
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to permanently delete log'
      });
    }
  },

  permanentlyDeleteShift: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.permanentlyDeleteShift(id, userId ?? null);

      const { deletedShifts } = get();
      set({
        deletedShifts: deletedShifts.filter(s => s.id !== id),
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to permanently delete shift'
      });
    }
  },

  permanentlyDeleteBatch: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.permanentlyDeleteExportBatch(id, userId ?? null);

      const { deletedBatches } = get();
      set({
        deletedBatches: deletedBatches.filter(b => b.id !== id),
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to permanently delete export batch'
      });
    }
  },

  cleanupOldItems: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const result = await database.cleanupOldDeletedItems(userId ?? null);

      // Reload deleted items to reflect cleanup
      await get().loadDeletedItems(userId ?? null);

      return result;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup old items'
      });
      throw error;
    }
  },

  deleteAllItems: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const result = await database.deleteAllDeletedItems(userId ?? null);

      set({
        deletedLogs: [],
        deletedShifts: [],
        deletedBatches: [],
        isLoading: false,
        error: null
      });

      return result;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete all items'
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
