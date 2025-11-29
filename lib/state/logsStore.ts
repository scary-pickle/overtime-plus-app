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
  addShiftSwapLogs: (data: {
    date: string;
    personAInitials: string;
    personARosteredStart: string | 'N/A';
    personARosteredFinish: string | 'N/A';
    personAActualStart: string;
    personAActualFinish: string;
    personBInitials: string;
    personBName: string;
    personBPayrollNumber: string;
    personBPayLevel?: string;
    personBRosteredStart: string | 'N/A';
    personBRosteredFinish: string | 'N/A';
    personBActualStart: string;
    personBActualFinish: string;
    mealBreakMinutes: number;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
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
      
      // If we have a userId, also sync from Supabase to ensure we have the latest data
      // This prevents showing stale "not submitted" status
      // Use Promise.race with a timeout to avoid hanging if Supabase is slow
      if (userId) {
        try {
          const syncPromise = exportSync.downloadExportBatches(userId);
          const timeoutPromise = new Promise<ExportBatch[]>((resolve) => {
            setTimeout(() => resolve([]), 2000); // 2 second timeout
          });
          const remoteBatches = await Promise.race([syncPromise, timeoutPromise]);
          if (remoteBatches.length > 0) {
            // Merge local and remote data intelligently
            const localBatchMap = new Map(exportBatches.map(batch => [batch.id, batch]));
            const remoteBatchMap = new Map(remoteBatches.map(batch => [batch.id, batch]));
            
            const mergedMap = new Map<string, ExportBatch>();
            const allBatchIds = new Set([...localBatchMap.keys(), ...remoteBatchMap.keys()]);
            
            for (const batchId of allBatchIds) {
              const localBatch = localBatchMap.get(batchId);
              const remoteBatch = remoteBatchMap.get(batchId);
              
              if (localBatch && remoteBatch) {
                // Both exist - merge intelligently
                // Prefer the one with submittedAt if only one has it
                if (localBatch.submittedAt && !remoteBatch.submittedAt) {
                  mergedMap.set(batchId, localBatch);
                } else if (remoteBatch.submittedAt && !localBatch.submittedAt) {
                  mergedMap.set(batchId, remoteBatch);
                } else if (localBatch.submittedAt && remoteBatch.submittedAt) {
                  // Both have submittedAt - prefer the one with newer submittedAt timestamp
                  const localSubmittedTime = new Date(localBatch.submittedAt).getTime();
                  const remoteSubmittedTime = new Date(remoteBatch.submittedAt).getTime();
                  if (localSubmittedTime > remoteSubmittedTime) {
                    mergedMap.set(batchId, localBatch);
                  } else {
                    mergedMap.set(batchId, remoteBatch);
                  }
                } else {
                  // Neither has submittedAt - prefer remote (it's the source of truth)
                  mergedMap.set(batchId, remoteBatch);
                }
              } else if (remoteBatch) {
                mergedMap.set(batchId, remoteBatch);
              } else if (localBatch) {
                mergedMap.set(batchId, localBatch);
              }
            }
            
            const mergedBatches = Array.from(mergedMap.values()).sort((a, b) => {
              const aTime = new Date(a.createdAt).getTime();
              const bTime = new Date(b.createdAt).getTime();
              return bTime - aTime;
            });
            
            // Update local database with merged data
            for (const batch of mergedBatches) {
              await database.createExportBatch(batch, userId).catch(() => {});
            }
            
            set({ 
              exportBatches: mergedBatches, 
              isLoading: false,
              error: null 
            });
            return;
          }
        } catch (syncError) {
          debug.error('Initial Supabase sync failed (non-fatal):', syncError);
          // Fall through to use local data
        }
      }
      
      // Use local data (either no userId, or Supabase sync failed/returned no data)
      set({ 
        exportBatches, 
        isLoading: false,
        error: null 
      });
      
      // Continue syncing in background for future updates
      if (userId) {
        exportSync.downloadExportBatches(userId).then(async (remoteBatches) => {
          if (remoteBatches.length > 0) {
            debug.debug('Syncing export batches from Supabase in background');
            // Get current batches from store (may have been updated since initial load)
            const currentBatches = get().exportBatches;
            const localBatchMap = new Map(currentBatches.map(batch => [batch.id, batch]));
            const remoteBatchMap = new Map(remoteBatches.map(batch => [batch.id, batch]));
            
            // Merge with smart conflict resolution for submittedAt
            // Use a Map to ensure no duplicates by ID
            const mergedMap = new Map<string, ExportBatch>();
            
            // Process all batches with smart merging
            const allBatchIds = new Set([...localBatchMap.keys(), ...remoteBatchMap.keys()]);
            
            for (const batchId of allBatchIds) {
              const localBatch = localBatchMap.get(batchId);
              const remoteBatch = remoteBatchMap.get(batchId);
              
              if (localBatch && remoteBatch) {
                // Both exist - merge intelligently
                // Prefer the one with submittedAt if only one has it
                if (localBatch.submittedAt && !remoteBatch.submittedAt) {
                  mergedMap.set(batchId, localBatch);
                } else if (remoteBatch.submittedAt && !localBatch.submittedAt) {
                  mergedMap.set(batchId, remoteBatch);
                } else if (localBatch.submittedAt && remoteBatch.submittedAt) {
                  // Both have submittedAt - prefer the one with newer submittedAt timestamp
                  const localSubmittedTime = new Date(localBatch.submittedAt).getTime();
                  const remoteSubmittedTime = new Date(remoteBatch.submittedAt).getTime();
                  if (localSubmittedTime > remoteSubmittedTime) {
                    mergedMap.set(batchId, localBatch);
                  } else {
                    mergedMap.set(batchId, remoteBatch);
                  }
                } else {
                  // Neither has submittedAt - prefer remote (it's the source of truth)
                  mergedMap.set(batchId, remoteBatch);
                }
              } else if (remoteBatch) {
                // Only remote exists
                mergedMap.set(batchId, remoteBatch);
              } else if (localBatch) {
                // Only local exists
                mergedMap.set(batchId, localBatch);
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
            
            // Also update local database with merged data to keep it in sync
            for (const batch of mergedBatches) {
              await database.createExportBatch(batch, userId).catch(() => {
                // Ignore errors - this is just to keep local DB in sync
              });
            }
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

  addShiftSwapLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Validate reciprocal swap
      if (data.personARosteredStart !== 'N/A' && data.personBRosteredStart !== 'N/A') {
        if (data.personAActualStart !== data.personBRosteredStart || data.personAActualFinish !== data.personBRosteredFinish) {
          throw new Error('Person A actual times must match Person B rostered times (reciprocal swap)');
        }
        if (data.personBActualStart !== data.personARosteredStart || data.personBActualFinish !== data.personARosteredFinish) {
          throw new Error('Person B actual times must match Person A rostered times (reciprocal swap)');
        }
      }
      
      // Generate shared shift swap ID
      const shiftSwapId = `shift_swap_${Date.now()}`;
      const timestamp = Date.now();
      
      // Calculate overtime for both entries
      const personACalc = computeMinutes(
        data.personAActualStart,
        data.personAActualFinish,
        data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
        data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
        data.mealBreakMinutes
      );
      
      const personBCalc = computeMinutes(
        data.personBActualStart,
        data.personBActualFinish,
        data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
        data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
        data.mealBreakMinutes
      );
      
      // Create Person A log
      const logA: OvertimeLog = {
        id: `log_${timestamp}_A`,
        date: data.date,
        rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
        rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
        actualStart: data.personAActualStart,
        actualFinish: data.personAActualFinish,
        mealBreakMinutes: data.mealBreakMinutes || undefined,
        minutesOvertime: personACalc.roundedOvertime,
        category: 'Change shift',
        comments: 'Shift swap',
        initials: data.personAInitials,
        status: data.status,
        source: 'manual',
        shiftSwapId,
        linkedLogId: `log_${timestamp}_B`,
        isShiftSwap: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Create Person B log (store Person B's details in swapPartner fields for PDF generation)
      const logB: OvertimeLog = {
        id: `log_${timestamp}_B`,
        date: data.date,
        rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
        rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
        actualStart: data.personBActualStart,
        actualFinish: data.personBActualFinish,
        mealBreakMinutes: data.mealBreakMinutes || undefined,
        minutesOvertime: personBCalc.roundedOvertime,
        category: 'Change shift',
        comments: 'Shift swap',
        initials: data.personBInitials,
        status: data.status,
        source: 'manual',
        shiftSwapId,
        linkedLogId: `log_${timestamp}_A`,
        isShiftSwap: true,
        // Store Person B's details (these will be used for PDF generation)
        swapPartnerName: data.personBName,
        swapPartnerPayrollNumber: data.personBPayrollNumber,
        swapPartnerPayLevel: data.personBPayLevel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Also store Person B's details in Person A's log for reference
      logA.swapPartnerName = data.personBName;
      logA.swapPartnerPayrollNumber = data.personBPayrollNumber;
      logA.swapPartnerPayLevel = data.personBPayLevel;
      
      // Save both logs to local SQLite
      await database.createOvertimeLog(logA, finalUserId);
      await database.createOvertimeLog(logB, finalUserId);
      
      const { logs } = get();
      set({ 
        logs: [logA, logB, ...logs], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        logsSync.uploadLog(logA, finalUserId).catch(err => {
          debug.error('Background sync failed for log A (non-fatal):', err);
          syncQueue.add({
            type: 'log',
            operation: 'create',
            data: logA,
            userId: finalUserId,
          }).catch(() => {});
        });
        
        logsSync.uploadLog(logB, finalUserId).catch(err => {
          debug.error('Background sync failed for log B (non-fatal):', err);
          syncQueue.add({
            type: 'log',
            operation: 'create',
            data: logB,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to create shift swap logs' 
      });
      throw error; // Re-throw so the UI can show error
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
