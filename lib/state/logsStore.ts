import { create } from 'zustand';
import { OvertimeLog, ExportBatch, MinutesCalculation } from '../../types';
import { database } from '../db/sqlite';
import { computeMinutes, roundToNearest5, getPreviousISODate, getCurrentDate, calculateDuration } from '../time';
import { useAuthStore } from './authStore';
import { useProfileStore } from './profileStore';
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
  hasLoadedExportBatchesOnce: boolean;
  error: string | null;
  
  // Actions
  loadLogs: (userId?: string | null) => Promise<void>;
  loadExportBatches: (userId?: string | null) => Promise<void>;
  addLog: (log: OvertimeLog, userId?: string | null) => Promise<void>;
  addShiftSwapLogs: (data: {
    personADate: string;
    personBDate: string;
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
  updateShiftSwapLogs: (data: {
    shiftSwapId: string;
    personADate: string;
    personBDate: string;
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
  addLeaveLogs: (data: {
    leaveEntries: Array<{
      date: string;
      rosteredStart: string | 'N/A';
      rosteredFinish: string | 'N/A';
    }>;
    comments: string;
    status: 'draft' | 'ready';
  }, userId?: string | null) => Promise<void>;
  updateLeaveLogs: (data: {
    leaveGroupId: string;
    leaveEntries: Array<{
      logId: string;
      date: string;
      rosteredStart: string | 'N/A';
      rosteredFinish: string | 'N/A';
    }>;
    comments: string;
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
  hasLoadedExportBatchesOnce: false,
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
      // Increased timeout to 10 seconds to handle slower mobile data connections
      if (userId) {
        try {
          const syncPromise = exportSync.downloadExportBatches(userId);
          const timeoutPromise = new Promise<ExportBatch[]>((resolve) => {
            setTimeout(() => resolve([]), 10000); // 10 second timeout (increased from 2s for mobile data)
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
              hasLoadedExportBatchesOnce: true,
              error: null 
            });
            
            // Proactively cache PDFs in background (non-blocking)
            // This ensures PDFs are available offline, especially when switching devices
            if (mergedBatches.length > 0) {
              const { ensurePDFsCached } = await import('../storage/pdfStorage');
              const { profile } = useProfileStore.getState();
              ensurePDFsCached(mergedBatches, profile).catch((error) => {
                debug.warn('Failed to proactively cache PDFs (non-fatal):', error);
              });
            }
            
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
        hasLoadedExportBatchesOnce: true,
        error: null 
      });
      
      // Proactively cache PDFs in background (non-blocking)
      // This ensures PDFs are available offline, especially when switching devices
      if (exportBatches.length > 0) {
        const { ensurePDFsCached } = await import('../storage/pdfStorage');
        const { profile } = useProfileStore.getState();
        ensurePDFsCached(exportBatches, profile).catch((error) => {
          debug.warn('Failed to proactively cache PDFs (non-fatal):', error);
        });
      }
      
      // Continue syncing in background for future updates
      // This ensures we get batches even if the initial sync timed out
      if (userId) {
        exportSync.downloadExportBatches(userId).then(async (remoteBatches) => {
          // Always process remote batches, even if empty (to handle updates)
          debug.debug('Syncing export batches from Supabase in background', { count: remoteBatches.length });
          
          // Get current batches from store (may have been updated since initial load)
          const currentBatches = get().exportBatches;
          const localBatchMap = new Map(currentBatches.map(batch => [batch.id, batch]));
          const remoteBatchMap = new Map(remoteBatches.map(batch => [batch.id, batch]));
          
          // Check if we have new batches that aren't in local
          const hasNewBatches = remoteBatches.some(batch => !localBatchMap.has(batch.id));
          const hasUpdatedBatches = remoteBatches.some(batch => {
            const local = localBatchMap.get(batch.id);
            return local && (
              (batch.submittedAt && !local.submittedAt) ||
              (batch.submittedAt && local.submittedAt && new Date(batch.submittedAt) > new Date(local.submittedAt))
            );
          });
          
          // Only update if we have new or updated batches
          if (remoteBatches.length > 0 && (hasNewBatches || hasUpdatedBatches)) {
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
                // Only remote exists - this is a new batch from another device
                mergedMap.set(batchId, remoteBatch);
              } else if (localBatch) {
                // Only local exists - keep it
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
            
            // Proactively cache PDFs in background (non-blocking)
            // This ensures PDFs are available offline, especially when switching devices
            if (mergedBatches.length > 0) {
              const { ensurePDFsCached } = await import('../storage/pdfStorage');
              const { profile } = useProfileStore.getState();
              ensurePDFsCached(mergedBatches, profile).catch((error) => {
                debug.warn('Failed to proactively cache PDFs in background sync (non-fatal):', error);
              });
            }
            
            debug.debug('Background sync completed, updated export batches', { 
              total: mergedBatches.length,
              new: hasNewBatches,
              updated: hasUpdatedBatches
            });
          } else if (remoteBatches.length === 0 && currentBatches.length === 0) {
            // No batches anywhere - this is fine, just log it
            debug.debug('No export batches found in Supabase or local storage');
          }
        }).catch(err => {
          debug.error('Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      const hasLoadedOnce = get().hasLoadedExportBatchesOnce;
      set({ 
        isLoading: false,
        hasLoadedExportBatchesOnce: hasLoadedOnce, // Preserve the flag even on error
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
      
      const isSameDate = data.personADate === data.personBDate;
      
      // Validate based on scenario
      if (isSameDate) {
        // Same date: validate reciprocal swap
        if (data.personARosteredStart !== 'N/A' && data.personBRosteredStart !== 'N/A') {
          if (data.personAActualStart !== data.personBRosteredStart || data.personAActualFinish !== data.personBRosteredFinish) {
            throw new Error('Person A actual times must match Person B rostered times (reciprocal swap)');
          }
          if (data.personBActualStart !== data.personARosteredStart || data.personBActualFinish !== data.personARosteredFinish) {
            throw new Error('Person B actual times must match Person A rostered times (reciprocal swap)');
          }
        }
      } else {
        // Different dates: simplified validation
        // Person A Date 1: rostered filled, actual 'N/A' (handled in log creation)
        // Person A Date 2: rostered 'N/A', actual filled (user enters this)
        // Person B Date 2: rostered = Person A actual (auto-populated), actual 'N/A' (handled in log creation)
        // Person B Date 1: rostered 'N/A', actual = Person A rostered (auto-populated)
        
        // Person A actual times are required (these become Person B's rostered times)
        if (!data.personAActualStart || !data.personAActualFinish || data.personAActualStart === 'N/A' || data.personAActualFinish === 'N/A') {
          throw new Error('Person A actual times are required (these represent the shift worked on Date 2)');
        }
        
        // Person A rostered times are required (these become Person B's actual times)
        if (data.personARosteredStart === 'N/A' || data.personARosteredFinish === 'N/A') {
          throw new Error('Person A rostered times are required (or mark as N/A)');
        }
        
        // Person B times are auto-populated, so validation happens in UI
        // Store validation just ensures Person A times are provided
      }
      
      // Generate shared shift swap ID
      const shiftSwapId = `shift_swap_${Date.now()}`;
      const baseTimestamp = Date.now();
      // Use slightly different timestamps to ensure correct order when sorted by createdAt
      const timestamp = baseTimestamp;
      
      if (isSameDate) {
        // SAME DATE: Create 2 logs (existing behavior)
        // For same date swaps, overtime is the difference between the two shifts
        // Person A's shift duration (rostered)
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;
        
        // Person B's shift duration (rostered, which equals Person A's actual)
        const personBShiftDuration = data.personBRosteredStart !== 'N/A' && data.personBRosteredFinish !== 'N/A'
          ? calculateDuration(data.personBRosteredStart, data.personBRosteredFinish) - data.mealBreakMinutes
          : 0;
        
        // Person A overtime = Person B's shift - Person A's shift (only if positive)
        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);
        
        // Person B overtime = Person A's shift - Person B's shift (only if positive)
        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);
        
        // Calculate for display purposes (but we'll override minutesOvertime)
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
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded, // Only the difference between shifts
          category: 'Change shift',
          comments: 'Shift swap',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        // Create Person B log
        const logB: OvertimeLog = {
          id: `log_${timestamp}_B`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded, // Only the difference between shifts
          category: 'Change shift',
          comments: 'Shift swap',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
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
      } else {
        // DIFFERENT DATES: Create 4 logs in order:
        // 1. Person A, Date 1 - rostered filled, actual 'N/A'
        // 2. Person A, Date 2 - rostered 'N/A', actual filled
        // 3. Person B, Date 2 - rostered filled, actual 'N/A'
        // 4. Person B, Date 1 - rostered 'N/A', actual filled
        
        // Calculate shift durations for overtime calculation
        // Person A's original shift duration (rostered)
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;
        
        // Person B's original shift duration (Person A's actual times)
        const personBShiftDuration = data.personAActualStart !== 'N/A' && data.personAActualFinish !== 'N/A'
          ? calculateDuration(data.personAActualStart, data.personAActualFinish) - data.mealBreakMinutes
          : 0;
        
        // Overtime is only the difference between the two shifts
        // Person A overtime = Person B's shift - Person A's shift (only if positive)
        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);
        
        // Person B overtime = Person A's shift - Person B's shift (only if positive)
        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);
        
        // Log 1: Person A, Date 1 - rostered filled, actual 'N/A'
        const logA1Calc = computeMinutes(
          'N/A',
          'N/A',
          data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          data.mealBreakMinutes
        );
        
        // Create timestamps with slight offsets to ensure correct order when sorted by createdAt DESC
        // Since ORDER BY date DESC, created_at DESC, later timestamps appear first
        // To show Person A before Person B on same date, Person A needs LATER timestamps
        const now = Date.now();
        // Person A logs get later timestamps (appear first when sorted DESC)
        const logA1CreatedAt = new Date(now + 3).toISOString(); // Person A Date 1 (rostered)
        const logA2CreatedAt = new Date(now + 2).toISOString(); // Person A Date 2 (actual)
        // Person B logs get earlier timestamps (appear after Person A when sorted DESC)
        const logB2CreatedAt = new Date(now + 1).toISOString(); // Person B Date 2 (rostered)
        const logB1CreatedAt = new Date(now).toISOString(); // Person B Date 1 (actual)
        
        const logA1: OvertimeLog = {
          id: `log_${timestamp}_A1`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0, // No overtime for original shift (not worked)
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B2`, // Link to Person B's original shift
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA1CreatedAt,
          updatedAt: logA1CreatedAt,
        };
        
        // Log 2: Person A, Date 2 - rostered 'N/A', actual filled (Person B's rostered)
        // Overtime = Person B's shift - Person A's shift (only the difference)
        const logA2: OvertimeLog = {
          id: `log_${timestamp}_A2`,
          date: data.personBDate,
          rosteredStart: 'N/A',
          rosteredFinish: 'N/A',
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded, // Only the difference
          category: 'Change shift',
          comments: 'Shift swap - working Person B\'s shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B1`, // Link to Person B working Person A's shift
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA2CreatedAt,
          updatedAt: logA2CreatedAt,
        };
        
        // Log 3: Person B, Date 2 - rostered filled, actual 'N/A' (Person B's original shift)
        // Person B's rostered = Person A's actual (auto-populated)
        const logB2: OvertimeLog = {
          id: `log_${timestamp}_B2`,
          date: data.personBDate,
          rosteredStart: data.personAActualStart !== 'N/A' ? data.personAActualStart : undefined,
          rosteredFinish: data.personAActualFinish !== 'N/A' ? data.personAActualFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0, // No overtime for original shift (not worked)
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A1`, // Link to Person A's original shift
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB2CreatedAt,
          updatedAt: logB2CreatedAt,
        };
        
        // Log 4: Person B, Date 1 - rostered 'N/A', actual filled (Person A's rostered)
        // Overtime = Person A's shift - Person B's shift (only the difference)
        const logB1: OvertimeLog = {
          id: `log_${timestamp}_B1`,
          date: data.personADate,
          rosteredStart: 'N/A',
          rosteredFinish: 'N/A',
          actualStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : 'N/A',
          actualFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded, // Only the difference
          category: 'Change shift',
          comments: 'Shift swap - working Person A\'s shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A2`, // Link to Person A working Person B's shift
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB1CreatedAt,
          updatedAt: logB1CreatedAt,
        };
        
        // Save all 4 logs to local SQLite in order: A1, A2, B2, B1
        // Order: Person A rostered (Date 1), Person A actual (Date 2), Person B rostered (Date 2), Person B actual (Date 1)
        await database.createOvertimeLog(logA1, finalUserId);
        await database.createOvertimeLog(logA2, finalUserId);
        await database.createOvertimeLog(logB2, finalUserId);
        await database.createOvertimeLog(logB1, finalUserId);
        
        const { logs } = get();
        // Set logs in order: Person A rostered, Person A actual, Person B rostered, Person B actual
        set({ 
          logs: [logA1, logA2, logB2, logB1, ...logs], 
          isLoading: false,
          error: null 
        });
        
        // Sync to Supabase in background (non-blocking)
        if (finalUserId) {
          // Sync in the same order: Person A rostered, Person A actual, Person B rostered, Person B actual
          const syncLogs = [logA1, logA2, logB2, logB1];
          for (const log of syncLogs) {
            logsSync.uploadLog(log, finalUserId).catch(err => {
              debug.error(`Background sync failed for log ${log.id} (non-fatal):`, err);
              syncQueue.add({
                type: 'log',
                operation: 'create',
                data: log,
                userId: finalUserId,
              }).catch(() => {});
            });
          }
        }
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to create shift swap logs' 
      });
      throw error; // Re-throw so the UI can show error
    }
  },

  updateShiftSwapLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      
      // Delete all existing logs in the shift swap group
      const { logs } = get();
      const existingLogs = logs.filter(l => l.shiftSwapId === data.shiftSwapId && l.isShiftSwap);
      
      for (const log of existingLogs) {
        await database.deleteOvertimeLog(log.id, finalUserId);
      }
      
      // Create new logs using the same logic as addShiftSwapLogs
      const isSameDate = data.personADate === data.personBDate;
      const shiftSwapId = data.shiftSwapId;
      const baseTimestamp = Date.now();
      const timestamp = baseTimestamp;
      
      const newLogs: OvertimeLog[] = [];
      
      if (isSameDate) {
        // SAME DATE: Create 2 logs
        const personAShiftDuration = data.personARosteredStart !== 'N/A' && data.personARosteredFinish !== 'N/A'
          ? calculateDuration(data.personARosteredStart, data.personARosteredFinish) - data.mealBreakMinutes
          : 0;
        
        const personBShiftDuration = data.personBRosteredStart !== 'N/A' && data.personBRosteredFinish !== 'N/A'
          ? calculateDuration(data.personBRosteredStart, data.personBRosteredFinish) - data.mealBreakMinutes
          : 0;
        
        const personAOvertime = Math.max(0, personBShiftDuration - personAShiftDuration);
        const personAOvertimeRounded = roundToNearest5(personAOvertime);
        const personBOvertime = Math.max(0, personAShiftDuration - personBShiftDuration);
        const personBOvertimeRounded = roundToNearest5(personBOvertime);
        
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
        
        const logA: OvertimeLog = {
          id: `log_${timestamp}_A`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personAOvertimeRounded,
          category: 'Change shift',
          comments: personACalc?.roundedOvertime !== personAOvertimeRounded 
            ? `Shift swap (calculated: ${personACalc?.roundedOvertime || 0}min, adjusted: ${personAOvertimeRounded}min)`
            : 'Shift swap',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        const logB: OvertimeLog = {
          id: `log_${timestamp}_B`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: personBOvertimeRounded,
          category: 'Change shift',
          comments: personBCalc?.roundedOvertime !== personBOvertimeRounded 
            ? `Shift swap (calculated: ${personBCalc?.roundedOvertime || 0}min, adjusted: ${personBOvertimeRounded}min)`
            : 'Shift swap',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        newLogs.push(logA, logB);
      } else {
        // DIFFERENT DATES: Create 4 logs
        const now = Date.now();
        const logA1CreatedAt = new Date(now + 3).toISOString();
        const logA2CreatedAt = new Date(now + 2).toISOString();
        const logB2CreatedAt = new Date(now + 1).toISOString();
        const logB1CreatedAt = new Date(now).toISOString();
        
        const logA1: OvertimeLog = {
          id: `log_${timestamp}_A1`,
          date: data.personADate,
          rosteredStart: data.personARosteredStart !== 'N/A' ? data.personARosteredStart : undefined,
          rosteredFinish: data.personARosteredFinish !== 'N/A' ? data.personARosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA1CreatedAt,
          updatedAt: logA1CreatedAt,
        };
        
        const logA2: OvertimeLog = {
          id: `log_${timestamp}_A2`,
          date: data.personBDate,
          rosteredStart: undefined,
          rosteredFinish: undefined,
          actualStart: data.personAActualStart,
          actualFinish: data.personAActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: computeMinutes(
            data.personAActualStart,
            data.personAActualFinish,
            undefined,
            undefined,
            data.mealBreakMinutes
          )?.roundedOvertime || 0,
          category: 'Change shift',
          comments: 'Shift swap - worked Person B\'s shift',
          initials: data.personAInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_B1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logA2CreatedAt,
          updatedAt: logA2CreatedAt,
        };
        
        const logB1: OvertimeLog = {
          id: `log_${timestamp}_B1`,
          date: data.personADate,
          rosteredStart: undefined,
          rosteredFinish: undefined,
          actualStart: data.personBActualStart,
          actualFinish: data.personBActualFinish,
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: computeMinutes(
            data.personBActualStart,
            data.personBActualFinish,
            undefined,
            undefined,
            data.mealBreakMinutes
          )?.roundedOvertime || 0,
          category: 'Change shift',
          comments: 'Shift swap - worked Person A\'s shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A1`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB1CreatedAt,
          updatedAt: logB1CreatedAt,
        };
        
        const logB2: OvertimeLog = {
          id: `log_${timestamp}_B2`,
          date: data.personBDate,
          rosteredStart: data.personBRosteredStart !== 'N/A' ? data.personBRosteredStart : undefined,
          rosteredFinish: data.personBRosteredFinish !== 'N/A' ? data.personBRosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: data.mealBreakMinutes || undefined,
          minutesOvertime: 0,
          category: 'Change shift',
          comments: 'Shift swap - original shift',
          initials: data.personBInitials,
          status: data.status,
          source: 'manual',
          shiftSwapId,
          linkedLogId: `log_${timestamp}_A2`,
          isShiftSwap: true,
          swapPartnerName: data.personBName,
          swapPartnerPayrollNumber: data.personBPayrollNumber,
          swapPartnerPayLevel: data.personBPayLevel,
          createdAt: logB2CreatedAt,
          updatedAt: logB2CreatedAt,
        };
        
        newLogs.push(logA1, logA2, logB1, logB2);
      }
      
      // Save all new logs to database
      for (const log of newLogs) {
        await database.createOvertimeLog(log, finalUserId);
      }
      
      // Update state
      const logsWithoutGroup = logs.filter(l => l.shiftSwapId !== data.shiftSwapId);
      const updatedLogs = [...newLogs, ...logsWithoutGroup];
      
      set({ 
        logs: updatedLogs, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        // Delete old logs from cloud
        for (const log of existingLogs) {
          logsSync.deleteLog(log.id, finalUserId).catch(err => {
            debug.error(`Background sync failed for shift swap log deletion ${log.id} (non-fatal):`, err);
            syncQueue.add({
              type: 'log',
              operation: 'delete',
              data: { id: log.id },
              userId: finalUserId,
            }).catch(() => {});
          });
        }
        
        // Upload new logs
        for (const log of newLogs) {
          logsSync.uploadLog(log, finalUserId).catch(err => {
            debug.error(`Background sync failed for shift swap log ${log.id} (non-fatal):`, err);
            syncQueue.add({
              type: 'log',
              operation: 'create',
              data: log,
              userId: finalUserId,
            }).catch(() => {});
          });
        }
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update shift swap logs' 
      });
      throw error;
    }
  },

  addLeaveLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      const { profile, initials } = useProfileStore.getState();
      
      // Validate that we have at least one leave entry
      if (!data.leaveEntries || data.leaveEntries.length === 0) {
        throw new Error('At least one leave entry is required');
      }
      
      // Generate shared leave group ID with more uniqueness
      const now = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const leaveGroupId = `leave_${now}_${randomSuffix}`;
      
      // Deduplicate leave entries by date and rostered times
      const uniqueEntries = new Map<string, typeof data.leaveEntries[0]>();
      for (const entry of data.leaveEntries) {
        const key = `${entry.date}_${entry.rosteredStart}_${entry.rosteredFinish}`;
        if (!uniqueEntries.has(key)) {
          uniqueEntries.set(key, entry);
        }
      }
      
      const deduplicatedEntries = Array.from(uniqueEntries.values());
      
      if (deduplicatedEntries.length !== data.leaveEntries.length) {
        debug.debug('Deduplicated leave entries', {
          original: data.leaveEntries.length,
          deduplicated: deduplicatedEntries.length,
        });
      }
      
      // Create logs for each unique leave entry
      const leaveLogs: OvertimeLog[] = [];
      const logInitials = initials || profile?.employeeInitial || '';
      
      for (let i = 0; i < deduplicatedEntries.length; i++) {
        const entry = deduplicatedEntries[i];
        // Use more unique timestamp with random component to prevent collisions
        const timestamp = now + i;
        const uniqueId = `${timestamp}_${randomSuffix}_${i}`;
        
        // Validate entry
        if (!entry.date) {
          throw new Error(`Leave entry ${i + 1} is missing a date`);
        }
        
        // For leave logs:
        // - actualStart and actualFinish are always 'N/A'
        // - rosteredStart and rosteredFinish come from entry
        // - minutesOvertime is always 0 (no overtime for leave)
        // - category is 'Change shift - cancel leave'
        // - comments come from data.comments
        const log: OvertimeLog = {
          id: `log_${uniqueId}_leave`,
          date: entry.date,
          rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
          rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
          actualStart: 'N/A',
          actualFinish: 'N/A',
          mealBreakMinutes: undefined,
          minutesOvertime: 0, // No overtime for leave
          category: 'Change shift - cancel leave',
          comments: data.comments || undefined,
          initials: logInitials,
          status: data.status,
          source: 'manual',
          leaveGroupId,
          isLeave: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        leaveLogs.push(log);
      }
      
      // Save all logs to local SQLite
      for (const log of leaveLogs) {
        await database.createOvertimeLog(log, finalUserId);
      }
      
      const { logs } = get();
      set({ 
        logs: [...leaveLogs, ...logs], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        for (const log of leaveLogs) {
          logsSync.uploadLog(log, finalUserId).catch(err => {
            debug.error(`Background sync failed for leave log ${log.id} (non-fatal):`, err);
            syncQueue.add({
              type: 'log',
              operation: 'create',
              data: log,
              userId: finalUserId,
            }).catch(() => {});
          });
        }
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to create leave logs' 
      });
      throw error; // Re-throw so the UI can show error
    }
  },

  updateLeaveLogs: async (data, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      // Get userId from authStore if not provided
      const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
      const { profile, initials } = useProfileStore.getState();
      
      // Validate that we have at least one leave entry
      if (!data.leaveEntries || data.leaveEntries.length === 0) {
        throw new Error('At least one leave entry is required');
      }
      
      // Get all existing logs in this leave group
      const { logs } = get();
      const existingLogs = logs.filter(l => l.leaveGroupId === data.leaveGroupId && l.isLeave);
      
      if (existingLogs.length === 0) {
        throw new Error('Leave group not found');
      }
      
      const logInitials = initials || profile?.employeeInitial || '';
      const updatedLogs: OvertimeLog[] = [];
      const logsToDelete: string[] = [];
      
      // Update existing logs or create new ones
      for (const entry of data.leaveEntries) {
        const existingLog = existingLogs.find(l => l.id === entry.logId);
        
        if (existingLog) {
          // Update existing log
          const updatedLog: OvertimeLog = {
            ...existingLog,
            date: entry.date,
            rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
            rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
            comments: data.comments || undefined,
            status: data.status,
            initials: logInitials,
            updatedAt: new Date().toISOString(),
          };
          updatedLogs.push(updatedLog);
        } else {
          // Create new log (if entry was added)
          const newLog: OvertimeLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_leave`,
            date: entry.date,
            rosteredStart: entry.rosteredStart !== 'N/A' ? entry.rosteredStart : undefined,
            rosteredFinish: entry.rosteredFinish !== 'N/A' ? entry.rosteredFinish : undefined,
            actualStart: 'N/A',
            actualFinish: 'N/A',
            mealBreakMinutes: undefined,
            minutesOvertime: 0,
            category: 'Change shift - cancel leave',
            comments: data.comments || undefined,
            initials: logInitials,
            status: data.status,
            source: 'manual',
            leaveGroupId: data.leaveGroupId,
            isLeave: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updatedLogs.push(newLog);
        }
      }
      
      // Find logs to delete (existing logs not in the updated entries)
      const updatedLogIds = new Set(data.leaveEntries.map(e => e.logId).filter(Boolean));
      for (const existingLog of existingLogs) {
        if (!updatedLogIds.has(existingLog.id)) {
          logsToDelete.push(existingLog.id);
        }
      }
      
      // Update or create logs in database
      for (const log of updatedLogs) {
        await database.createOvertimeLog(log, finalUserId);
      }
      
      // Delete removed logs
      for (const logId of logsToDelete) {
        await database.deleteOvertimeLog(logId, finalUserId);
      }
      
      // Update state
      const currentLogs = get().logs;
      const logsWithoutGroup = currentLogs.filter(l => l.leaveGroupId !== data.leaveGroupId);
      const newLogs = [...updatedLogs, ...logsWithoutGroup];
      
      set({ 
        logs: newLogs, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        const existingLogIds = new Set(existingLogs.map(l => l.id));
        for (const log of updatedLogs) {
          const isUpdate = existingLogIds.has(log.id);
          logsSync.uploadLog(log, finalUserId).catch(err => {
            debug.error(`Background sync failed for leave log ${log.id} (non-fatal):`, err);
            syncQueue.add({
              type: 'log',
              operation: isUpdate ? 'update' : 'create',
              data: log,
              userId: finalUserId,
            }).catch(() => {});
          });
        }
        
        for (const logId of logsToDelete) {
          logsSync.deleteLog(logId, finalUserId).catch(err => {
            debug.error(`Background sync failed for leave log deletion ${logId} (non-fatal):`, err);
            syncQueue.add({
              type: 'log',
              operation: 'delete',
              data: { id: logId },
              userId: finalUserId,
            }).catch(() => {});
          });
        }
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update leave logs' 
      });
      throw error;
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
      
      // Check and update unsubmitted AVAC notification after marking as submitted
      const { notificationManager } = require('../notifications');
      notificationManager.checkAndScheduleUnsubmittedAVACNotification(updatedBatches).catch((err: unknown) => {
        debug.error('Failed to check unsubmitted AVAC notification (non-fatal):', err);
      });
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
      (log.status === 'ready' || log.status === 'exported') &&
      !log.isShiftSwap // Exclude shift swap logs
    );
  },
  
  getLoggedShiftForDate: (date: string) => {
    const { logs } = get();
    return logs.find(log => 
      log.date === date && 
      (log.status === 'ready' || log.status === 'exported') &&
      !log.isShiftSwap // Exclude shift swap logs
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
