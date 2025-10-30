import { OvertimeLog } from '../types';

describe('Database Persistence - Active Shift Fields', () => {
  describe('Boolean to Integer Conversion', () => {
    it('should convert isActiveShift true to 1 for database storage', () => {
      const log: OvertimeLog = {
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

      const dbValue = log.isActiveShift ? 1 : 0;
      expect(dbValue).toBe(1);
    });

    it('should convert isActiveShift false to 0 for database storage', () => {
      const log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        isActiveShift: false,
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const dbValue = log.isActiveShift ? 1 : 0;
      expect(dbValue).toBe(0);
    });

    it('should convert isActiveShift undefined to 0 for database storage', () => {
      const log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        // isActiveShift is undefined
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const dbValue = log.isActiveShift ? 1 : 0;
      expect(dbValue).toBe(0);
    });
  });

  describe('Integer to Boolean Conversion', () => {
    it('should convert database value 1 to isActiveShift true', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: 'N/A',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        is_active_shift: 1, // Database INTEGER value
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const isActiveShift = dbRow.is_active_shift === 1;
      expect(isActiveShift).toBe(true);
    });

    it('should convert database value 0 to isActiveShift false', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: '16:00',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        is_active_shift: 0, // Database INTEGER value
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const isActiveShift = dbRow.is_active_shift === 1;
      expect(isActiveShift).toBe(false);
    });

    it('should handle null is_active_shift as false', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: '16:00',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        is_active_shift: null, // Old data without the field
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const isActiveShift = dbRow.is_active_shift === 1;
      expect(isActiveShift).toBe(false);
    });
  });

  describe('SMO Categories JSON Serialization', () => {
    it('should serialize smoCategories object to JSON string', () => {
      const log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        smoCategories: {
          overtime: true,
          oncall: false,
          physicalRecall: true,
          digitalRecall: false,
        },
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const jsonString = log.smoCategories ? JSON.stringify(log.smoCategories) : null;
      expect(jsonString).toBeTruthy();
      expect(typeof jsonString).toBe('string');
      
      const parsed = JSON.parse(jsonString!);
      expect(parsed.overtime).toBe(true);
      expect(parsed.oncall).toBe(false);
    });

    it('should deserialize JSON string back to smoCategories object', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: 'N/A',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        is_active_shift: 1,
        smo_categories: '{"overtime":true,"oncall":false,"physicalRecall":true}',
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const smoCategories = dbRow.smo_categories ? JSON.parse(dbRow.smo_categories) : undefined;
      expect(smoCategories).toBeDefined();
      expect(smoCategories.overtime).toBe(true);
      expect(smoCategories.oncall).toBe(false);
      expect(smoCategories.physicalRecall).toBe(true);
    });

    it('should handle undefined smoCategories as null in database', () => {
      const log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        // smoCategories is undefined
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const jsonString = log.smoCategories ? JSON.stringify(log.smoCategories) : null;
      expect(jsonString).toBeNull();
    });

    it('should handle null smo_categories from database', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: '16:00',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        is_active_shift: 0,
        smo_categories: null,
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const smoCategories = dbRow.smo_categories ? JSON.parse(dbRow.smo_categories) : undefined;
      expect(smoCategories).toBeUndefined();
    });
  });

  describe('Concurrent Employment Field', () => {
    it('should convert concurrentEmployment true to 1', () => {
      const log: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        concurrentEmployment: true,
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const dbValue = log.concurrentEmployment ? 1 : 0;
      expect(dbValue).toBe(1);
    });

    it('should convert database value 1 to concurrentEmployment true', () => {
      const dbRow = {
        id: 'log1',
        date: '2025-10-30',
        actual_start: '08:00',
        actual_finish: 'N/A',
        minutes_overtime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        concurrent_employment: 1,
        source: 'manual',
        created_at: '2025-10-30T08:00:00.000Z',
        updated_at: '2025-10-30T08:00:00.000Z',
      };

      const concurrentEmployment = dbRow.concurrent_employment === 1;
      expect(concurrentEmployment).toBe(true);
    });
  });

  describe('Field Persistence Integrity', () => {
    it('should preserve all active shift related fields through save/load cycle', () => {
      // Original log object
      const originalLog: OvertimeLog = {
        id: 'log1',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        rosteredStart: '08:00',
        rosteredFinish: '16:00',
        mealBreakMinutes: 30,
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true,
        concurrentEmployment: true,
        smoCategories: {
          overtime: true,
          oncall: false,
        },
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      // Simulate database save (convert to db format)
      const dbFormat = {
        id: originalLog.id,
        date: originalLog.date,
        actual_start: originalLog.actualStart,
        actual_finish: originalLog.actualFinish,
        rostered_start: originalLog.rosteredStart,
        rostered_finish: originalLog.rosteredFinish,
        meal_break_minutes: originalLog.mealBreakMinutes,
        minutes_overtime: originalLog.minutesOvertime,
        category: originalLog.category,
        initials: originalLog.initials,
        status: originalLog.status,
        is_active_shift: originalLog.isActiveShift ? 1 : 0,
        concurrent_employment: originalLog.concurrentEmployment ? 1 : 0,
        smo_categories: originalLog.smoCategories ? JSON.stringify(originalLog.smoCategories) : null,
        source: originalLog.source,
        created_at: originalLog.createdAt,
        updated_at: originalLog.updatedAt,
      };

      // Simulate database load (convert back to app format)
      const loadedLog: OvertimeLog = {
        id: dbFormat.id,
        date: dbFormat.date,
        actualStart: dbFormat.actual_start,
        actualFinish: dbFormat.actual_finish,
        rosteredStart: dbFormat.rostered_start,
        rosteredFinish: dbFormat.rostered_finish,
        mealBreakMinutes: dbFormat.meal_break_minutes,
        minutesOvertime: dbFormat.minutes_overtime,
        category: dbFormat.category as any,
        initials: dbFormat.initials,
        status: dbFormat.status as any,
        isActiveShift: dbFormat.is_active_shift === 1,
        concurrentEmployment: dbFormat.concurrent_employment === 1,
        smoCategories: dbFormat.smo_categories ? JSON.parse(dbFormat.smo_categories) : undefined,
        source: dbFormat.source as any,
        createdAt: dbFormat.created_at,
        updatedAt: dbFormat.updated_at,
      };

      // Verify all fields match
      expect(loadedLog.isActiveShift).toBe(originalLog.isActiveShift);
      expect(loadedLog.concurrentEmployment).toBe(originalLog.concurrentEmployment);
      expect(loadedLog.smoCategories?.overtime).toBe(originalLog.smoCategories?.overtime);
      expect(loadedLog.smoCategories?.oncall).toBe(originalLog.smoCategories?.oncall);
    });
  });
});

