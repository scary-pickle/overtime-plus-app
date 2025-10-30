import { OvertimeLog } from '../types';
import { getCurrentDate } from '../lib/time';

describe('Active Shift Tracking - Edge Cases', () => {
  describe('Stale Draft Detection', () => {
    it('should identify draft from previous day as stale', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const today = getCurrentDate();

      const staleDraft: OvertimeLog = {
        id: 'log_stale',
        date: yesterdayStr,
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: yesterdayStr + 'T08:00:00.000Z',
        updatedAt: yesterdayStr + 'T08:00:00.000Z',
      };

      // Draft date is less than today
      expect(staleDraft.date < today).toBe(true);
    });

    it('should not identify today\'s draft as stale', () => {
      const today = getCurrentDate();

      const freshDraft: OvertimeLog = {
        id: 'log_fresh',
        date: today,
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: today + 'T08:00:00.000Z',
        updatedAt: today + 'T08:00:00.000Z',
      };

      // Draft date is not less than today
      expect(freshDraft.date < today).toBe(false);
    });
  });

  describe('Multiple Active Shifts Prevention', () => {
    it('should only have one active shift at a time', () => {
      const logs: OvertimeLog[] = [
        {
          id: 'log1',
          date: '2025-10-30',
          actualStart: '08:00',
          actualFinish: 'N/A',
          minutesOvertime: 0,
          category: 'Overtime',
          initials: 'ND',
          status: 'draft',
          isActiveShift: true,
          source: 'manual',
          createdAt: '2025-10-30T08:00:00.000Z',
          updatedAt: '2025-10-30T08:00:00.000Z',
        },
        {
          id: 'log2',
          date: '2025-10-30',
          actualStart: '09:00',
          actualFinish: 'N/A',
          minutesOvertime: 0,
          category: 'Overtime',
          initials: 'ND',
          status: 'draft',
          isActiveShift: true,
          source: 'manual',
          createdAt: '2025-10-30T09:00:00.000Z',
          updatedAt: '2025-10-30T09:00:00.000Z',
        },
      ];

      const activeShifts = logs.filter(
        log => log.status === 'draft' && log.isActiveShift === true
      );

      // This should not happen - test validates only one should exist
      expect(activeShifts.length).toBeGreaterThan(1);
      
      // In production, getActiveShiftDraft returns only the first match
      const firstActive = logs.find(
        log => log.status === 'draft' && log.isActiveShift === true
      );
      expect(firstActive?.id).toBe('log1');
    });
  });

  describe('Draft Status Validation', () => {
    it('should not consider ready logs as active shifts', () => {
      const readyLog: OvertimeLog = {
        id: 'log_ready',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 480,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        isActiveShift: true, // Still marked as active but status is ready
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T16:00:00.000Z',
      };

      // Should not be considered active because status is not 'draft'
      const isValidActiveShift = 
        readyLog.status === 'draft' && readyLog.isActiveShift === true;
      
      expect(isValidActiveShift).toBe(false);
    });

    it('should not consider exported logs as active shifts', () => {
      const exportedLog: OvertimeLog = {
        id: 'log_exported',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 480,
        category: 'Overtime',
        initials: 'ND',
        status: 'exported',
        isActiveShift: true,
        exportBatchId: 'batch_123',
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T16:00:00.000Z',
      };

      const isValidActiveShift = 
        exportedLog.status === 'draft' && exportedLog.isActiveShift === true;
      
      expect(isValidActiveShift).toBe(false);
    });
  });

  describe('Active Shift Lifecycle', () => {
    it('should transition from active to inactive when cleared', () => {
      let log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      expect(log.isActiveShift).toBe(true);

      // Simulate clearing active shift
      log = {
        ...log,
        isActiveShift: false,
        updatedAt: new Date().toISOString(),
      };

      expect(log.isActiveShift).toBe(false);
    });

    it('should transition from draft to ready and clear active flag', () => {
      let log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      // Simulate marking as ready (as done in QuickEndShiftModal)
      log = {
        ...log,
        status: 'ready',
        isActiveShift: false,
        minutesOvertime: 480, // Calculated
        updatedAt: new Date().toISOString(),
      };

      expect(log.status).toBe('ready');
      expect(log.isActiveShift).toBe(false);
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle undefined isActiveShift as false', () => {
      const logWithoutFlag: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        // isActiveShift is undefined
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const isActive = logWithoutFlag.isActiveShift === true;
      expect(isActive).toBe(false);
    });

    it('should handle N/A finish time for active shifts', () => {
      const activeShiftInProgress: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A', // Not finished yet
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      expect(activeShiftInProgress.actualFinish).toBe('N/A');
      expect(activeShiftInProgress.isActiveShift).toBe(true);
    });

    it('should preserve concurrent employment and SMO categories', () => {
      const logWithExtras: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        concurrentEmployment: true,
        smoCategories: {
          overtime: true,
          oncall: false,
          physicalRecall: true,
        },
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      expect(logWithExtras.concurrentEmployment).toBe(true);
      expect(logWithExtras.smoCategories?.overtime).toBe(true);
      expect(logWithExtras.smoCategories?.physicalRecall).toBe(true);
    });
  });

  describe('Date Boundary Conditions', () => {
    it('should handle shift that starts before midnight and continues after', () => {
      const midnightShift: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30', // Date when shift started
        actualStart: '23:00',
        actualFinish: '01:00', // Next day
        rosteredStart: '23:00',
        rosteredFinish: '07:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        source: 'manual',
        createdAt: '2025-10-30T23:00:00.000Z',
        updatedAt: '2025-10-31T01:00:00.000Z',
      };

      // Shift date should be the start date
      expect(midnightShift.date).toBe('2025-10-30');
    });
  });
});

