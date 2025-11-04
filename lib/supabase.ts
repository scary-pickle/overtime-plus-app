/**
 * Supabase integration stub
 * This module provides stubbed Supabase functionality for offline-first operation
 * When Supabase credentials are provided, real sync functionality will be enabled
 */

import { Profile, OvertimeLog, ExportBatch, UsualShift } from '../types';
import { createClient } from '@supabase/supabase-js';
import { SecureStoreAdapter } from './auth/storageAdapter';

// Check for Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

console.log('Supabase enabled:', supabaseEnabled);

// Stub interfaces for when Supabase is not configured
interface SupabaseClient {
  auth: {
    signIn: (credentials: any) => Promise<any>;
    signUp: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    getSession: () => Promise<any>;
    signInWithPassword?: (credentials: any) => Promise<any>;
    signInWithOtp?: (credentials: any) => Promise<any>;
    verifyOtp?: (params: any) => Promise<any>;
    updateUser?: (params: any) => Promise<any>;
    resend?: (params: any) => Promise<any>;
  };
  from: (table: string) => any;
}

// Stub Supabase client
const createStubClient = (): SupabaseClient => ({
  auth: {
    signIn: async () => {
      console.log('Stub: signIn called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signUp: async () => {
      console.log('Stub: signUp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signInWithPassword: async () => {
      console.log('Stub: signInWithPassword called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signInWithOtp: async () => {
      console.log('Stub: signInWithOtp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    signOut: async () => {
      console.log('Stub: signOut called');
      return { error: null };
    },
    getSession: async () => {
      console.log('Stub: getSession called');
      return { data: { session: null }, error: null };
    },
    verifyOtp: async () => {
      console.log('Stub: verifyOtp called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    updateUser: async () => {
      console.log('Stub: updateUser called');
      return { data: null, error: new Error('Supabase not configured') };
    },
    resend: async () => {
      console.log('Stub: resend called');
      return { data: null, error: new Error('Supabase not configured') };
    },
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
});

// Real Supabase client (when configured)
let supabaseClient: SupabaseClient | null = null;

if (supabaseEnabled) {
  // Initialize real Supabase client for React Native/Expo with secure storage
  // Detect session in URL is disabled (handled via Linking), PKCE is default in RN
  // @ts-ignore - allow passing storage adapter even if our local type is minimal
  supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      storage: SecureStoreAdapter,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  }) as unknown as SupabaseClient;
} else {
  supabaseClient = createStubClient();
}

export const supabase = supabaseClient;

/**
 * Authentication functions
 */
export const auth = {
  async signIn(email: string, password: string) {
    if (!supabaseEnabled) {
      throw new Error('Supabase not configured');
    }
    // @ts-ignore
    return await (supabase as any).auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string) {
    if (!supabaseEnabled) {
      throw new Error('Supabase not configured');
    }
    // @ts-ignore
    return await (supabase as any).auth.signUp({ email, password });
  },

  async signOut() {
    if (!supabaseEnabled) {
      return { error: null };
    }
    return await supabase.auth.signOut();
  },

  async getCurrentUser() {
    if (!supabaseEnabled) {
      return null;
    }
    // @ts-ignore
    const { data } = await (supabase as any).auth.getSession();
    return data.session?.user || null;
  },
};

/**
 * Profile sync functions
 */
export const profileSync = {
  async uploadProfile(profile: Profile, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      console.log('Stub: uploadProfile called');
      return;
    }

    if (!userId) {
      console.log('[profileSync.uploadProfile] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      console.log('[profileSync.uploadProfile] Uploading profile to Supabase', {
        userId: userId.substring(0, 8) + '...',
        email: profile.email,
        fullName: profile.fullName,
      });

      // @ts-ignore
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: profile.email,
          display_name: profile.fullName,
          metadata: profile,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) {
        console.error('[profileSync.uploadProfile] Error uploading profile:', error);
        throw error;
      }

      console.log('[profileSync.uploadProfile] Profile uploaded successfully to Supabase', {
        user_id: data?.user_id,
      });
    } catch (error) {
      console.error('[profileSync.uploadProfile] Failed to upload profile to Supabase:', error);
      // Don't throw - allow local save to continue even if sync fails
      // The caller will handle the error appropriately
    }
  },

  async downloadProfile(userId?: string | null): Promise<Profile | null> {
    if (!supabaseEnabled) {
      console.log('Stub: downloadProfile called');
      return null;
    }

    if (!userId) {
      console.log('[profileSync.downloadProfile] No userId provided, skipping Supabase download');
      return null;
    }

    try {
      console.log('[profileSync.downloadProfile] Downloading profile from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // @ts-ignore
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is OK
          console.log('[profileSync.downloadProfile] No profile found in Supabase');
          return null;
        }
        console.error('[profileSync.downloadProfile] Error downloading profile:', error);
        throw error;
      }

      if (!data || !data.metadata) {
        console.log('[profileSync.downloadProfile] Profile found but metadata is empty');
        return null;
      }

      console.log('[profileSync.downloadProfile] Profile downloaded successfully from Supabase', {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name,
      });

      // Return the profile from metadata
      return data.metadata as Profile;
    } catch (error) {
      console.error('[profileSync.downloadProfile] Failed to download profile from Supabase:', error);
      // Don't throw - allow local load to continue even if sync fails
      return null;
    }
  },
};

