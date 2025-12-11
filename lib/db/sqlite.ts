import * as SQLite from 'expo-sqlite';
import { UsualShift, OvertimeLog, ExportBatch, LogTemplate, ShiftTemplate } from '../../types';
import { createScopedLogger } from '../utils/logger';

const DB_NAME = 'overtime_plus.db';
const DB_VERSION = 1;
const debug = createScopedLogger('Database');

class Database {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      debug.debug('Database initialized successfully');
    } catch (error) {
      debug.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // ---------------- OTA templates cache helpers ----------------
  async getTemplateVersion(templateType: 'avac_normal' | 'avac_smo'): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync<{ version: string }>(
      `SELECT version FROM template_versions WHERE template_type = ? LIMIT 1`,
      [templateType]
    );
    return rows?.[0]?.version || null;
  }

  async setTemplateVersion(templateType: 'avac_normal' | 'avac_smo', version: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `
      INSERT INTO template_versions (template_type, version, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(template_type) DO UPDATE SET
        version=excluded.version,
        updated_at=excluded.updated_at
      `,
      [templateType, version]
    );
  }

  async getTemplateCache(templateType: 'avac_normal' | 'avac_smo'): Promise<{
    pdfPath: string | null;
    mappingJson: string | null;
    version: string | null;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    const rows = await this.db.getAllAsync<{ pdf_path: string | null; mapping_json: string | null; version: string | null }>(
      `SELECT pdf_path, mapping_json, version FROM template_cache WHERE template_type = ? LIMIT 1`,
      [templateType]
    );
    const row = rows?.[0];
    return {
      pdfPath: row?.pdf_path || null,
      mappingJson: row?.mapping_json || null,
      version: row?.version || null,
    };
  }

  async setTemplateCache(params: {
    templateType: 'avac_normal' | 'avac_smo';
    pdfPath?: string | null;
    mappingJson?: string | null;
    version?: string | null;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const { templateType, pdfPath = null, mappingJson = null, version = null } = params;
    await this.db.runAsync(
      `
      INSERT INTO template_cache (template_type, pdf_path, mapping_json, version, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(template_type) DO UPDATE SET
        pdf_path=COALESCE(excluded.pdf_path, pdf_path),
        mapping_json=COALESCE(excluded.mapping_json, mapping_json),
        version=COALESCE(excluded.version, version),
        updated_at=excluded.updated_at
      `,
      [templateType, pdfPath, mappingJson, version]
    );
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
        user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
    `);

    // Create shift_templates table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS shift_templates (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        rostered_start TEXT NOT NULL,
        rostered_finish TEXT NOT NULL,
        meal_break_minutes INTEGER DEFAULT 0,
        user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
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

    // Cache tables for OTA PDF templates and mappings
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS template_versions (
        template_type TEXT PRIMARY KEY, -- 'avac_normal' | 'avac_smo'
        version TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS template_cache (
        template_type TEXT PRIMARY KEY, -- 'avac_normal' | 'avac_smo'
        pdf_path TEXT,                  -- cached local file path
        mapping_json TEXT,              -- JSON string for coordinates
        version TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes for better performance (excluding user_id indexes - they'll be created after migrations)
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_date ON overtime_logs(date);
      CREATE INDEX IF NOT EXISTS idx_overtime_logs_status ON overtime_logs(status);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_active ON usual_shifts(active_from, active_to);
      CREATE INDEX IF NOT EXISTS idx_usual_shifts_type ON usual_shifts(type, day_of_week);
      CREATE INDEX IF NOT EXISTS idx_log_templates_name ON log_templates(name);
      CREATE INDEX IF NOT EXISTS idx_shift_templates_label ON shift_templates(label);
    `);

    // Run migrations (adds user_id and deleted_at columns)
    await this.runMigrations();

    // Create user_id indexes after migrations (columns must exist first)
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_log_templates_user_id ON log_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_shift_templates_user_id ON shift_templates(user_id);
    `);
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
      debug.debug('✅ Added user_id column to usual_shifts');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN user_id TEXT;
      `);
      debug.debug('✅ Added user_id column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN user_id TEXT;
      `);
      debug.debug('✅ Added user_id column to export_batches');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE log_templates ADD COLUMN user_id TEXT;
      `);
      debug.debug('✅ Added user_id column to log_templates');
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
      debug.debug('Added is_active_shift column');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add concurrent_employment column to overtime_logs
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN concurrent_employment INTEGER DEFAULT 0;
      `);
      debug.debug('Added concurrent_employment column');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add smo_categories column to overtime_logs (stored as JSON string)
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN smo_categories TEXT;
      `);
      debug.debug('Added smo_categories column');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add submitted_at column to export_batches
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN submitted_at TEXT;
      `);
      debug.debug('✅ Added submitted_at column to export_batches');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      // Migration: Add submitted_via column to export_batches
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN submitted_via TEXT;
      `);
      debug.debug('✅ Added submitted_via column to export_batches');
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
        debug.debug('Migrating log_templates table to remove actual_start/actual_finish...');
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
        
        debug.debug('Migrated log_templates table successfully');
      }
    } catch (error) {
      debug.error('Migration error (may be fine if table doesn\'t exist yet):', error);
      // Migration error is okay - table might not exist yet or might already be migrated
    }

    // Migration: Add deleted_at column for soft deletes
    try {
      await this.db.execAsync(`
        ALTER TABLE usual_shifts ADD COLUMN deleted_at TEXT;
      `);
      debug.debug('Added deleted_at column to usual_shifts');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN deleted_at TEXT;
      `);
      debug.debug('Added deleted_at column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE export_batches ADD COLUMN deleted_at TEXT;
      `);
      debug.debug('Added deleted_at column to export_batches');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE log_templates ADD COLUMN deleted_at TEXT;
      `);
      debug.debug('Added deleted_at column to log_templates');
    } catch (error) {
      // Column already exists, which is fine
    }

    // Migration: Add shift swap columns to overtime_logs
    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN shift_swap_id TEXT;
      `);
      debug.debug('Added shift_swap_id column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN linked_log_id TEXT;
      `);
      debug.debug('Added linked_log_id column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN is_shift_swap INTEGER DEFAULT 0;
      `);
      debug.debug('Added is_shift_swap column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    // Migration: Add shift swap partner detail columns
    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN swap_partner_name TEXT;
      `);
      debug.debug('Added swap_partner_name column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN swap_partner_payroll_number TEXT;
      `);
      debug.debug('Added swap_partner_payroll_number column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN swap_partner_pay_level TEXT;
      `);
      debug.debug('Added swap_partner_pay_level column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    // Migration: Add leave columns to overtime_logs
    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN leave_group_id TEXT;
      `);
      debug.debug('Added leave_group_id column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }

    try {
      await this.db.execAsync(`
        ALTER TABLE overtime_logs ADD COLUMN is_leave INTEGER DEFAULT 0;
      `);
      debug.debug('Added is_leave column to overtime_logs');
    } catch (error) {
      // Column already exists, which is fine
    }
  }

  // UsualShifts CRUD
  async createUsualShift(shift: UsualShift, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use INSERT OR REPLACE to handle conflicts (e.g., when syncing a shift that was soft-deleted locally)
    await this.db.runAsync(`
      INSERT OR REPLACE INTO usual_shifts (
        id, label, type, week_index, day_of_week, rostered_start, rostered_finish,
        meal_break_minutes, active_from, active_to, user_id, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shift.id, shift.label, shift.type, shift.weekIndex || null, shift.dayOfWeek,
      shift.rosteredStart, shift.rosteredFinish, shift.mealBreakMinutes || 0,
      shift.activeFrom, shift.activeTo || null, userId || null,
      new Date().toISOString(), new Date().toISOString(), shift.deletedAt || null
    ]);
  }

  async getUsualShifts(userId?: string | null): Promise<UsualShift[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM usual_shifts WHERE user_id = ? AND deleted_at IS NULL ORDER BY label, day_of_week`
      : `SELECT * FROM usual_shifts WHERE user_id IS NULL AND deleted_at IS NULL ORDER BY label, day_of_week`;
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
      activeTo: row.active_to as string | undefined,
      deletedAt: row.deleted_at as string | undefined
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

    // Soft delete - set deleted_at timestamp
    const query = userId
      ? `UPDATE usual_shifts SET deleted_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE usual_shifts SET deleted_at = ? WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [new Date().toISOString(), id, userId] : [new Date().toISOString(), id];

    await this.db.runAsync(query, params);
  }

  // OvertimeLogs CRUD
  async createOvertimeLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use INSERT OR REPLACE to handle conflicts (e.g., when syncing a log that was soft-deleted locally)
    await this.db.runAsync(`
      INSERT OR REPLACE INTO overtime_logs (
        id, date, rostered_start, rostered_finish, actual_start, actual_finish,
        meal_break_minutes, minutes_overtime, category, comments,
        initials, status, export_batch_id, source, is_active_shift, concurrent_employment,
        smo_categories, user_id, shift_swap_id, linked_log_id, is_shift_swap,
        swap_partner_name, swap_partner_payroll_number, swap_partner_pay_level,
        leave_group_id, is_leave,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.id, log.date, log.rosteredStart || null, log.rosteredFinish || null,
      log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
      log.category, log.comments || null,
      log.initials, log.status, log.exportBatchId || null, log.source,
      log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
      log.smoCategories ? JSON.stringify(log.smoCategories) : null,
      userId || null,
      log.shiftSwapId || null, log.linkedLogId || null, log.isShiftSwap ? 1 : 0,
      log.swapPartnerName || null, log.swapPartnerPayrollNumber || null, log.swapPartnerPayLevel || null,
      log.leaveGroupId || null, log.isLeave ? 1 : 0,
      log.createdAt, log.updatedAt, log.deletedAt || null
    ]);
  }

  async getOvertimeLogs(userId?: string | null): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM overtime_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`
      : `SELECT * FROM overtime_logs WHERE user_id IS NULL AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`;
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
      shiftSwapId: row.shift_swap_id as string | undefined,
      linkedLogId: row.linked_log_id as string | undefined,
      isShiftSwap: row.is_shift_swap === 1,
      swapPartnerName: row.swap_partner_name as string | undefined,
      swapPartnerPayrollNumber: row.swap_partner_payroll_number as string | undefined,
      swapPartnerPayLevel: row.swap_partner_pay_level as string | undefined,
      leaveGroupId: row.leave_group_id as string | undefined,
      isLeave: row.is_leave === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      deletedAt: row.deleted_at as string | undefined
    }));
  }

  async getOvertimeLogsByStatus(status: 'draft' | 'ready' | 'exported', userId?: string | null): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM overtime_logs WHERE status = ? AND user_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`
      : `SELECT * FROM overtime_logs WHERE status = ? AND user_id IS NULL AND deleted_at IS NULL ORDER BY date DESC, created_at DESC`;
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
      shiftSwapId: row.shift_swap_id as string | undefined,
      linkedLogId: row.linked_log_id as string | undefined,
      isShiftSwap: row.is_shift_swap === 1,
      swapPartnerName: row.swap_partner_name as string | undefined,
      swapPartnerPayrollNumber: row.swap_partner_payroll_number as string | undefined,
      swapPartnerPayLevel: row.swap_partner_pay_level as string | undefined,
      leaveGroupId: row.leave_group_id as string | undefined,
      isLeave: row.is_leave === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      deletedAt: row.deleted_at as string | undefined
    }));
  }

  async updateOvertimeLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Preserve the updatedAt timestamp if provided (for syncing), otherwise create new one (for user edits)
    const updatedAt = log.updatedAt || new Date().toISOString();

    const query = userId
      ? `UPDATE overtime_logs SET
          date = ?, rostered_start = ?, rostered_finish = ?, actual_start = ?,
          actual_finish = ?, meal_break_minutes = ?, minutes_overtime = ?, category = ?,
          comments = ?, initials = ?, status = ?,
          export_batch_id = ?, source = ?, is_active_shift = ?, concurrent_employment = ?,
          smo_categories = ?, shift_swap_id = ?, linked_log_id = ?, is_shift_swap = ?,
          swap_partner_name = ?, swap_partner_payroll_number = ?, swap_partner_pay_level = ?,
          leave_group_id = ?, is_leave = ?,
          updated_at = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE overtime_logs SET
          date = ?, rostered_start = ?, rostered_finish = ?, actual_start = ?,
          actual_finish = ?, meal_break_minutes = ?, minutes_overtime = ?, category = ?,
          comments = ?, initials = ?, status = ?,
          export_batch_id = ?, source = ?, is_active_shift = ?, concurrent_employment = ?,
          smo_categories = ?, shift_swap_id = ?, linked_log_id = ?, is_shift_swap = ?,
          swap_partner_name = ?, swap_partner_payroll_number = ?, swap_partner_pay_level = ?,
          leave_group_id = ?, is_leave = ?,
          updated_at = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [
          log.date, log.rosteredStart || null, log.rosteredFinish || null,
          log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
          log.category, log.comments || null,
          log.initials, log.status, log.exportBatchId || null, log.source,
          log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
          log.smoCategories ? JSON.stringify(log.smoCategories) : null,
          log.shiftSwapId || null, log.linkedLogId || null, log.isShiftSwap ? 1 : 0,
          log.swapPartnerName || null, log.swapPartnerPayrollNumber || null, log.swapPartnerPayLevel || null,
          log.leaveGroupId || null, log.isLeave ? 1 : 0,
          updatedAt, log.id, userId
        ]
      : [
          log.date, log.rosteredStart || null, log.rosteredFinish || null,
          log.actualStart, log.actualFinish, log.mealBreakMinutes || 0, log.minutesOvertime,
          log.category, log.comments || null,
          log.initials, log.status, log.exportBatchId || null, log.source,
          log.isActiveShift ? 1 : 0, log.concurrentEmployment ? 1 : 0,
          log.smoCategories ? JSON.stringify(log.smoCategories) : null,
          log.shiftSwapId || null, log.linkedLogId || null, log.isShiftSwap ? 1 : 0,
          log.swapPartnerName || null, log.swapPartnerPayrollNumber || null, log.swapPartnerPayLevel || null,
          log.leaveGroupId || null, log.isLeave ? 1 : 0,
          updatedAt, log.id
        ];

    await this.db.runAsync(query, params);
  }

  async deleteOvertimeLog(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Soft delete - set deleted_at timestamp
    const query = userId
      ? `UPDATE overtime_logs SET deleted_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE overtime_logs SET deleted_at = ? WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [new Date().toISOString(), id, userId] : [new Date().toISOString(), id];

    await this.db.runAsync(query, params);
  }

  // ExportBatches CRUD
  async createExportBatch(batch: ExportBatch, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use INSERT OR REPLACE to handle conflicts (e.g., when syncing a batch that was soft-deleted locally)
    await this.db.runAsync(`
      INSERT OR REPLACE INTO export_batches (
        id, created_at, pdf_uri, count_logs, total_minutes, submitted_to_email, custom_name, submitted_at, submitted_via, user_id, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batch.id, batch.createdAt, batch.pdfUri, batch.countLogs,
      batch.totalMinutes, batch.submittedToEmail || null, batch.customName || null, 
      batch.submittedAt || null, batch.submittedVia || null, userId || null, batch.deletedAt || null
    ]);
  }

  async getExportBatches(userId?: string | null): Promise<ExportBatch[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM export_batches WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
      : `SELECT * FROM export_batches WHERE user_id IS NULL AND deleted_at IS NULL ORDER BY created_at DESC`;
    const params = userId ? [userId] : [];

    const result = await this.db.getAllAsync(query, params);

    return result.map((row: any) => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      pdfUri: row.pdf_uri as string,
      countLogs: row.count_logs as number,
      totalMinutes: row.total_minutes as number,
      submittedToEmail: row.submitted_to_email as string | undefined,
      customName: row.custom_name as string | undefined,
      submittedAt: row.submitted_at as string | undefined,
      submittedVia: row.submitted_via as 'email' | 'manual' | undefined,
      deletedAt: row.deleted_at as string | undefined
    }));
  }

  async updateExportBatch(batch: ExportBatch, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE export_batches SET
          pdf_uri = ?, submitted_to_email = ?, custom_name = ?, submitted_at = ?, submitted_via = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE export_batches SET
          pdf_uri = ?, submitted_to_email = ?, custom_name = ?, submitted_at = ?, submitted_via = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [batch.pdfUri, batch.submittedToEmail || null, batch.customName || null, batch.submittedAt || null, batch.submittedVia || null, batch.id, userId]
      : [batch.pdfUri, batch.submittedToEmail || null, batch.customName || null, batch.submittedAt || null, batch.submittedVia || null, batch.id];

    await this.db.runAsync(query, params);
  }

  async deleteExportBatch(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Soft delete - set deleted_at timestamp
    const query = userId
      ? `UPDATE export_batches SET deleted_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE export_batches SET deleted_at = ? WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [new Date().toISOString(), id, userId] : [new Date().toISOString(), id];

    await this.db.runAsync(query, params);
  }

  // LogTemplates CRUD
  async createLogTemplate(template: LogTemplate, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      debug.debug('Creating template:', { id: template.id, name: template.name, category: template.category, userId: userId ? `${userId.substring(0, 8)}...` : 'null' });
      await this.db.runAsync(`
        INSERT INTO log_templates (
          id, name, rostered_start, rostered_finish,
          meal_break_minutes, category, comments, concurrent_employment,
          smo_categories, user_id, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        template.id, template.name,
        template.rosteredStart || null, template.rosteredFinish || null,
        template.mealBreakMinutes || 0, template.category, template.comments || null,
        template.concurrentEmployment ? 1 : 0,
        template.smoCategories ? JSON.stringify(template.smoCategories) : null,
        userId || null,
        template.createdAt, template.updatedAt, template.deletedAt || null
      ]);
      debug.debug('Template created successfully:', template.id);
    } catch (error) {
      debug.error('Failed to create template:', error);
      debug.error('Template data:', {
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

  async getLogTemplates(userId?: string | null): Promise<LogTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = userId
        ? `SELECT * FROM log_templates WHERE user_id = ? AND deleted_at IS NULL ORDER BY name, created_at DESC`
        : `SELECT * FROM log_templates WHERE user_id IS NULL AND deleted_at IS NULL ORDER BY name, created_at DESC`;
      const params = userId ? [userId] : [];

      const result = await this.db.getAllAsync(query, params);

      debug.debug('Fetched templates from database:', result.length);
      
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
        updatedAt: row.updated_at as string,
        userId: row.user_id as string | null,
        deletedAt: row.deleted_at as string | undefined
      }));
    } catch (error) {
      debug.error('Error fetching templates:', error);
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('no such table')) {
        debug.debug('log_templates table does not exist yet, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async updateLogTemplate(template: LogTemplate, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE log_templates SET
          name = ?, rostered_start = ?,
          rostered_finish = ?, meal_break_minutes = ?, category = ?,
          comments = ?, concurrent_employment = ?, smo_categories = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE log_templates SET
          name = ?, rostered_start = ?,
          rostered_finish = ?, meal_break_minutes = ?, category = ?,
          comments = ?, concurrent_employment = ?, smo_categories = ?, updated_at = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [
          template.name,
          template.rosteredStart || null, template.rosteredFinish || null,
          template.mealBreakMinutes || 0, template.category, template.comments || null,
          template.concurrentEmployment ? 1 : 0,
          template.smoCategories ? JSON.stringify(template.smoCategories) : null,
          new Date().toISOString(), template.id, userId
        ]
      : [
          template.name,
          template.rosteredStart || null, template.rosteredFinish || null,
          template.mealBreakMinutes || 0, template.category, template.comments || null,
          template.concurrentEmployment ? 1 : 0,
          template.smoCategories ? JSON.stringify(template.smoCategories) : null,
          new Date().toISOString(), template.id
        ];

    await this.db.runAsync(query, params);
  }

  async deleteLogTemplate(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Soft delete - set deleted_at timestamp
    const query = userId
      ? `UPDATE log_templates SET deleted_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE log_templates SET deleted_at = ? WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [new Date().toISOString(), id, userId] : [new Date().toISOString(), id];

    await this.db.runAsync(query, params);
  }

  async isLogTemplateDeleted(id: string, userId?: string | null): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT deleted_at FROM log_templates WHERE id = ? AND user_id = ? LIMIT 1`
      : `SELECT deleted_at FROM log_templates WHERE id = ? AND user_id IS NULL LIMIT 1`;
    const params = userId ? [id, userId] : [id];

    const result = await this.db.getFirstAsync(query, params) as { deleted_at: string | null } | null;
    
    // If template doesn't exist or deleted_at is not null, consider it deleted
    return !result || result.deleted_at !== null;
  }

  // ShiftTemplates CRUD
  async createShiftTemplate(template: ShiftTemplate, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      debug.debug('Creating shift template:', { id: template.id, label: template.label, userId: userId ? `${userId.substring(0, 8)}...` : 'null' });
      await this.db.runAsync(`
        INSERT OR REPLACE INTO shift_templates (
          id, label, rostered_start, rostered_finish,
          meal_break_minutes, user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        template.id,
        template.label,
        template.rosteredStart,
        template.rosteredFinish,
        template.mealBreakMinutes || 0,
        userId || null,
        template.createdAt,
        template.updatedAt
      ]);
      debug.debug('Shift template created successfully:', template.id);
    } catch (error) {
      debug.error('Failed to create shift template:', error);
      throw error;
    }
  }

  async getShiftTemplates(userId?: string | null): Promise<ShiftTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = userId
        ? `SELECT * FROM shift_templates WHERE user_id = ? AND deleted_at IS NULL ORDER BY label, created_at DESC`
        : `SELECT * FROM shift_templates WHERE user_id IS NULL AND deleted_at IS NULL ORDER BY label, created_at DESC`;
      const params = userId ? [userId] : [];

      const result = await this.db.getAllAsync(query, params);

      debug.debug('Fetched shift templates from database:', result.length);

      return result.map((row: any) => ({
        id: row.id as string,
        label: row.label as string,
        rosteredStart: row.rostered_start as string,
        rosteredFinish: row.rostered_finish as string,
        mealBreakMinutes: row.meal_break_minutes as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        userId: row.user_id as string | null,
        deletedAt: row.deleted_at as string | undefined
      }));
    } catch (error) {
      debug.error('Error fetching shift templates:', error);
      // If table doesn't exist yet, return empty array
      if (error instanceof Error && error.message.includes('no such table')) {
        debug.debug('shift_templates table does not exist yet, returning empty array');
        return [];
      }
      throw error;
    }
  }

  async updateShiftTemplate(template: ShiftTemplate, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE shift_templates SET
          label = ?, rostered_start = ?, rostered_finish = ?,
          meal_break_minutes = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`
      : `UPDATE shift_templates SET
          label = ?, rostered_start = ?, rostered_finish = ?,
          meal_break_minutes = ?, updated_at = ?
        WHERE id = ? AND user_id IS NULL`;
    const params = userId
      ? [template.label, template.rosteredStart, template.rosteredFinish, template.mealBreakMinutes || 0, new Date().toISOString(), template.id, userId]
      : [template.label, template.rosteredStart, template.rosteredFinish, template.mealBreakMinutes || 0, new Date().toISOString(), template.id];

    await this.db.runAsync(query, params);
  }

  async deleteShiftTemplate(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Soft delete
    const query = userId
      ? `UPDATE shift_templates SET deleted_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE shift_templates SET deleted_at = ? WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [new Date().toISOString(), id, userId] : [new Date().toISOString(), id];

    await this.db.runAsync(query, params);
  }

  async isShiftTemplateDeleted(id: string, userId?: string | null): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT deleted_at FROM shift_templates WHERE id = ? AND user_id = ? LIMIT 1`
      : `SELECT deleted_at FROM shift_templates WHERE id = ? AND user_id IS NULL LIMIT 1`;
    const params = userId ? [id, userId] : [id];

    const result = await this.db.getFirstAsync(query, params) as { deleted_at: string | null } | null;
    
    // If template doesn't exist or deleted_at is not null, consider it deleted
    return !result || result.deleted_at !== null;
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
    
    debug.debug('Clearing legacy data (without user_id)...');
    await this.db.execAsync('DELETE FROM overtime_logs WHERE user_id IS NULL');
    await this.db.execAsync('DELETE FROM usual_shifts WHERE user_id IS NULL');
    await this.db.execAsync('DELETE FROM export_batches WHERE user_id IS NULL');
    debug.debug('✅ Legacy data cleared');
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
    
    // Log to track unexpected null returns for session keys (only in dev, with masking)
    if (key.includes('auth-token-session-data')) {
      if (row) {
        debug.debug('getAuthSession FOUND:', {
          key: key.substring(0, 50) + '...', // Only partial key
          valueLength: row.value.length,
          encrypted: row.encrypted
        });
      } else {
        debug.debug('getAuthSession NOT FOUND:', key.substring(0, 50) + '...');
      }
    }
    
    return row || null;
  }

  async getAllAuthSessionKeys(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.getAllAsync<{ key: string }>(
      'SELECT key FROM auth_sessions'
    );
    
    return rows.map(row => row.key);
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
    
    // Log all removals to track what's deleting sessions (only in dev, with masking)
    debug.debug('Removing auth session:', key.substring(0, 50) + '...');
    
    await this.db.runAsync('DELETE FROM auth_sessions WHERE key = ?', [key]);
  }

  // Clear all cached Supabase auth sessions (used for account deletion)
  async clearAuthSessions(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    debug.debug('🧹 CLEARING ALL AUTH SESSIONS');
    await this.db.execAsync('DELETE FROM auth_sessions');
  }
  
  async countAuthSessions(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM auth_sessions'
    );
    
    return result?.count || 0;
  }

  // Soft delete methods - get deleted items
  async getDeletedLogs(userId?: string | null): Promise<OvertimeLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM overtime_logs WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`
      : `SELECT * FROM overtime_logs WHERE user_id IS NULL AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
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
      updatedAt: row.updated_at as string,
      deletedAt: row.deleted_at as string
    }));
  }

  async getDeletedShifts(userId?: string | null): Promise<UsualShift[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM usual_shifts WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`
      : `SELECT * FROM usual_shifts WHERE user_id IS NULL AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
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
      activeTo: row.active_to as string | undefined,
      deletedAt: row.deleted_at as string
    }));
  }

  async getDeletedExportBatches(userId?: string | null): Promise<ExportBatch[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `SELECT * FROM export_batches WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`
      : `SELECT * FROM export_batches WHERE user_id IS NULL AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
    const params = userId ? [userId] : [];

    const result = await this.db.getAllAsync(query, params);

    return result.map((row: any) => ({
      id: row.id as string,
      createdAt: row.created_at as string,
      pdfUri: row.pdf_uri as string,
      countLogs: row.count_logs as number,
      totalMinutes: row.total_minutes as number,
      submittedToEmail: row.submitted_to_email as string | undefined,
      customName: row.custom_name as string | undefined,
      deletedAt: row.deleted_at as string
    }));
  }

  // Restore deleted items (clear deleted_at)
  async restoreLog(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE overtime_logs SET deleted_at = NULL WHERE id = ? AND user_id = ?`
      : `UPDATE overtime_logs SET deleted_at = NULL WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  async restoreShift(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE usual_shifts SET deleted_at = NULL WHERE id = ? AND user_id = ?`
      : `UPDATE usual_shifts SET deleted_at = NULL WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  async restoreExportBatch(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `UPDATE export_batches SET deleted_at = NULL WHERE id = ? AND user_id = ?`
      : `UPDATE export_batches SET deleted_at = NULL WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  // Permanently delete items (hard delete)
  async permanentlyDeleteLog(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM overtime_logs WHERE id = ? AND user_id = ?`
      : `DELETE FROM overtime_logs WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  async permanentlyDeleteShift(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM usual_shifts WHERE id = ? AND user_id = ?`
      : `DELETE FROM usual_shifts WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  async permanentlyDeleteExportBatch(id: string, userId?: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = userId
      ? `DELETE FROM export_batches WHERE id = ? AND user_id = ?`
      : `DELETE FROM export_batches WHERE id = ? AND user_id IS NULL`;
    const params = userId ? [id, userId] : [id];

    await this.db.runAsync(query, params);
  }

  // Cleanup deleted items older than 30 days
  async cleanupOldDeletedItems(userId?: string | null): Promise<{ logsDeleted: number; shiftsDeleted: number; batchesDeleted: number }> {
    if (!this.db) throw new Error('Database not initialized');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    // Delete logs older than 30 days
    const logsQuery = userId
      ? `DELETE FROM overtime_logs WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?`
      : `DELETE FROM overtime_logs WHERE user_id IS NULL AND deleted_at IS NOT NULL AND deleted_at < ?`;
    const logsParams = userId ? [userId, cutoffDate] : [cutoffDate];
    const logsResult = await this.db.runAsync(logsQuery, logsParams);

    // Delete shifts older than 30 days
    const shiftsQuery = userId
      ? `DELETE FROM usual_shifts WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?`
      : `DELETE FROM usual_shifts WHERE user_id IS NULL AND deleted_at IS NOT NULL AND deleted_at < ?`;
    const shiftsParams = userId ? [userId, cutoffDate] : [cutoffDate];
    const shiftsResult = await this.db.runAsync(shiftsQuery, shiftsParams);

    // Delete export batches older than 30 days
    const batchesQuery = userId
      ? `DELETE FROM export_batches WHERE user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ?`
      : `DELETE FROM export_batches WHERE user_id IS NULL AND deleted_at IS NOT NULL AND deleted_at < ?`;
    const batchesParams = userId ? [userId, cutoffDate] : [cutoffDate];
    const batchesResult = await this.db.runAsync(batchesQuery, batchesParams);

    return {
      logsDeleted: logsResult.changes || 0,
      shiftsDeleted: shiftsResult.changes || 0,
      batchesDeleted: batchesResult.changes || 0
    };
  }

  // Delete all deleted items (regardless of age)
  async deleteAllDeletedItems(userId?: string | null): Promise<{ logsDeleted: number; shiftsDeleted: number; batchesDeleted: number }> {
    if (!this.db) throw new Error('Database not initialized');

    // Delete all logs with deleted_at
    const logsQuery = userId
      ? `DELETE FROM overtime_logs WHERE user_id = ? AND deleted_at IS NOT NULL`
      : `DELETE FROM overtime_logs WHERE user_id IS NULL AND deleted_at IS NOT NULL`;
    const logsParams = userId ? [userId] : [];
    const logsResult = await this.db.runAsync(logsQuery, logsParams);

    // Delete all shifts with deleted_at
    const shiftsQuery = userId
      ? `DELETE FROM usual_shifts WHERE user_id = ? AND deleted_at IS NOT NULL`
      : `DELETE FROM usual_shifts WHERE user_id IS NULL AND deleted_at IS NOT NULL`;
    const shiftsParams = userId ? [userId] : [];
    const shiftsResult = await this.db.runAsync(shiftsQuery, shiftsParams);

    // Delete all export batches with deleted_at
    const batchesQuery = userId
      ? `DELETE FROM export_batches WHERE user_id = ? AND deleted_at IS NOT NULL`
      : `DELETE FROM export_batches WHERE user_id IS NULL AND deleted_at IS NOT NULL`;
    const batchesParams = userId ? [userId] : [];
    const batchesResult = await this.db.runAsync(batchesQuery, batchesParams);

    return {
      logsDeleted: logsResult.changes || 0,
      shiftsDeleted: shiftsResult.changes || 0,
      batchesDeleted: batchesResult.changes || 0
    };
  }
}

// Singleton instance
export const database = new Database();
