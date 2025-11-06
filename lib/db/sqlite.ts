import * as SQLite from 'expo-sqlite';
import { UsualShift, OvertimeLog, ExportBatch, LogTemplate } from '../../types';

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

    // Create log_templates table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS log_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rostered_start TEXT,
        rostered_finish TEXT,
        meal_break_minutes INTEGER DEFAULT 0,
        category TEXT NOT NULL CHECK (category IN ('Overtime', 'Oncall', 'HP Emergency Clinical on Call', 'HPDO Priority on Call', 'Recall Offsite', 'Recall Onsite', 'Recall Offsite Normal Duties (QPSOOE award)', 'Recall Telephone Advice (Medical)', 'Change shift', 'Change shift - cancel leave')),
        comments TEXT,
        concurrent_employment INTEGER DEFAULT 0,
        smo_categories TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create auth_sessions table for Supabase auth session storage
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_date ON overtime_logs(date);
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_status ON overtime_logs(status);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_active ON usual_shifts(active_from, active_to);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_type ON usual_shifts(type, day_of_week);
      CREATE INDEX IF NOT EXISTS idx_log_templates_name ON log_templates(name);
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
      // Migration: Add user_id columns to tables for multi-user support
      await this.db.execAsync(`
        ALTER TABLE usual_shifts ADD COLUMN user_id TEXT;
      `);
      console.log('✅ Added user_id column to usual_shifts');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN user_id TEXT;
      `);
      console.log('✅ Added user_id column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN user_id TEXT;
      `);
      console.log('✅ Added user_id column to export_batches');
    } catch (error) {
      // Column already exists, which is fine
    }

    // Clear old data without user_id when a new authenticated user signs in
    // This is done via a method that can be called explicitly, not automatically

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

    // Migration: Remove actual_start and actual_finish from log_templates if they exist
    // SQLite doesn't support DROP COLUMN directly, so we'll recreate the table
    try {
      const tableInfo = await this.db.getAllAsync(`
        PRAGMA table_info(log_templates);
      `);
      const hasActualStart = tableInfo.some((col: any) => col.name === 'actual_start');
      
      if (hasActualStart) {
        console.log('🔄 Migrating log_templates table to remove actual_start/actual_finish...');
        // Create new table without actual_start and actual_finish
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS log_templates_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            rostered_start TEXT,
            rostered_finish TEXT,
            meal_break_minutes INTEGER DEFAULT 0,
            category TEXT NOT NULL CHECK (category IN ('Overtime', 'Oncall', 'HP Emergency Clinical on Call', 'HPDO Priority on Call', 'Recall Offsite', 'Recall Onsite', 'Recall Offsite Normal Duties (QPSOOE award)', 'Recall Telephone Advice (Medical)', 'Change shift', 'Change shift - cancel leave')),
            comments TEXT,
            concurrent_employment INTEGER DEFAULT 0,
            smo_categories TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `);
        
        // Copy data from old table to new (excluding actual_start and actual_finish)
        await this.db.execAsync(`
          INSERT INTO log_templates_new 
            (id, name, rostered_start, rostered_finish, meal_break_minutes, category, comments, concurrent_employment, smo_categories, created_at, updated_at)
          SELECT 
            id, name, rostered_start, rostered_finish, meal_break_minutes, category, comments, concurrent_employment, smo_categories, created_at, updated_at
          FROM log_templates;
        `);
        
        // Drop old table and rename new one
        await this.db.execAsync(`DROP TABLE log_templates;`);
        await this.db.execAsync(`ALTER TABLE log_templates_new RENAME TO log_templates;`);
        
        // Recreate index
        await this.db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_log_templates_name ON log_templates(name);
        `);
        
        console.log('✅ Migrated log_templates table successfully');
      }
    } catch (error) {
      console.error('Migration error (may be fine if table doesn\'t exist yet):', error);
      // Migration error is okay - table might not exist yet or might already be migrated
    }
  }

  // UsualShifts CRUD
  async createUsualShift(shift: UsualShift, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO usual_shifts (
        id, label, type, week_index, day_of_week, rostered_start, rostered_finish,
        meal_break_minutes, active_from, active_to, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shift.id, shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
      shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
      shift.activeFrom, shift.activeTo || null, userId || null,
      new Date().toISOString(), new Date().toISOString()
    ]);
  }

  async getUsualShifts(userId?: string | null): Promise<UsualShift[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM usual_shifts WHERE user_id = ? ORDER BY label, day_of_week`
      : `SELECT * FROM usual_shifts WHERE user_id IS NULL ORDER BY label, day_of_week`;
    const params = userId ? [userId] : [];
    
    const result = await this.db.getAllAsync(query, params);

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

  async updateUsualShift(shift: UsualShift, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE usual_shifts SET
          label = ?, type = ?, week_index = ?, day_of_week = ?, rostered_start = ?,
          rostered_finish = ?, meal_break_minutes = ?, active_from = ?, active_to = ?,
          updated_at = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE usual_shifts SET
          label = ?, type = ?, week_index = ?, day_of_week = ?, rostered_start = ?,
          rostered_finish = ?, meal_break_minutes = ?, active_from = ?, active_to = ?,
          updated_at = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [
          shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
          shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
          shift.activeFrom, shift.activeTo || null, new Date().toISOString(), shift.id, userId
        ]
      : [
          shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
          shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
          shift.activeFrom, shift.activeTo || null, new Date().toISOString(), shift.id
        ];

    await this.db.runAsync(query, params);
  }

  async deleteUsualShift(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM usual_shifts WHERE id = ? AND user_id = ?`
      : `DELETE FROM usual_shifts WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  // OvertimeLogs CRUD
  async createOvertimeLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO overtime_logs (
        id, date, rostered_start, rostered_finish, actual_start, actual_finish,
        meal_break_minutes, minutes_overtime, category, comments,
        initials, status, export_batch_id, source, is_active_shift, concurrent_employment,
        smo_categories, user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.id, log.date, log.rosteredStart || null, log.rosteredFinish || null,
      log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
      log.category, log.comments || null,
      log.initials, log.status, log.exportBatchId || null, log.source,
      log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
      log.smoCategories ? JSON.stringify(log.smoCategories) : null,
      userId || null,
      log.createdAt, log.updatedAt
    ]);
  }

  async getOvertimeLogs(userId?: string | null): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM overtime_logs WHERE user_id = ? ORDER BY date DESC, created_at DESC`
      : `SELECT * FROM overtime_logs WHERE user_id IS NULL ORDER BY date DESC, created_at DESC`;
    const params = userId ? [userId] : [];

    const result = await this.db.getAllAsync(query, params);

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

  async getOvertimeLogsByStatus(status: 'draft' | 'ready' | 'exported', userId?: string | null): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM overtime_logs WHERE status = ? AND user_id = ? ORDER BY date DESC, created_at DESC`
      : `SELECT * FROM overtime_logs WHERE status = ? AND user_id IS NULL ORDER BY date DESC, created_at DESC`;
    const params = userId ? [status, userId] : [status];

    const result = await this.db.getAllAsync(query, params);

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

  async updateOvertimeLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE overtime_logs SET
          date = ?, rostered_start = ?, rostered_finish = ?, actual_start = ?,
          actual_finish = ?, meal_break_minutes = ?, minutes_overtime = ?, category = ?,
          comments = ?, initials = ?, status = ?,
          export_batch_id = ?, source = ?, is_active_shift = ?, concurrent_employment = ?,
          smo_categories = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE overtime_logs SET
          date = ?, rostered_start = ?, rostered_finish = ?, actual_start = ?,
          actual_finish = ?, meal_break_minutes = ?, minutes_overtime = ?, category = ?,
          comments = ?, initials = ?, status = ?,
          export_batch_id = ?, source = ?, is_active_shift = ?, concurrent_employment = ?,
          smo_categories = ?, updated_at = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [
          log.date, log.rosteredStart || null, log.rosteredFinish || null,
          log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
          log.category, log.comments || null,
          log.initials, log.status, log.exportBatchId || null, log.source,
          log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
          log.smoCategories ? JSON.stringify(log.smoCategories) : null,
          new Date().toISOString(), log.id, userId
        ]
      : [
          log.date, log.rosteredStart || null, log.rosteredFinish || null,
          log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
          log.category, log.comments || null,
          log.initials, log.status, log.exportBatchId || null, log.source,
          log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
          log.smoCategories ? JSON.stringify(log.smoCategories) : null,
          new Date().toISOString(), log.id
        ];

    await this.db.runAsync(query, params);
  }

  async deleteOvertimeLog(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM overtime_logs WHERE id = ? AND user_id = ?`
      : `DELETE FROM overtime_logs WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  // ExportBatches CRUD
  async createExportBatch(batch: ExportBatch, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      INSERT INTO export_batches (
        id, created_at, pdf_uri, count_logs, total_minutes, submitted_to_email, custom_name, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batch.id, batch.createdAt, batch.pdfUri, batch.countLogs,
      batch.totalMinutes, batch.submittedToEmail || null, batch.customName || null, userId || null
    ]);
  }

  async getExportBatches(userId?: string | null): Promise<ExportBatch[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM export_batches WHERE user_id = ? ORDER BY created_at DESC`
      : `SELECT * FROM export_batches WHERE user_id IS NULL ORDER BY created_at DESC`;
    const params = userId ? [userId] : [];

    const result = await this.db.getAllAsync(query, params);

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

  async updateExportBatch(batch: ExportBatch, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE export_batches SET
          pdf_uri = ?, submitted_to_email = ?, custom_name = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE export_batches SET
          pdf_uri = ?, submitted_to_email = ?, custom_name = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [batch.pdfUri, batch.submittedToEmail || null, batch.customName || null, batch.id, userId]
      : [batch.pdfUri, batch.submittedToEmail || null, batch.customName || null, batch.id];

    await this.db.runAsync(query, params);
  }

  async deleteExportBatch(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM export_batches WHERE id = ? AND user_id = ?`
      : `DELETE FROM export_batches WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  // LogTemplates CRUD
  async createLogTemplate(template: LogTemplate): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      console.log('Creating template:', { id: template.id, name: template.name, category: template.category });
      await this.db.runAsync(`
        INSERT INTO log_templates (
          id, name, rostered_start, rostered_finish,
          meal_break_minutes, category, comments, concurrent_employment,
          smo_categories, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        template.id, template.name,
        template.rosteredStart || null, template.rosteredFinish || null,
        template.mealBreakMinutes || 0, template.category, template.comments || null,
        template.concurrentEmployment ? 1 : 0,
        template.smoCategories ? JSON.stringify(template.smoCategories) : null,
        template.createdAt, template.updatedAt
      ]);
      console.log('✅ Template created successfully:', template.id);
    } catch (error) {
      console.error('❌ Failed to create template:', error);
      console.error('Template data:', {
        id: template.id,
        name: template.name,
        rosteredStart: template.rosteredStart,
        rosteredFinish: template.rosteredFinish,
        category: template.category,
        mealBreakMinutes: template.mealBreakMinutes,
      });
      throw error;
    }
  }

  async getLogTemplates(): Promise<LogTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Explicitly list columns to avoid issues with old schema that might have actual_start/actual_finish
      const result = await this.db.getAllAsync(`
        SELECT 
          id, name, rostered_start, rostered_finish,
          meal_break_minutes, category, comments, concurrent_employment,
          smo_categories, created_at, updated_at
        FROM log_templates 
        ORDER BY name, created_at DESC
      `);

      console.log('Fetched templates from database:', result.length);
      
      return result.map((row: any) => ({
        id: row.id as string,
        name: row.name as string,
        rosteredStart: row.rostered_start as string | undefined,
        rosteredFinish: row.rostered_finish as string | undefined,
        mealBreakMinutes: row.meal_break_minutes as number,
        category: row.category as 'Overtime' | 'Oncall' | 'HP Emergency Clinical on Call' | 'HPDO Priority on Call' | 'Recall Offsite' | 'Recall Onsite' | 'Recall Offsite Normal Duties (QPSOOE award)' | 'Recall Telephone Advice (Medical)' | 'Change shift' | 'Change shift - cancel leave',
        comments: row.comments as string | undefined,
        concurrentEmployment: row.concurrent_employment === 1,
        smoCategories: row.smo_categories ? JSON.parse(row.smo_categories) : undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string
      }));
    } catch (error) {
      console.error('Error fetching templates:', error);
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('no such table')) {
        console.log('log_templates table does not exist yet, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async updateLogTemplate(template: LogTemplate): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      UPDATE log_templates SET
        name = ?, rostered_start = ?,
        rostered_finish = ?, meal_break_minutes = ?, category = ?,
        comments = ?, concurrent_employment = ?, smo_categories = ?, updated_at = ?
      WHERE id = ?
    `, [
      template.name,
      template.rosteredStart || null, template.rosteredFinish || null,
      template.mealBreakMinutes || 0, template.category, template.comments || null,
      template.concurrentEmployment ? 1 : 0,
      template.smoCategories ? JSON.stringify(template.smoCategories) : null,
      new Date().toISOString(), template.id
    ]);
  }

  async deleteLogTemplate(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(`
      DELETE FROM log_templates WHERE id = ?
    `, [id]);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  // Clear old data without user_id (legacy data from before auth)
  async clearLegacyData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('Clearing legacy data (without user_id)...');
    await this.db.execAsync('DELETE FROM overtime_logs WHERE user_id IS NULL');
    await this.db.execAsync('DELETE FROM usual_shifts WHERE user_id IS NULL');
    await this.db.execAsync('DELETE FROM export_batches WHERE user_id IS NULL');
    console.log('✅ Legacy data cleared');
  }

  // Clear all data methods for testing
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.execAsync('DELETE FROM overtime_logs');
    await this.db.execAsync('DELETE FROM usual_shifts');
    await this.db.execAsync('DELETE FROM export_batches');
    await this.db.execAsync('DELETE FROM log_templates');
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

  // Auth sessions storage methods for Supabase auth
  async getAuthSession(key: string): Promise<{ value: string; encrypted: number } | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.getFirstAsync<{ value: string; encrypted: number }>(
      'SELECT value, encrypted FROM auth_sessions WHERE key = ?',
      [key]
    );
    
    return row || null;
  }

  async setAuthSession(key: string, value: string, encrypted: number = 0): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO auth_sessions (key, value, encrypted, updated_at) 
       VALUES (?, ?, ?, ?)`,
      [key, value, encrypted, new Date().toISOString()]
    );
  }

  async removeAuthSession(key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync('DELETE FROM auth_sessions WHERE key = ?', [key]);
  }
}

// Singleton instance
export const database = new Database();