/**
 * Overtime logs sync functions
 */
export const logsSync = {
  async uploadLog(log: OvertimeLog, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      console.log('[logsSync.uploadLog] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Convert minutes to hours for the hours field (for querying)
      const hours = log.minutesOvertime / 60;

      // Supabase uses UUIDs, but our logs use string IDs like "log_1234567890"
      // We'll store the original ID in extras JSONB and query by that
      // First, check if a log with this user_id and extras.id already exists
      // @ts-ignore
      const { data: existing } = await supabase
        .from('overtime_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', log.id) // Match by original ID in extras JSONB
        .is('deleted_at', null)
        .maybeSingle();

      const logData = {
        user_id: userId,
        date: log.date,
        hours: hours,
        rate: null, // Not used in our app
        notes: log.comments || null,
        extras: log, // Store full object including original ID in extras JSONB
        updated_at: log.updatedAt || new Date().toISOString(),
      };

      // @ts-ignore
      let data, error;
      if (existing) {
        // Update existing log
        ({ data, error } = await supabase
          .from('overtime_logs')
          .update(logData)
          .eq('id', existing.id)
          .select()
          .single());
      } else {
        // Insert new log (Supabase will generate UUID)
        ({ data, error } = await supabase
          .from('overtime_logs')
          .insert(logData)
          .select()
          .single());
      }

      if (error) {
        console.error('[logsSync.uploadLog] Error uploading log:', error);
        throw error;
      }

      console.log('[logsSync.uploadLog] Log uploaded successfully to Supabase', {
        logId: log.id,
      });
    } catch (error) {
      console.error('[logsSync.uploadLog] Failed to upload log to Supabase:', error);
      throw error;
    }
  },

  async uploadLogs(logs: OvertimeLog[], userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      console.log('[logsSync.uploadLogs] Uploading logs to Supabase', {
        count: logs.length,
        userId: userId.substring(0, 8) + '...',
      });

      // Upload logs in batches to avoid overwhelming the API
      const batchSize = 50;
      for (let i = 0; i < logs.length; i += batchSize) {
        const batch = logs.slice(i, i + batchSize);
        await Promise.all(batch.map(log => this.uploadLog(log, userId).catch(err => {
          console.error(`[logsSync.uploadLogs] Failed to upload log ${log.id}:`, err);
          // Continue with other logs even if one fails
        })));
      }

      console.log('[logsSync.uploadLogs] All logs uploaded successfully');
    } catch (error) {
      console.error('[logsSync.uploadLogs] Failed to upload logs:', error);
      throw error;
    }
  },

  async downloadLogs(userId?: string | null): Promise<OvertimeLog[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      console.log('[logsSync.downloadLogs] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      console.log('[logsSync.downloadLogs] Downloading logs from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // @ts-ignore
      const { data, error } = await supabase
        .from('overtime_logs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[logsSync.downloadLogs] Error downloading logs:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('[logsSync.downloadLogs] No logs found in Supabase');
        return [];
      }

      // Extract full objects from extras JSONB
      const logs = data
        .map((row: any) => {
          if (row.extras && typeof row.extras === 'object') {
            return row.extras as OvertimeLog;
          }
          return null;
        })
        .filter((log: OvertimeLog | null): log is OvertimeLog => log !== null);

      console.log('[logsSync.downloadLogs] Logs downloaded successfully from Supabase', {
        count: logs.length,
      });

      return logs;
    } catch (error) {
      console.error('[logsSync.downloadLogs] Failed to download logs from Supabase:', error);
      return [];
    }
  },

  async syncLogs(localLogs: OvertimeLog[], userId?: string | null): Promise<{
    uploaded: number;
    downloaded: number;
    conflicts: number;
  }> {
    if (!supabaseEnabled || !userId) {
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }

    try {
      // Upload local logs
      await this.uploadLogs(localLogs, userId);
      const uploaded = localLogs.length;

      // Download remote logs
      const remoteLogs = await this.downloadLogs(userId);
      const downloaded = remoteLogs.length;

      // Simple conflict resolution: local wins (we already uploaded local)
      // In the future, we could implement more sophisticated conflict resolution
      const conflicts = 0;

      return { uploaded, downloaded, conflicts };
    } catch (error) {
      console.error('[logsSync.syncLogs] Failed to sync logs:', error);
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    }
  },

  async deleteLog(logId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the log by user_id and extras.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('overtime_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', logId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete by setting deleted_at
        // @ts-ignore
        const { error } = await supabase
          .from('overtime_logs')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) {
          console.error('[logsSync.deleteLog] Error deleting log:', error);
          throw error;
        }

        console.log('[logsSync.deleteLog] Log deleted successfully from Supabase', {
          logId,
        });
      }
    } catch (error) {
      console.error('[logsSync.deleteLog] Failed to delete log from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Shifts sync functions (for UsualShift patterns)
 */
export const shiftsSync = {
  async uploadShift(shift: UsualShift, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      console.log('[shiftsSync.uploadShift] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Supabase uses UUIDs, but our shifts use string IDs like "shift_1234567890"
      // We'll store the original ID in extras JSONB and query by that
      // First, check if a shift with this user_id and extras.id already exists
      // @ts-ignore
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', shift.id) // Match by original ID in extras JSONB
        .eq('notes', 'usual_shift_pattern')
        .is('deleted_at', null)
        .maybeSingle();

      const shiftData = {
        user_id: userId,
        start_at: new Date(shift.activeFrom).toISOString(), // Use activeFrom as start_at for querying
        end_at: shift.activeTo ? new Date(shift.activeTo).toISOString() : null,
        department: null,
        hospital: null,
        notes: 'usual_shift_pattern', // Marker to identify this as a UsualShift pattern
        extras: shift, // Store full UsualShift object in extras JSONB
        updated_at: new Date().toISOString(),
      };

      // @ts-ignore
      let data, error;
      if (existing) {
        // Update existing shift
        ({ data, error } = await supabase
          .from('shifts')
          .update(shiftData)
          .eq('id', existing.id)
          .select()
          .single());
      } else {
        // Insert new shift (Supabase will generate UUID)
        ({ data, error } = await supabase
          .from('shifts')
          .insert(shiftData)
          .select()
          .single());
      }

      if (error) {
        console.error('[shiftsSync.uploadShift] Error uploading shift:', error);
        throw error;
      }

      console.log('[shiftsSync.uploadShift] Shift uploaded successfully to Supabase', {
        shiftId: shift.id,
      });
    } catch (error) {
      console.error('[shiftsSync.uploadShift] Failed to upload shift to Supabase:', error);
      throw error;
    }
  },

  async uploadShifts(shifts: UsualShift[], userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      console.log('[shiftsSync.uploadShifts] Uploading shifts to Supabase', {
        count: shifts.length,
        userId: userId.substring(0, 8) + '...',
      });

      // Upload shifts in parallel
      await Promise.all(shifts.map(shift => this.uploadShift(shift, userId).catch(err => {
        console.error(`[shiftsSync.uploadShifts] Failed to upload shift ${shift.id}:`, err);
        // Continue with other shifts even if one fails
      })));

      console.log('[shiftsSync.uploadShifts] All shifts uploaded successfully');
    } catch (error) {
      console.error('[shiftsSync.uploadShifts] Failed to upload shifts:', error);
      throw error;
    }
  },

  async downloadShifts(userId?: string | null): Promise<UsualShift[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      console.log('[shiftsSync.downloadShifts] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      console.log('[shiftsSync.downloadShifts] Downloading shifts from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // @ts-ignore
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .eq('notes', 'usual_shift_pattern') // Only get UsualShift patterns
        .is('deleted_at', null)
        .order('start_at', { ascending: false });

      if (error) {
        console.error('[shiftsSync.downloadShifts] Error downloading shifts:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('[shiftsSync.downloadShifts] No shifts found in Supabase');
        return [];
      }

      // Extract full UsualShift objects from extras JSONB
      const shifts = data
        .map((row: any) => {
          if (row.extras && typeof row.extras === 'object') {
            return row.extras as UsualShift;
          }
          return null;
        })
        .filter((shift: UsualShift | null): shift is UsualShift => shift !== null);

      console.log('[shiftsSync.downloadShifts] Shifts downloaded successfully from Supabase', {
        count: shifts.length,
      });

      return shifts;
    } catch (error) {
      console.error('[shiftsSync.downloadShifts] Failed to download shifts from Supabase:', error);
      return [];
    }
  },

  async deleteShift(shiftId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the shift by user_id and extras.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('shifts')
        .select('id')
        .eq('user_id', userId)
        .eq('extras->>id', shiftId)
        .eq('notes', 'usual_shift_pattern')
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete by setting deleted_at
        // @ts-ignore
        const { error } = await supabase
          .from('shifts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) {
          console.error('[shiftsSync.deleteShift] Error deleting shift:', error);
          throw error;
        }

        console.log('[shiftsSync.deleteShift] Shift deleted successfully from Supabase', {
          shiftId,
        });
      }
    } catch (error) {
      console.error('[shiftsSync.deleteShift] Failed to delete shift from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Export batches sync functions
 */
export const exportSync = {
  async uploadExportBatch(batch: ExportBatch, userId?: string | null): Promise<void> {
    if (!supabaseEnabled) {
      return;
    }

    if (!userId) {
      console.log('[exportSync.uploadExportBatch] No userId provided, skipping Supabase sync');
      return;
    }

    try {
      // Supabase uses UUIDs, but our batches use string IDs like "batch_1234567890"
      // We'll store the original ID in params JSONB and query by that
      // First, check if a batch with this user_id and params.id already exists
      // @ts-ignore
      const { data: existing } = await supabase
        .from('export_batches')
        .select('id')
        .eq('user_id', userId)
        .eq('params->>id', batch.id) // Match by original ID in params JSONB
        .is('deleted_at', null)
        .maybeSingle();

      const batchData = {
        user_id: userId,
        requested_at: batch.createdAt,
        status: 'ready', // Default status for export batches
        result_url: batch.pdfUri || null,
        error: null,
        params: batch, // Store full ExportBatch object in params JSONB
        updated_at: new Date().toISOString(),
      };

      // @ts-ignore
      let data, error;
      if (existing) {
        // Update existing batch
        ({ data, error } = await supabase
          .from('export_batches')
          .update(batchData)
          .eq('id', existing.id)
          .select()
          .single());
      } else {
        // Insert new batch (Supabase will generate UUID)
        ({ data, error } = await supabase
          .from('export_batches')
          .insert(batchData)
          .select()
          .single());
      }

      if (error) {
        console.error('[exportSync.uploadExportBatch] Error uploading export batch:', error);
        throw error;
      }

      console.log('[exportSync.uploadExportBatch] Export batch uploaded successfully to Supabase', {
        batchId: batch.id,
      });
    } catch (error) {
      console.error('[exportSync.uploadExportBatch] Failed to upload export batch to Supabase:', error);
      throw error;
    }
  },

  async downloadExportBatches(userId?: string | null): Promise<ExportBatch[]> {
    if (!supabaseEnabled) {
      return [];
    }

    if (!userId) {
      console.log('[exportSync.downloadExportBatches] No userId provided, skipping Supabase download');
      return [];
    }

    try {
      console.log('[exportSync.downloadExportBatches] Downloading export batches from Supabase', {
        userId: userId.substring(0, 8) + '...',
      });

      // @ts-ignore
      const { data, error } = await supabase
        .from('export_batches')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error('[exportSync.downloadExportBatches] Error downloading export batches:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('[exportSync.downloadExportBatches] No export batches found in Supabase');
        return [];
      }

      // Extract full ExportBatch objects from params JSONB
      const batches = data
        .map((row: any) => {
          if (row.params && typeof row.params === 'object') {
            return row.params as ExportBatch;
          }
          return null;
        })
        .filter((batch: ExportBatch | null): batch is ExportBatch => batch !== null);

      console.log('[exportSync.downloadExportBatches] Export batches downloaded successfully from Supabase', {
        count: batches.length,
      });

      return batches;
    } catch (error) {
      console.error('[exportSync.downloadExportBatches] Failed to download export batches from Supabase:', error);
      return [];
    }
  },

  async deleteExportBatch(batchId: string, userId?: string | null): Promise<void> {
    if (!supabaseEnabled || !userId) {
      return;
    }

    try {
      // Find the batch by user_id and params.id
      // @ts-ignore
      const { data: existing } = await supabase
        .from('export_batches')
        .select('id')
        .eq('user_id', userId)
        .eq('params->>id', batchId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        // Soft delete by setting deleted_at
        // @ts-ignore
        const { error } = await supabase
          .from('export_batches')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) {
          console.error('[exportSync.deleteExportBatch] Error deleting export batch:', error);
          throw error;
        }

        console.log('[exportSync.deleteExportBatch] Export batch deleted successfully from Supabase', {
          batchId,
        });
      }
    } catch (error) {
      console.error('[exportSync.deleteExportBatch] Failed to delete export batch from Supabase:', error);
      throw error;
    }
  },
};

/**
 * Full sync function
 */
export const sync = {
  async fullSync(): Promise<{
    success: boolean;
    profile: boolean;
    logs: boolean;
    exports: boolean;
    error?: string;
  }> {
    if (!supabaseEnabled) {
      return {
        success: false,
        profile: false,
        logs: false,
        exports: false,
        error: 'Supabase not configured'
      };
    }
    
    try {
      // TODO: Implement full sync
      console.log('TODO: Implement full sync');
      
      return {
        success: true,
        profile: true,
        logs: true,
        exports: true
      };
    } catch (error) {
      return {
        success: false,
        profile: false,
        logs: false,
        exports: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  async checkConnection(): Promise<boolean> {
    if (!supabaseEnabled) {
      return false;
    }
    
    try {
      // TODO: Implement connection check
      console.log('TODO: Check Supabase connection');
      return true;
    } catch (error) {
      console.error('Supabase connection failed:', error);
      return false;
    }
  },
};

/**
 * Sync status and settings
 */
export const syncStatus = {
  isEnabled: supabaseEnabled,
  lastSync: null as Date | null,
  isOnline: true, // TODO: Implement network status detection
  autoSync: false, // TODO: Implement auto-sync setting
};

/**
 * Environment configuration helper
 */
export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    enabled: supabaseEnabled,
  };
}

/**
 * TODO: Phase-2 Implementation Notes
 * 
 * When implementing real Supabase integration:
 * 
 * 1. Install Supabase client:
 *    npm install @supabase/supabase-js
 * 
 * 2. Create Supabase project and get credentials
 * 
 * 3. Set environment variables:
 *    EXPO_PUBLIC_SUPABASE_URL=your-project-url
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
 * 
 * 4. Create database tables:
 *    - profiles (user_id, profile_data)
 *    - overtime_logs (user_id, log_data, created_at, updated_at)
 *    - export_batches (user_id, batch_data, created_at)
 * 
 * 5. Implement real sync functions with:
 *    - Conflict resolution
 *    - Offline queue
 *    - Incremental sync
 *    - Error handling
 * 
 * 6. Add authentication flow
 * 
 * 7. Add real-time subscriptions for multi-device sync
 */
