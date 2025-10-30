import * as SQLite from 'expo-sqlite';
import { UsualShift, OvertimeLog, ExportBatch } from '../../types';

const DB_NAME = 'overtime_plus.db';
const DB_VERSION = 1;

class Database {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create usual_shifts table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS usual_shifts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('weekly', 'biweekly', 'custom')),
        week_index INTEGER CHECK (week_index IN (1, 2)),
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        rostered_start TEXT NOT NULL,
        rostered_finish TEXT NOT NULL,
        meal_break_minutes INTEGER DEFAULT 0,
        active_from TEXT NOT NULL,
        active_to TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create overtime_logs table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS overtime_logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        rostered_start TEXT,
        rostered_finish TEXT,
        actual_start TEXT NOT NULL,
        actual_finish TEXT NOT NULL,
        meal_break_minutes INTEGER DEFAULT 0,
        minutes_overtime INTEGER NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('Overtime', 'Oncall', 'HP Emergency Clinical on Call', 'HPDO Priority on Call', 'Recall Offsite', 'Recall Onsite', 'Recall Offsite Normal Duties (QPSOOE award)', 'Recall Telephone Advice (Medical)', 'Change shift', 'Change shift - cancel leave')),
        comments TEXT,
        initials TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'ready', 'exported')),
        export_batch_id TEXT,
        source TEXT NOT NULL CHECK (source IN ('manual', 'geofence-proposed', 'imported')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create export_batches table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS export_batches (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        pdf_uri TEXT NOT NULL,
        count_logs INTEGER NOT NULL,
        total_minutes INTEGER NOT NULL,
        submitted_to_email TEXT,
        custom_name TEXT
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_date ON overtime_logs(date);
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_status ON overtime_logs(status);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_active ON usual_shifts(active_from, active_to);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_type ON usual_shifts(type, day_of_week);
    `);

    // Run migrations
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Migration: Add custom_name column to export_batches if it doesn't exist
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN custom_name TEXT;
      `);
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add is_active_shift column to overtime_logs
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN is_active_shift INTEGER DEFAULT 0;
      `);
      console.log('✅ Added is_active_shift column');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add concurrent_employment column to overtime_logs
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN concurrent_employment INTEGER DEFAULT 0;
      `);
      console.log('✅ Added concurrent_employment column');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add smo_categories column to overtime_logs (stored as JSON string)
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN smo_categories TEXT;
      `);
      console.log('✅ Added smo_categories column');
    } catch (error) {
      // Column already exists, which is fine
    }
  }

  // UsualShifts CRUD
  async createUsualShift(shift: UsualShift): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO usual_shifts (
        id, label, type, week_index, day_of_week, rostered_start, rostered_finish,
        meal_break_minutes, active_from, active_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shift.id, shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
      shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
      shift.activeFrom, shift.activeTo || null, new Date().toISOString(), new Date().toISOString()
    ]);
  }

  async getUsualShifts(): Promise<UsualShift[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(`
      SELECT * FROM usual_shifts ORDER BY label, day_of_week
    `);

    return result.map((row: any) => ({
      id: row.id as string,
      label: row.label as string,
      type: row.type as 'weekly' | 'biweekly' | 'custom',
      weekIndex: row.week_index as 1 | 2 | undefined,
      dayOfWeek: row.day_of_week as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      rosteredStart: row.rostered_start as string,
      rosteredFinish: row.rostered_finish as string,
      mealBreakMinutes: row.meal_break_minutes as number,
      activeFrom: row.active_from as string,
      activeTo: row.active_to as string | undefined
    }));
  }

  async updateUsualShift(shift: UsualShift): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      UPDATE usual_shifts SET
        label = ?, type = ?, week_index = ?, day_of_week = ?, rostered_start = ?,
        rostered_finish = ?, meal_break_minutes = ?, active_from = ?, active_to = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
      shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
      shift.activeFrom, shift.activeTo || null, new Date().toISOString(), shift.id
    ]);
  }

  async deleteUsualShift(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      DELETE FROM usual_shifts WHERE id = ?
    `, [id]);
  }

  // OvertimeLogs CRUD
  async createOvertimeLog(log: OvertimeLog): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO overtime_logs (
        id, date, rostered_start, rostered_finish, actual_start, actual_finish,
        meal_break_minutes, minutes_overtime, category, comments,
        initials, status, export_batch_id, source, is_active_shift, concurrent_employment,
        smo_categories, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.id, log.date, log.rosteredStart || null, log.rosteredFinish || null,
      log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
      log.category, log.comments || null,
      log.initials, log.status, log.exportBatchId || null, log.source,
      log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
      log.smoCategories ? JSON.stringify(log.smoCategories) : null,
      log.createdAt, log.updatedAt
    ]);
  }

  async getOvertimeLogs(): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(`
      SELECT * FROM overtime_logs ORDER BY date DESC, created_at DESC
    `);

    return result.map((row: any) => ({
      id: row.id as string,
      date: row.date as string,
      rosteredStart: row.rostered_start as string | undefined,
      rosteredFinish: row.rostered_finish as string | undefined,
      actualStart: row.actual_start as string,
      actualFinish: row.actual_finish as string,
      mealBreakMinutes: row.meal_break_minutes as number,
      minutesOvertime: row.minutes_overtime as number,
      category: row.category as 'Overtime' | 'Oncall' | 'HP Emergency Clinical on Call' | 'HPDO Priority on Call' | 'Recall Offsite' | 'Recall Onsite' | 'Recall Offsite Normal Duties (QPSOOE award)' | 'Recall Telephone Advice (Medical)' | 'Change shift' | 'Change shift - cancel leave',
      comments: row.comments as string | undefined,
      initials: row.initials as string,
      status: row.status as 'draft' | 'ready' | 'exported',
      exportBatchId: row.export_batch_id as string | undefined,
      source: row.source as 'manual' | 'geofence-proposed' | 'imported',
      isActiveShift: row.is_active_shift === 1,
      concurrentEmployment: row.concurrent_employment === 1,
      smoCategories: row.smo_categories ? JSON.parse(row.smo_categories) : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }));
  }

  async getOvertimeLogsByStatus(status: 'draft' | 'ready' | 'exported'): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(`
      SELECT * FROM overtime_logs WHERE status = ? ORDER BY date DESC, created_at DESC
    `, [status]);

    return result.map((row: any) => ({
      id: row.id as string,
      date: row.date as string,
      rosteredStart: row.rostered_start as string | undefined,
      rosteredFinish: row.rostered_finish as string | undefined,
      actualStart: row.actual_start as string,
      actualFinish: row.actual_finish as string,
      mealBreakMinutes: row.meal_break_minutes as number,
      minutesOvertime: row.minutes_overtime as number,
      category: row.category as 'Overtime' | 'Oncall' | 'HP Emergency Clinical on Call' | 'HPDO Priority on Call' | 'Recall Offsite' | 'Recall Onsite' | 'Recall Offsite Normal Duties (QPSOOE award)' | 'Recall Telephone Advice (Medical)' | 'Change shift' | 'Change shift - cancel leave',
      comments: row.comments as string | undefined,
      initials: row.initials as string,
      status: row.status as 'draft' | 'ready' | 'exported',
      exportBatchId: row.export_batch_id as string | undefined,
      source: row.source as 'manual' | 'geofence-proposed' | 'imported',
      isActiveShift: row.is_active_shift === 1,
      concurrentEmployment: row.concurrent_employment === 1,
      smoCategories: row.smo_categories ? JSON.parse(row.smo_categories) : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }));
  }

  async updateOvertimeLog(log: OvertimeLog): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      UPDATE overtime_logs SET
        date = ?, rostered_start = ?, rostered_finish = ?, actual_start = ?,
        actual_finish = ?, meal_break_minutes = ?, minutes_overtime = ?, category = ?,
        comments = ?, initials = ?, status = ?,
        export_batch_id = ?, source = ?, is_active_shift = ?, concurrent_employment = ?,
        smo_categories = ?, updated_at = ?
      WHERE id = ?
    `, [
      log.date, log.rosteredStart || null, log.rosteredFinish || null,
      log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
      log.category, log.comments || null,
      log.initials, log.status, log.exportBatchId || null, log.source,
      log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
      log.smoCategories ? JSON.stringify(log.smoCategories) : null,
      new Date().toISOString(), log.id
    ]);
  }

  async deleteOvertimeLog(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      DELETE FROM overtime_logs WHERE id = ?
    `, [id]);
  }

  // ExportBatches CRUD
  async createExportBatch(batch: ExportBatch): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO export_batches (
        id, created_at, pdf_uri, count_logs, total_minutes, submitted_to_email, custom_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      batch.id, batch.createdAt, batch.pdfUri, batch.countLogs,
      batch.totalMinutes, batch.submittedToEmail || null, batch.customName || null
    ]);
  }

  async getExportBatches(): Promise<ExportBatch[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(`
      SELECT * FROM export_batches ORDER BY created_at DESC
    `);

    return result.map((row: any) => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      pdfUri: row.pdf_uri as string,
      countLogs: row.count_logs as number,
      totalMinutes: row.total_minutes as number,
      submittedToEmail: row.submitted_to_email as string | undefined,
      customName: row.custom_name as string | undefined
    }));
  }

  async updateExportBatch(batch: ExportBatch): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      UPDATE export_batches SET
        pdf_uri = ?, submitted_to_email = ?, custom_name = ?
      WHERE id = ?
    `, [
      batch.pdfUri, batch.submittedToEmail || null, batch.customName || null, batch.id
    ]);
  }

  async deleteExportBatch(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      DELETE FROM export_batches WHERE id = ?
    `, [id]);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  // Clear all data methods for testing
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.execAsync('DELETE FROM overtime_logs');
    await this.db.execAsync('DELETE FROM usual_shifts');
    await this.db.execAsync('DELETE FROM export_batches');
  }

  async getDataCounts(): Promise<{ logs: number; shifts: number; batches: number }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const logsResult = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM overtime_logs');
    const shiftsResult = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM usual_shifts');
    const batchesResult = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM export_batches');
    
    return {
      logs: (logsResult as any)?.count || 0,
      shifts: (shiftsResult as any)?.count || 0,
      batches: (batchesResult as any)?.count || 0
    };
  }
}

// Singleton instance
export const database = new Database();
