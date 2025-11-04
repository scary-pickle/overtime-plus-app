import { create } from 'zustand';
import { UsualShift, RosterForDate } from '../../types';
import { database } from '../db/sqlite';
import { getRosterForDate } from '../roster';
import { useAuthStore } from './authStore';
import { shiftsSync } from '../supabase';

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
    console.log('🔄 ShiftsStore: Loading shifts from database...', { userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const shifts = await database.getUsualShifts(userId);
      console.log('✅ ShiftsStore: Loaded shifts successfully:', {
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
          if (remoteShifts.length > 0) {
            console.log('[shiftsStore.loadShifts] Syncing shifts from Supabase in background', {
              remoteCount: remoteShifts.length,
              localCount: shifts.length,
            });
            
            // Merge remote shifts with local (remote wins for conflicts)
            const localShiftMap = new Map(shifts.map(shift => [shift.id, shift]));
            const remoteShiftMap = new Map(remoteShifts.map(shift => [shift.id, shift]));
            
            const mergedShifts = [
              ...remoteShifts,
              ...shifts.filter(shift => !remoteShiftMap.has(shift.id))
            ];
            
            // Save merged shifts to local storage
            for (const shift of mergedShifts) {
              if (remoteShiftMap.has(shift.id)) {
                // Update from remote
                database.updateUsualShift(shift, userId).catch(err => {
                  console.error('[shiftsStore.loadShifts] Failed to save merged shift:', err);
                });
              }
            }
            
            // Update store with merged shifts
            set({ shifts: mergedShifts });
          }
        }).catch(err => {
          console.error('[shiftsStore.loadShifts] Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to load shifts:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load shifts' 
      });
    }
  },

  addShift: async (shift: UsualShift, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    console.log('➕ ShiftsStore: Adding new shift:', {
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
      console.log('✅ ShiftsStore: Shift added successfully');
      set({ 
        shifts: [...shifts, shift], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.uploadShift(shift, finalUserId).catch(err => {
          console.error('[shiftsStore.addShift] Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to add shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add shift' 
      });
    }
  },

  updateShift: async (shift: UsualShift, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    console.log('✏️ ShiftsStore: Updating shift:', {
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
      console.log('✅ ShiftsStore: Shift updated successfully');
      set({ 
        shifts: updatedShifts, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.uploadShift(shift, finalUserId).catch(err => {
          console.error('[shiftsStore.updateShift] Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to update shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update shift' 
      });
    }
  },

  deleteShift: async (id: string, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    console.log('🗑️ ShiftsStore: Deleting shift:', { id, userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Delete from local SQLite first
      await database.deleteUsualShift(id, finalUserId);
      const { shifts } = get();
      const filteredShifts = shifts.filter(s => s.id !== id);
      console.log('✅ ShiftsStore: Shift deleted successfully');
      set({ 
        shifts: filteredShifts, 
        isLoading: false,
        error: null 
      });
      
      // Sync delete to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftsSync.deleteShift(id, finalUserId).catch(err => {
          console.error('[shiftsStore.deleteShift] Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to delete shift:', error);
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
    const today = now.toISOString().split('T')[0];
    
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
    const today = now.toISOString().split('T')[0];
    
    return shifts.filter(shift => {
      return shift.activeFrom <= today && 
        (!shift.activeTo || shift.activeTo >= today);
    });
  }
}));
