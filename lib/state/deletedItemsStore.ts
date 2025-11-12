import { create } from 'zustand';
import { OvertimeLog, UsualShift, ExportBatch } from '../../types';
import { database } from '../db/sqlite';
import { useAuthStore } from './authStore';
import { logsSync, shiftsSync, exportSync } from '../supabase';
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Load deleted items from local database
      const [logs, shifts, batches] = await Promise.all([
        database.getDeletedLogs(finalUserId),
        database.getDeletedShifts(finalUserId),
        database.getDeletedExportBatches(finalUserId),
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Restore in local database
      await database.restoreLog(id, finalUserId);
      
      // Remove from deleted items list
      const { deletedLogs } = get();
      const restoredLog = deletedLogs.find(l => l.id === id);
      set({ 
        deletedLogs: deletedLogs.filter(l => l.id !== id),
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background
      if (finalUserId && restoredLog) {
        const logWithoutDeletedAt = { ...restoredLog, deletedAt: undefined };
        logsSync.uploadLog(logWithoutDeletedAt, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
      
      // Reload the logs in the main store
      const { useLogsStore } = await import('./logsStore');
      await useLogsStore.getState().loadLogs(finalUserId);
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Restore in local database
      await database.restoreShift(id, finalUserId);
      
      // Remove from deleted items list
      const { deletedShifts } = get();
      const restoredShift = deletedShifts.find(s => s.id === id);
      set({ 
        deletedShifts: deletedShifts.filter(s => s.id !== id),
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background
      if (finalUserId && restoredShift) {
        const shiftWithoutDeletedAt = { ...restoredShift, deletedAt: undefined };
        shiftsSync.uploadShift(shiftWithoutDeletedAt, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
      
      // Reload the shifts in the main store
      const { useShiftsStore } = await import('./shiftsStore');
      await useShiftsStore.getState().loadShifts(finalUserId);
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Restore in local database
      await database.restoreExportBatch(id, finalUserId);
      
      // Remove from deleted items list
      const { deletedBatches } = get();
      const restoredBatch = deletedBatches.find(b => b.id === id);
      set({ 
        deletedBatches: deletedBatches.filter(b => b.id !== id),
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background
      if (finalUserId && restoredBatch) {
        const batchWithoutDeletedAt = { ...restoredBatch, deletedAt: undefined };
        exportSync.uploadExportBatch(batchWithoutDeletedAt, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
      
      // Reload the export batches in the main store
      const { useLogsStore } = await import('./logsStore');
      await useLogsStore.getState().loadExportBatches(finalUserId);
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Permanently delete from local database
      await database.permanentlyDeleteLog(id, finalUserId);
      
      // Remove from deleted items list
      const { deletedLogs } = get();
      set({ 
        deletedLogs: deletedLogs.filter(l => l.id !== id),
        isLoading: false,
        error: null 
      });
      
      // Note: Cloud version will auto-delete after 30 days
      // No need to explicitly delete from cloud here
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Permanently delete from local database
      await database.permanentlyDeleteShift(id, finalUserId);
      
      // Remove from deleted items list
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Permanently delete from local database
      await database.permanentlyDeleteExportBatch(id, finalUserId);
      
      // Remove from deleted items list
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
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Clean up items deleted more than 30 days ago
      const result = await database.cleanupOldDeletedItems(finalUserId);
      
      // Reload deleted items to reflect cleanup
      await get().loadDeletedItems(finalUserId);
      
      return result;
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to cleanup old items' 
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

