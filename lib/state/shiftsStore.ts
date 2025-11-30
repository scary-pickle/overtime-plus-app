import { create } from 'zustand';
import { UsualShift, RosterForDate } from '../../types';
import { database } from '../db/sqlite';
import { getRosterForDate } from '../roster';
import { formatDateToISO } from '../time';
import { useAuthStore } from './authStore';
import { shiftsSync } from '../supabase';
import { createScopedLogger } from '../utils/logger';

const devLog = createScopedLogger('shiftsStore');

interface ShiftsState {
  shifts: UsualShift[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadShifts: (userId?: string | null) => Promise<void>;
  addShift: (shift: UsualShift, userId?: string | null) => Promise<void>;
  updateShift: (shift: UsualShift, userId?: string | null) => Promise<void>;
  deleteShift: (id: string, userId?: string | null) => Promise<void>;
  clearError: () => void;
  
  // Helper methods
  getRosterFor: (date: string) => RosterForDate | null;
  getShiftsForDay: (dayOfWeek: number, weekIndex?: 1 | 2) => UsualShift[];
  getActiveShifts: () => UsualShift[];
}

export const useShiftsStore = create<ShiftsState>((set, get) => ({
  shifts: [],
  isLoading: false,
  error: null,

  loadShifts: async (userId?: string | null) => {
    devLog.debug('🔄 ShiftsStore: Loading shifts from database...', { userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const shifts = await database.getUsualShifts(userId);
      devLog.debug('✅ ShiftsStore: Loaded shifts successfully:', {
        count: shifts.length,
        shifts: shifts.map(s => ({ id: s.id, label: s.label, day: s.dayOfWeek, type: s.type }))
      });
      set({ 
        shifts, 
        isLoading: false,
        error: null 
      });
      
      // Sync from Supabase in background (non-blocking)
      if (userId) {
        shiftsSync.downloadShifts(userId).then(remoteShifts => {
          if (remoteShifts.length > 0 || shifts.length > 0) {
            devLog.debug('[shiftsStore.loadShifts] Syncing shifts from Supabase in background', {
              remoteCount: remoteShifts.length,
              localCount: shifts.length,
            });
            
            // Merge with timestamp-based conflict resolution
            const localShiftMap = new Map(shifts.map(shift => [shift.id, shift]));
            const remoteShiftMap = new Map(remoteShifts.map(shift => [shift.id, shift]));
            
            const mergedShifts: UsualShift[] = [];
            const allShiftIds = new Set([...localShiftMap.keys(), ...remoteShiftMap.keys()]);
            
            // Process all shifts with timestamp comparison (using activeFrom as proxy)
            for (const shiftId of allShiftIds) {
              const localShift = localShiftMap.get(shiftId);
              const remoteShift = remoteShiftMap.get(shiftId);
              
              if (localShift && remoteShift) {
                // Both exist - compare by activeFrom (proxy for timestamp)
                const localTime = new Date(localShift.activeFrom);
                const remoteTime = new Date(remoteShift.activeFrom);
                
                if (localTime > remoteTime) {
                  // Local is newer - use local and upload it
                  mergedShifts.push(localShift);
                  shiftsSync.uploadShift(localShift, userId).catch(err => {
                    devLog.error('Failed to upload newer local shift:', err);
                    // Add to sync queue for retry
                    const { syncQueue } = require('../sync/queue');
                    syncQueue.add({
                      type: 'shift',
                      operation: 'update',
                      data: localShift,
                      userId,
                    }).catch(() => {});
                  });
                } else {
                  // Remote is newer - use remote and save it locally
                  mergedShifts.push(remoteShift);
                  database.updateUsualShift(remoteShift, userId).catch(err => {
                    devLog.error('Failed to save merged shift:', err);
                  });
                }
              } else if (localShift) {
                // Only local - add it and upload if not already synced
                mergedShifts.push(localShift);
                shiftsSync.uploadShift(localShift, userId).catch(err => {
                  devLog.error('Failed to upload local-only shift:', err);
                  // Add to sync queue for retry
                  const { syncQueue } = require('../sync/queue');
                  syncQueue.add({
                    type: 'shift',
                    operation: 'create',
                    data: localShift,
                    userId,
                  }).catch(() => {});
                });
              } else if (remoteShift) {
                // Only remote - add it and save locally
                mergedShifts.push(remoteShift);
                database.createUsualShift(remoteShift, userId).catch(err => {
                  devLog.error('Failed to save remote-only shift:', err);
                });
              }
            }
            
            // Update store with merged shifts
            set({ shifts: mergedShifts });
          }
        }).catch(err => {
          devLog.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      devLog.error('Failed to load shifts:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load shifts' 
      });
    }
  },

  addShift: async (shift: UsualShift, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog.debug('➕ ShiftsStore: Adding new shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type,
      times: `${shift.rosteredStart}-${shift.rosteredFinish}`,
      userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      // Save to local SQLite first
      await database.createUsualShift(shift, finalUserId);
      const { shifts } = get();
      devLog.debug('✅ ShiftsStore: Shift added successfully');
      set({ 
        shifts: [...shifts, shift], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.uploadShift(shift, finalUserId).catch(err => {
          devLog.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift',
            operation: 'create',
            data: shift,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
      
      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      const { shifts: updatedShifts } = get();
      notificationManager.scheduleRolling7Days(updatedShifts).catch(err => {
        devLog.error('Failed to schedule notifications (non-fatal):', err);
      });
    } catch (error) {
      devLog.error('Failed to add shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add shift' 
      });
    }
  },

  updateShift: async (shift: UsualShift, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog.debug('✏️ ShiftsStore: Updating shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type,
      userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      // Update local SQLite first
      await database.updateUsualShift(shift, finalUserId);
      const { shifts } = get();
      const updatedShifts = shifts.map(s => s.id === shift.id ? shift : s);
      devLog.debug('✅ ShiftsStore: Shift updated successfully');
      set({ 
        shifts: updatedShifts, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.uploadShift(shift, finalUserId).catch(err => {
          devLog.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift',
            operation: 'update',
            data: shift,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
      
      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      notificationManager.scheduleRolling7Days(updatedShifts).catch(err => {
        devLog.error('Failed to schedule notifications (non-fatal):', err);
      });
    } catch (error) {
      devLog.error('Failed to update shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update shift' 
      });
    }
  },

  deleteShift: async (id: string, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog.debug('🗑️ ShiftsStore: Deleting shift:', { id, userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Delete from local SQLite first
      await database.deleteUsualShift(id, finalUserId);
      const { shifts } = get();
      const filteredShifts = shifts.filter(s => s.id !== id);
      devLog.debug('✅ ShiftsStore: Shift deleted successfully');
      set({ 
        shifts: filteredShifts, 
        isLoading: false,
        error: null 
      });
      
      // Sync delete to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.deleteShift(id, finalUserId).catch(err => {
          devLog.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift',
            operation: 'delete',
            data: { id },
            userId: finalUserId,
          }).catch(() => {});
        });
      }
      
      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      notificationManager.scheduleRolling7Days(filteredShifts).catch(err => {
        devLog.error('Failed to schedule notifications (non-fatal):', err);
      });
    } catch (error) {
      devLog.error('Failed to delete shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete shift' 
      });
    }
  },

  clearError: () => set({ error: null }),

  // Helper methods
  getRosterFor: (date: string) => {
    const { shifts } = get();
    return getRosterForDate(date, shifts);
  },

  getShiftsForDay: (dayOfWeek: number, weekIndex?: 1 | 2) => {
    const { shifts } = get();
    const now = new Date();
    const today = formatDateToISO(now);
    
    return shifts.filter(shift => {
      // Check if shift is active
      const isActive = shift.activeFrom <= today && 
        (!shift.activeTo || shift.activeTo >= today);
      
      if (!isActive) return false;
      
      // Check day of week
      if (shift.dayOfWeek !== dayOfWeek) return false;
      
      // For biweekly shifts, check week index
      if (shift.type === 'biweekly' && shift.weekIndex) {
        if (weekIndex && shift.weekIndex !== weekIndex) return false;
      }
      
      return true;
    });
  },

  getActiveShifts: () => {
    const { shifts } = get();
    const now = new Date();
    const today = formatDateToISO(now);
    
    return shifts.filter(shift => {
      return shift.activeFrom <= today && 
        (!shift.activeTo || shift.activeTo >= today);
    });
  }
}));
