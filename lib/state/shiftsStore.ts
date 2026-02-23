import { create } from 'zustand';
import { UsualShift, RosterForDate } from '../../types';
import { database } from '../db/sqlite';
import { getRosterForDate } from '../roster';
import { formatDateToISO } from '../time';
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
    } catch (error) {
      devLog.error('Failed to load shifts:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load shifts'
      });
    }
  },

  addShift: async (shift: UsualShift, userId?: string | null) => {
    devLog.debug('➕ ShiftsStore: Adding new shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type,
      times: `${shift.rosteredStart}-${shift.rosteredFinish}`,
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      await database.createUsualShift(shift, userId ?? null);
      const { shifts } = get();
      devLog.debug('✅ ShiftsStore: Shift added successfully');
      set({
        shifts: [...shifts, shift],
        isLoading: false,
        error: null
      });

      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      const { shifts: updatedShifts } = get();
      notificationManager.scheduleRolling7Days(updatedShifts).catch((err: unknown) => {
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
    devLog.debug('✏️ ShiftsStore: Updating shift:', {
      id: shift.id,
      label: shift.label,
      day: shift.dayOfWeek,
      type: shift.type,
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      await database.updateUsualShift(shift, userId ?? null);
      const { shifts } = get();
      const updatedShifts = shifts.map(s => s.id === shift.id ? shift : s);
      devLog.debug('✅ ShiftsStore: Shift updated successfully');
      set({
        shifts: updatedShifts,
        isLoading: false,
        error: null
      });

      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      notificationManager.scheduleRolling7Days(updatedShifts).catch((err: unknown) => {
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
    devLog.debug('🗑️ ShiftsStore: Deleting shift:', { id, userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      await database.deleteUsualShift(id, userId ?? null);
      const { shifts } = get();
      const filteredShifts = shifts.filter(s => s.id !== id);
      devLog.debug('✅ ShiftsStore: Shift deleted successfully');
      set({
        shifts: filteredShifts,
        isLoading: false,
        error: null
      });

      // Schedule notifications for updated shift schedule
      const { notificationManager } = require('../notifications');
      notificationManager.scheduleRolling7Days(filteredShifts).catch((err: unknown) => {
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
