import { useLogsStore } from '../lib/state/logsStore';
import { database } from '../lib/db/sqlite';
import { OvertimeLog } from '../types';

// Mock the database
jest.mock('../lib/db/sqlite', () => ({
  database: {
    createOvertimeLog: jest.fn(() => Promise.resolve()),
    updateOvertimeLog: jest.fn(() => Promise.resolve()),
    deleteOvertimeLog: jest.fn(() => Promise.resolve()),
    getOvertimeLogs: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock the auth store
jest.mock('../lib/state/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      user: { id: 'test-user-id' },
    })),
  },
}));

describe('Logs Store - Active Shift Management', () => {
  beforeEach(() => {
    // Reset store state before each test
    useLogsStore.setState({ logs: [], isLoading: false, error: null });
    jest.clearAllMocks();
  });

  describe('getActiveShiftDraft', () => {
    it('should return null when no active shift exists', () => {
      const logs: OvertimeLog[] = [
        {
          id: 'log1',
          date: '2025-10-30',
          actualStart: '08:00',
          actualFinish: '16:00',
          minutesOvertime: 0,
          category: 'Overtime',
          initials: 'ND',
          status: 'draft',
          isActiveShift: false, // Not active
          source: 'manual',
          createdAt: '2025-10-30T08:00:00.000Z',
          updatedAt: '2025-10-30T08:00:00.000Z',
        },
      ];

      useLogsStore.setState({ logs });
      const activeShift = useLogsStore.getState().getActiveShiftDraft();
      expect(activeShift).toBeNull();
    });

    it('should return the active shift draft when it exists', () => {
      const activeLog: OvertimeLog = {
        id: 'log_active',
        date: '2025-10-30',
        actualStart: '08:00',
        actualFinish: 'N/A',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'draft',
        isActiveShift: true, // Active shift
        source: 'manual',
        createdAt: '2025-10-30T08:00:00.000Z',
        updatedAt: '2025-10-30T08:00:00.000Z',
      };

      const logs: OvertimeLog[] = [
        activeLog,
        {
          id: 'log2',
          date: '2025-10-29',
          actualStart: '08:00',
          actualFinish: '16:00',
          minutesOvertime: 0,
          category: 'Overtime',
          initials: 'ND',
          status: 'ready',
          isActiveShift: false,
          source: 'manual',
          createdAt: '2025-10-29T08:00:00.000Z',
          updatedAt: '2025-10-29T08:00:00.000Z',
        },
      ];

      useLogsStore.setState({ logs });
      const activeShift = useLogsStore.getState().getActiveShiftDraft();
      expect(activeShift).toEqual(activeLog);
    });

    it('should only return draft logs with isActiveShift true', () => {
      const logs: OvertimeLog[] = [
        {
          id: 'log_ready',
          date: '2025-10-30',
          actualStart: '08:00',
          actualFinish: '16:00',
          minutesOvertime: 0,
          category: 'Overtime',
          initials: 'ND',
          status: 'ready', // Not draft
          isActiveShift: true,
          source: 'manual',
          createdAt: '2025-10-30T08:00:00.000Z',
          updatedAt: '2025-10-30T08:00:00.000Z',
        },
      ];

      useLogsStore.setState({ logs });
      const activeShift = useLogsStore.getState().getActiveShiftDraft();
      expect(activeShift).toBeNull();
    });
  });

  describe('clearActiveShift', () => {
    it('should set isActiveShift to false for the specified log', async () => {
      const activeLog: OvertimeLog = {
        id: 'log_active',
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

      useLogsStore.setState({ logs: [activeLog] });
      
      await useLogsStore.getState().clearActiveShift('log_active');

      expect(database.updateOvertimeLog).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log_active',
          isActiveShift: false,
        }),
        'test-user-id' // userId parameter
      );
    });

    it('should not error if log does not exist', async () => {
      useLogsStore.setState({ logs: [] });
      await expect(
        useLogsStore.getState().clearActiveShift('nonexistent')
      ).resolves.not.toThrow();
    });
  });

  describe('markDraftAsStale', () => {
    it('should call clearActiveShift with the provided id', async () => {
      const clearActiveShiftSpy = jest.spyOn(
        useLogsStore.getState(),
        'clearActiveShift'
      );

      await useLogsStore.getState().markDraftAsStale('log_stale');

      expect(clearActiveShiftSpy).toHaveBeenCalledWith('log_stale');
    });
  });

  describe('addLog', () => {
    it('should save log with isActiveShift flag to database', async () => {
      const newLog: OvertimeLog = {
        id: 'log_new',
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

      await useLogsStore.getState().addLog(newLog);

      expect(database.createOvertimeLog).toHaveBeenCalledWith(newLog, 'test-user-id');
      
      const logs = useLogsStore.getState().logs;
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(newLog);
    });

    it('should add log to the beginning of the list', async () => {
      const existingLog: OvertimeLog = {
        id: 'log_existing',
        date: '2025-10-29',
        actualStart: '08:00',
        actualFinish: '16:00',
        minutesOvertime: 0,
        category: 'Overtime',
        initials: 'ND',
        status: 'ready',
        source: 'manual',
        createdAt: '2025-10-29T08:00:00.000Z',
        updatedAt: '2025-10-29T08:00:00.000Z',
      };

      useLogsStore.setState({ logs: [existingLog] });

      const newLog: OvertimeLog = {
        id: 'log_new',
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

      await useLogsStore.getState().addLog(newLog);

      const logs = useLogsStore.getState().logs;
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('log_new');
      expect(logs[1].id).toBe('log_existing');
    });
  });
});

