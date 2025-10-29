import { create } from 'zustand';
import { UsualShift, RosterForDate } from '../../types';
import { database } from '../db/sqlite';
import { getRosterForDate } from '../roster';

interface ShiftsState {
  shifts: UsualShift[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadShifts: () => Promise<void>;
  addShift: (shift: UsualShift) => Promise<void>;
  updateShift: (shift: UsualShift) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
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

  loadShifts: async () => {
    console.log('🔄 ShiftsStore: Loading shifts from database...');
    set({ isLoading: true, error: null });
    try {
      const shifts = await database.getUsualShifts();
      console.log('✅ ShiftsStore: Loaded shifts successfully:', {
        count: shifts.length,
        shifts: shifts.map(s => ({ id: s.id, label: s.label, day: s.dayOfWeek, type: s.type }))
      });
      set({ 
        shifts, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to load shifts:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load shifts' 
      });
    }
  },

  addShift: async (shift: UsualShift) => {
    console.log('➕ ShiftsStore: Adding new shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type,
      times: `${shift.rosteredStart}-${shift.rosteredFinish}`
    });
    set({ isLoading: true, error: null });
    try {
      await database.createUsualShift(shift);
      const { shifts } = get();
      console.log('✅ ShiftsStore: Shift added successfully');
      set({ 
        shifts: [...shifts, shift], 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to add shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add shift' 
      });
    }
  },

  updateShift: async (shift: UsualShift) => {
    console.log('✏️ ShiftsStore: Updating shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type
    });
    set({ isLoading: true, error: null });
    try {
      await database.updateUsualShift(shift);
      const { shifts } = get();
      const updatedShifts = shifts.map(s => s.id === shift.id ? shift : s);
      console.log('✅ ShiftsStore: Shift updated successfully');
      set({ 
        shifts: updatedShifts, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('❌ ShiftsStore: Failed to update shift:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update shift' 
      });
    }
  },

  deleteShift: async (id: string) => {
    console.log('🗑️ ShiftsStore: Deleting shift:', id);
    set({ isLoading: true, error: null });
    try {
      await database.deleteUsualShift(id);
      const { shifts } = get();
      const filteredShifts = shifts.filter(s => s.id !== id);
      console.log('✅ ShiftsStore: Shift deleted successfully');
      set({ 
        shifts: filteredShifts, 
        isLoading: false,
        error: null 
      });
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
