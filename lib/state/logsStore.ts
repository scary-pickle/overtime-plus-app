import { create } from 'zustand';
import { OvertimeLog, ExportBatch, MinutesCalculation } from '../../types';
import { database } from '../db/sqlite';
import { computeMinutes, roundToNearest5, getPreviousISODate, getCurrentDate } from '../time';
import { useAuthStore } from './authStore';
import { logsSync, exportSync } from '../supabase';
import { uploadPDFToStorage, isLocalPath } from '../storage/pdfStorage';
import { syncQueue } from '../sync/queue';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('logsStore');

/**
 * Validates that a log has all required fields to be marked as ready
 * Returns an object with isValid flag and array of missing field messages
 */
export function validateLogForReady(log: OvertimeLog): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  // Check actual start and finish times (must be present and not 'N/A')
  if (!log.actualStart || log.actualStart === 'N/A') {
    missingFields.push('Actual start time');
  }
  if (!log.actualFinish || log.actualFinish === 'N/A') {
    missingFields.push('Actual finish time');
  }

  // Check rostered times - both must be present OR both must be 'N/A'
  const hasRosteredStart = log.rosteredStart && log.rosteredStart !== 'N/A';
  const hasRosteredFinish = log.rosteredFinish && log.rosteredFinish !== 'N/A';
  const rosteredTimesNA = log.rosteredStart === 'N/A' && log.rosteredFinish === 'N/A';
  const bothRosteredPresent = hasRosteredStart && hasRosteredFinish;
  
  // Rostered times are valid if both are present OR both are 'N/A'
  if (!bothRosteredPresent && !rosteredTimesNA) {
    // Mixed state - one is N/A and one is not, or both are empty
    if (log.rosteredStart === 'N/A' || log.rosteredFinish === 'N/A') {
      missingFields.push('Rostered times must both be filled or both marked as N/A');
    } else {
      missingFields.push('Rostered start and finish times (or mark both as N/A)');
    }
  }

  // Check category
  if (!log.category) {
    missingFields.push('Category');
  }

  // Check minutesOvertime (must be > 0)
  if (!log.minutesOvertime || log.minutesOvertime <= 0) {
    missingFields.push('Overtime calculation (must be greater than 0)');
  }

  // Check initials
  if (!log.initials || log.initials.trim().length === 0) {
    missingFields.push('Employee initials');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

interface LogsState {
  logs: OvertimeLog[];
  exportBatches: ExportBatch[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadLogs: (userId?: string | null) => Promise<void>;
  loadExportBatches: (userId?: string | null) => Promise<void>;
  addLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
  updateLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
  deleteLog: (id: string, userId?: string | null) => Promise<void>;
  markReady: (id: string, userId?: string | null) => Promise<void>;
  batchExport: (logIds: string[], pdfUri?: string, userId?: string | null) => Promise<ExportBatch>;
  updateExportBatch: (batch: ExportBatch, userId?: string | null) => Promise<void>;
  deleteExportBatch: (id: string, userId?: string | null) => Promise<void>;
  markBatchAsSubmitted: (batchId: string, method: 'email' | 'manual') => Promise<void>;
  resetLogsToReady: (logIds: string[]) => Promise<void>;
  clearError: () => void;
  
  // Helper methods
  getLogsByStatus: (status: 'draft' | 'ready' | 'exported') => OvertimeLog[];
  getDraftLogs: () => OvertimeLog[];
  getReadyLogs: () => OvertimeLog[];
  getExportedLogs: () => OvertimeLog[];
  computeMinutesForLog: (log: OvertimeLog) => MinutesCalculation;
  getTotalMinutes: (logs: OvertimeLog[]) => number;
  
  // Active shift management
  getActiveShiftDraft: () => OvertimeLog | null;
  clearActiveShift: (id: string) => Promise<void>;
  markDraftAsStale: (id: string) => Promise<void>;
  
  // Duplicate prevention
  hasLoggedShiftForDate: (date: string) => boolean;
  getLoggedShiftForDate: (date: string) => OvertimeLog | null;
  
  // Helper methods for template/yesterday features
  getYesterdayLog: () => OvertimeLog | null;
  getMostRecentLogBeforeDate: (date: string) => OvertimeLog | null;
}

export const useLogsStore = create<LogsState>((set, get) => ({
  logs: [],
  exportBatches: [],
  isLoading: false,
  error: null,

  loadLogs: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const logs = await database.getOvertimeLogs(userId);
      set({ 
        logs, 
        isLoading: false,
        error: null 
      });
      
      // Sync from Supabase in background (non-blocking)
      if (userId) {
        logsSync.downloadLogs(userId).then(remoteLogs => {
          if (remoteLogs.length > 0 || logs.length > 0) {
            debug.debug('Syncing logs from Supabase in background', {
              remoteCount: remoteLogs.length,
              localCount: logs.length,
            });
            
            // Merge with timestamp-based conflict resolution
            const localLogMap = new Map(logs.map(log => [log.id, log]));
            const remoteLogMap = new Map(remoteLogs.map(log => [log.id, log]));
            
            const mergedLogs: OvertimeLog[] = [];
            const allLogIds = new Set([...localLogMap.keys(), ...remoteLogMap.keys()]);
            
            // Process all logs with timestamp comparison
            for (const logId of allLogIds) {
              const localLog = localLogMap.get(logId);
              const remoteLog = remoteLogMap.get(logId);
              
              if (localLog && remoteLog) {
                // Both exist - compare timestamps (newer wins)
                const localTime = new Date(localLog.updatedAt || localLog.createdAt);
                const remoteTime = new Date(remoteLog.updatedAt || remoteLog.createdAt);
                
                if (localTime > remoteTime) {
                  // Local is newer - use local and upload it
                  mergedLogs.push(localLog);
                  logsSync.uploadLog(localLog, userId).catch(err => {
                    debug.error('Failed to upload newer local log:', err);
                    // Add to sync queue for retry
                    const { syncQueue } = require('../sync/queue');
                    syncQueue.add({
                      type: 'log',
                      operation: 'update',
                      data: localLog,
                      userId,
                    }).catch(() => {});
                  });
                } else {
                  // Remote is newer - use remote and save it locally
                  mergedLogs.push(remoteLog);
                  database.updateOvertimeLog(remoteLog, userId).catch(err => {
                    debug.error('Failed to save merged log:', err);
                  });
                }
              } else if (localLog) {
                // Only local - add it and upload if not already synced
                mergedLogs.push(localLog);
                logsSync.uploadLog(localLog, userId).catch(err => {
                  debug.error('Failed to upload local-only log:', err);
                  // Add to sync queue for retry
                  const { syncQueue } = require('../sync/queue');
                  syncQueue.add({
                    type: 'log',
                    operation: 'create',
                    data: localLog,
                    userId,
                  }).catch(() => {});
                });
              } else if (remoteLog) {
                // Only remote - add it and save locally
                mergedLogs.push(remoteLog);
                database.createOvertimeLog(remoteLog, userId).catch(err => {
                  debug.error('Failed to save remote-only log:', err);
                });
              }
            }
            
            // Update store with merged logs
            set({ logs: mergedLogs });
          }
        }).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load logs' 
      });
    }
  },

  loadExportBatches: async (userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const exportBatches = await database.getExportBatches(userId);
      set({ 
        exportBatches, 
        isLoading: false,
        error: null 
      });
      
      // Sync from Supabase in background (non-blocking)
      if (userId) {
        exportSync.downloadExportBatches(userId).then(remoteBatches => {
          if (remoteBatches.length > 0) {
            debug.debug('Syncing export batches from Supabase in background');
            // Get current batches from store (may have been updated since initial load)
            const currentBatches = get().exportBatches;
            const localBatchMap = new Map(currentBatches.map(batch => [batch.id, batch]));
            const remoteBatchMap = new Map(remoteBatches.map(batch => [batch.id, batch]));
            
            // Merge: remote batches take precedence, then add local-only batches
            // Use a Map to ensure no duplicates by ID
            const mergedMap = new Map<string, ExportBatch>();
            
            // First add all remote batches (remote wins for conflicts)
            for (const batch of remoteBatches) {
              mergedMap.set(batch.id, batch);
            }
            
            // Then add local batches that aren't in remote
            for (const batch of currentBatches) {
              if (!mergedMap.has(batch.id)) {
                mergedMap.set(batch.id, batch);
              }
            }
            
            // Convert Map to array and sort by createdAt (newest first)
            const mergedBatches = Array.from(mergedMap.values()).sort((a, b) => {
              const aTime = new Date(a.createdAt).getTime();
              const bTime = new Date(b.createdAt).getTime();
              return bTime - aTime; // Descending order
            });
            
            // Update store with merged batches (deduplicated)
            set({ exportBatches: mergedBatches });
          }
        }).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load export batches' 
      });
    }
  },

  // Audit current export batches and report how many have cloud vs local PDF URIs
  auditExportBatchPDFs: () => {
    const { exportBatches } = get();
    const { classifyPdfUri } = require('../storage/pdfStorage');
    const summary = exportBatches.reduce(
      (acc: { total: number; cloud: number; local: number; unknown: number; localIds: string[] }, batch) => {
        acc.total += 1;
        const kind = classifyPdfUri(batch.pdfUri);
        if (kind === 'cloud') acc.cloud += 1;
        else if (kind === 'local') {
          acc.local += 1;
          acc.localIds.push(batch.id);
        } else acc.unknown += 1;
        return acc;
      },
      { total: 0, cloud: 0, local: 0, unknown: 0, localIds: [] as string[] }
    );
    debug.debug('Audit summary:', summary);
    return summary;
  },

  // Upload any export batches whose pdfUri is currently a local path
  uploadMissingBatchPDFs: async (userId?: string | null) => {
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    if (!finalUserId) {
      debug.debug('No userId; skipping');
      return { uploaded: 0, skipped: 0, errors: 0 };
    }

    const { exportBatches } = get();
    const { isLocalPath } = require('../storage/pdfStorage');
    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    debug.debug('Scanning export batches for local PDFs...', {
      count: exportBatches.length,
    });

    for (const batch of exportBatches) {
      if (batch.pdfUri && isLocalPath(batch.pdfUri)) {
        try {
          debug.debug('Uploading local PDF for batch...', {
            batchId: batch.id,
          });
          const updated = await exportSync.uploadExportBatch(batch, finalUserId);
          if (updated && updated.pdfUri && updated.pdfUri !== batch.pdfUri) {
            // Update store and DB with cloud URL
            const current = get().exportBatches;
            const newBatches = current.map(b => (b.id === batch.id ? { ...b, pdfUri: updated.pdfUri } : b));
            set({ exportBatches: newBatches });
            await database.updateExportBatch({ ...batch, pdfUri: updated.pdfUri }, finalUserId).catch(() => {});
          }
          uploaded += 1;
        } catch (e) {
          debug.error('Failed to upload PDF for batch:', batch.id, e);
          errors += 1;
          // Queue retry
          syncQueue.add({
            type: 'pdfUpload',
            operation: 'update',
            data: { pdfUri: batch.pdfUri, batchId: batch.id },
            userId: finalUserId,
          }).catch(() => {});
        }
      } else {
        skipped += 1;
      }
    }

    const result = { uploaded, skipped, errors };
    debug.debug('Completed upload scan:', result);
    return result;
  },

  addLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Save to local SQLite first
      await database.createOvertimeLog(log, finalUserId);
      const { logs } = get();
      set({ 
        logs: [log, ...logs], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        logsSync.uploadLog(log, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'log',
            operation: 'create',
            data: log,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add log' 
      });
    }
  },

  updateLog: async (log: OvertimeLog, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Update local SQLite first
      await database.updateOvertimeLog(log, finalUserId);
      const { logs } = get();
      const updatedLogs = logs.map(l => l.id === log.id ? log : l);
      set({ 
        logs: updatedLogs, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        logsSync.uploadLog(log, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'log',
            operation: 'update',
            data: log,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update log' 
      });
    }
  },

  deleteLog: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Delete from local SQLite first
      await database.deleteOvertimeLog(id, finalUserId);
      const { logs } = get();
      const filteredLogs = logs.filter(l => l.id !== id);
      set({ 
        logs: filteredLogs, 
        isLoading: false,
        error: null 
      });
      
      // Sync delete to Supabase in background (non-blocking)
      if (finalUserId) {
        logsSync.deleteLog(id, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'log',
            operation: 'delete',
            data: { id },
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete log' 
      });
    }
  },

  markReady: async (id: string, userId?: string | null) => {
    const { logs, updateLog } = get();
    const log = logs.find(l => l.id === id);
    if (!log) {
      throw new Error('Log not found');
    }

    // Validate that the log has all required fields before marking as ready
    const validation = validateLogForReady(log);
    if (!validation.isValid) {
      const errorMessage = `Cannot mark log as ready. Missing required fields:\n• ${validation.missingFields.join('\n• ')}`;
      throw new Error(errorMessage);
    }

    const updatedLog: OvertimeLog = {
      ...log,
      status: 'ready',
      updatedAt: new Date().toISOString()
    };

    // Get userId from authStore if not provided
    // updateLog already handles Supabase sync
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    await updateLog(updatedLog, finalUserId);
  },

  batchExport: async (logIds: string[], pdfUri?: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const logsToExport = logs.filter(log => logIds.includes(log.id) && log.status === 'ready');
      
      if (logsToExport.length === 0) {
        throw new Error('No ready logs to export');
      }

      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;

      // Generate batch ID first so we can use it for the upload
      const batchId = `batch_${Date.now()}`;

      // If we received a local PDF path, proactively upload to storage now with the actual batch ID
      let effectivePdfUri = pdfUri || '';
      if (finalUserId && pdfUri && isLocalPath(pdfUri)) {
        try {
          debug.debug('Uploading newly generated local PDF to storage before saving batch...');
          const cloudUrl = await uploadPDFToStorage(pdfUri, batchId, finalUserId);
          if (cloudUrl) {
            effectivePdfUri = cloudUrl;
            debug.debug('New PDF uploaded to storage:', true);
          }
        } catch (err) {
          debug.error('Immediate upload failed, will fall back to background sync:', err);
          // Leave effectivePdfUri as local path; background sync will handle upload later
        }
      }

      // Create export batch with the effective PDF URI (cloud URL if uploaded, else local path)
      const batch: ExportBatch = {
        id: batchId,
        createdAt: new Date().toISOString(),
        pdfUri: effectivePdfUri,
        countLogs: logsToExport.length,
        totalMinutes: logsToExport.reduce((sum, log) => sum + log.minutesOvertime, 0),
        submittedToEmail: undefined
      };

      
      // Save to local SQLite first
      await database.createExportBatch(batch, finalUserId);
      
      // Update logs to exported status in both database and store
      const updatedLogs = logs.map(log => 
        logIds.includes(log.id) 
          ? { ...log, status: 'exported' as const, exportBatchId: batch.id, updatedAt: new Date().toISOString() }
          : log
      );

      // Persist each updated log to the database
      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log, finalUserId);
          
          // Sync updated log to Supabase in background
          if (finalUserId) {
            logsSync.uploadLog(log, finalUserId).catch(err => {
              debug.error('Background sync failed (non-fatal):', err);
            });
          }
        }
      }

      // Update exportBatches in store to include the new batch
      const { exportBatches } = get();
      set({ 
        logs: updatedLogs,
        exportBatches: [batch, ...exportBatches], // Add new batch to the beginning of the array
        isLoading: false,
        error: null 
      });
      
      // Sync export batch to Supabase in background (non-blocking)
      // Only upload if PDF is still local (if immediate upload succeeded, it's already a cloud URL)
      if (finalUserId && batch.pdfUri) {
        // Only call uploadExportBatch if PDF is still local - if it's already a cloud URL, just save metadata
        if (isLocalPath(batch.pdfUri)) {
          // PDF is still local, uploadExportBatch will handle the upload
          exportSync.uploadExportBatch(batch, finalUserId)
            .then((updatedBatch) => {
              // If upload succeeded and PDF was uploaded to cloud, update local batch with cloud URL
              if (updatedBatch && updatedBatch.pdfUri && updatedBatch.pdfUri !== batch.pdfUri) {
                // Update local database with cloud URL
                const { exportBatches: currentBatches } = get();
                const updatedBatches = currentBatches.map(b => 
                  b.id === batch.id ? { ...b, pdfUri: updatedBatch.pdfUri } : b
                );
                set({ exportBatches: updatedBatches });
                
                // Update database
                database.updateExportBatch({ ...batch, pdfUri: updatedBatch.pdfUri }, finalUserId).catch(() => {});
              }
            })
            .catch(err => {
              debug.error('Background sync failed (non-fatal):', err);
              // Add PDF upload to sync queue for retry
              syncQueue.add({
                type: 'pdfUpload',
                operation: 'update',
                data: { pdfUri: batch.pdfUri, batchId: batch.id },
                userId: finalUserId,
              }).catch(() => {});
            });
        } else {
          // PDF is already in cloud storage, just upload batch metadata (no PDF upload needed)
          exportSync.uploadExportBatch(batch, finalUserId).catch(err => {
            debug.error('Background metadata sync failed (non-fatal):', err);
          });
        }
      }

      return batch;
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to export batch' 
      });
      throw error;
    }
  },

  updateExportBatch: async (batch: ExportBatch, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Update local SQLite first
      await database.updateExportBatch(batch, finalUserId);
      const { exportBatches } = get();
      const updatedBatches = exportBatches.map(b => b.id === batch.id ? batch : b);
      set({ 
        exportBatches: updatedBatches,
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        exportSync.uploadExportBatch(batch, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update export batch' 
      });
    }
  },

  deleteExportBatch: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Delete from local SQLite first
      await database.deleteExportBatch(id, finalUserId);
      const { exportBatches } = get();
      const filteredBatches = exportBatches.filter(b => b.id !== id);
      set({ 
        exportBatches: filteredBatches,
        isLoading: false,
        error: null 
      });
      
      // Sync delete to Supabase in background (non-blocking)
      if (finalUserId) {
        exportSync.deleteExportBatch(id, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete export batch' 
      });
    }
  },

  markBatchAsSubmitted: async (batchId: string, method: 'email' | 'manual') => {
    set({ isLoading: true, error: null });
    try {
      const { exportBatches } = get();
      const batch = exportBatches.find(b => b.id === batchId);
      if (!batch) {
        throw new Error('Export batch not found');
      }

      const updatedBatch: ExportBatch = {
        ...batch,
        submittedAt: new Date().toISOString(),
        submittedVia: method
      };

      // Get userId for sync
      const finalUserId = useAuthStore.getState().user?.id ?? null;
      
      // Update local SQLite first
      await database.updateExportBatch(updatedBatch, finalUserId);
      const updatedBatches = exportBatches.map(b => b.id === batchId ? updatedBatch : b);
      set({ 
        exportBatches: updatedBatches,
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        exportSync.uploadExportBatch(updatedBatch, finalUserId).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to mark batch as submitted' 
      });
    }
  },

  resetLogsToReady: async (logIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const { logs } = get();
      const finalUserId = useAuthStore.getState().user?.id ?? null;
      const updatedLogs = logs.map(log => 
        logIds.includes(log.id) 
          ? { ...log, status: 'ready' as const, exportBatchId: undefined, updatedAt: new Date().toISOString() }
          : log
      );

      // Persist each updated log to the database and sync to Supabase
      for (const log of updatedLogs) {
        if (logIds.includes(log.id)) {
          await database.updateOvertimeLog(log, finalUserId);
          
          // Sync to Supabase in background
          if (finalUserId) {
            logsSync.uploadLog(log, finalUserId).catch(err => {
              debug.error('Background sync failed (non-fatal):', err);
            });
          }
        }
      }

      set({ 
        logs: updatedLogs,
        isLoading: false,
        error: null 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to reset logs to ready' 
      });
    }
  },

  clearError: () => set({ error: null }),

  // Helper methods
  getLogsByStatus: (status: 'draft' | 'ready' | 'exported') => {
    const { logs } = get();
    return logs.filter(log => log.status === status);
  },

  getDraftLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('draft');
  },

  getReadyLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('ready');
  },

  getExportedLogs: () => {
    const { getLogsByStatus } = get();
    return getLogsByStatus('exported');
  },

  computeMinutesForLog: (log: OvertimeLog) => {
    return computeMinutes(
      log.actualStart,
      log.actualFinish,
      log.rosteredStart,
      log.rosteredFinish,
      log.mealBreakMinutes || 0
    );
  },

  getTotalMinutes: (logs: OvertimeLog[]) => {
    return logs.reduce((sum, log) => sum + log.minutesOvertime, 0);
  },

  // Active shift management
  getActiveShiftDraft: () => {
    const { logs } = get();
    return logs.find(log => log.status === 'draft' && log.isActiveShift === true) || null;
  },

  clearActiveShift: async (id: string) => {
    const { logs, updateLog } = get();
    const log = logs.find(l => l.id === id);
    if (!log) return;

    const updatedLog: OvertimeLog = {
      ...log,
      isActiveShift: false,
      updatedAt: new Date().toISOString()
    };

    await updateLog(updatedLog);
  },

  markDraftAsStale: async (id: string) => {
    // Mark as stale by clearing the active shift flag
    await get().clearActiveShift(id);
  },
  
  // Duplicate prevention
  hasLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.some(log => 
      log.date === date && 
      (log.status === 'ready' || log.status === 'exported')
    );
  },
  
  getLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.find(log => 
      log.date === date && 
      (log.status === 'ready' || log.status === 'exported')
    ) || null;
  },
  
  // Helper methods for template/yesterday features
  getYesterdayLog: () => {
    const { logs } = get();
    const yesterday = getPreviousISODate(getCurrentDate());
    // Find the most recent log from yesterday (could be draft, ready, or exported)
    // Sort by createdAt descending to get the most recent one
    const yesterdayLogs = logs
      .filter(log => log.date === yesterday)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return yesterdayLogs[0] || null;
  },
  
  getMostRecentLogBeforeDate: (date: string) => {
    const { logs } = get();
    // Find logs with date before the given date, sorted by date descending, then by createdAt descending
    const logsBeforeDate = logs
      .filter(log => log.date < date)
      .sort((a, b) => {
        // First sort by date descending
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        // Then sort by createdAt descending
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    
    return logsBeforeDate[0] || null;
  }
}));
