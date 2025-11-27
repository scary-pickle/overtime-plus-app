/**
 * Sync Queue System
 * Handles offline queue and retry logic for failed sync operations
 */

import * as SecureStore from 'expo-secure-store';
import { createScopedLogger } from '../utils/logger';

const debug = createScopedLogger('SyncQueue');

const SYNC_QUEUE_KEY = 'overtime_plus_sync_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second, exponential backoff

interface SyncOperation {
  id: string;
  type: 'log' | 'shift' | 'profile' | 'exportBatch' | 'pdfUpload';
  operation: 'create' | 'update' | 'delete';
  data: any;
  userId: string;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
}

class SyncQueue {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  async init() {
    try {
      const queueJson = await SecureStore.getItemAsync(SYNC_QUEUE_KEY);
      if (queueJson) {
        this.queue = JSON.parse(queueJson);
        debug.debug('Loaded queue:', this.queue.length, 'operations');
        
        // Process queue if there are pending operations
        if (this.queue.length > 0) {
          this.processQueue();
        }
      }
    } catch (error) {
      debug.error('Failed to load queue:', error);
      this.queue = [];
    }
  }

  async add(operation: Omit<SyncOperation, 'id' | 'retryCount' | 'createdAt'>) {
    const syncOp: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.queue.push(syncOp);
    await this.persist();
    debug.debug('Added operation to queue:', syncOp.id, syncOp.type, syncOp.operation);
    
    // Trigger processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async remove(operationId: string) {
    this.queue = this.queue.filter(op => op.id !== operationId);
    await this.persist();
  }

  async clear() {
    this.queue = [];
    await this.persist();
  }

  async clearForUser(userId: string) {
    this.queue = this.queue.filter(op => op.userId !== userId);
    await this.persist();
  }

  private async persist() {
    try {
      await SecureStore.setItemAsync(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      debug.error('Failed to persist queue:', error);
    }
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    debug.debug('Processing queue:', this.queue.length, 'operations');

    // Process operations one at a time
    for (const operation of [...this.queue]) {
      try {
        await this.processOperation(operation);
        await this.remove(operation.id);
      } catch (error) {
        debug.error('Failed to process operation:', operation.id, error);
        
        // Increment retry count
        operation.retryCount += 1;
        operation.lastAttemptAt = new Date().toISOString();

        if (operation.retryCount >= MAX_RETRIES) {
          debug.error('Max retries reached, removing operation:', operation.id);
          await this.remove(operation.id);
        } else {
          // Update queue with new retry count
          const index = this.queue.findIndex(op => op.id === operation.id);
          if (index >= 0) {
            this.queue[index] = operation;
            await this.persist();
          }
        }
      }
    }

    this.isProcessing = false;

    // If there are still operations, retry after delay
    if (this.queue.length > 0) {
      const retryDelay = RETRY_DELAY_MS * Math.pow(2, this.queue[0].retryCount);
      this.retryTimeout = setTimeout(() => {
        this.processQueue();
      }, retryDelay);
    }
  }

  private async processOperation(operation: SyncOperation) {
    // Import sync functions dynamically to avoid circular dependencies
    const { logsSync, shiftsSync, profileSync, exportSync } = await import('../supabase');
    const { database } = await import('../db/sqlite');

    switch (operation.type) {
      case 'log':
        if (operation.operation === 'create' || operation.operation === 'update') {
          await logsSync.uploadLog(operation.data, operation.userId);
          // Also save to local database if it's a new log
          if (operation.operation === 'create') {
            await database.createOvertimeLog(operation.data, operation.userId).catch(() => {});
          } else {
            await database.updateOvertimeLog(operation.data, operation.userId).catch(() => {});
          }
        } else if (operation.operation === 'delete') {
          await logsSync.deleteLog(operation.data.id, operation.userId);
          await database.deleteOvertimeLog(operation.data.id, operation.userId).catch(() => {});
        }
        break;

      case 'shift':
        if (operation.operation === 'create' || operation.operation === 'update') {
          await shiftsSync.uploadShift(operation.data, operation.userId);
          // Also save to local database if it's a new shift
          if (operation.operation === 'create') {
            await database.createUsualShift(operation.data, operation.userId).catch(() => {});
          } else {
            await database.updateUsualShift(operation.data, operation.userId).catch(() => {});
          }
        } else if (operation.operation === 'delete') {
          await shiftsSync.deleteShift(operation.data.id, operation.userId);
          await database.deleteUsualShift(operation.data.id, operation.userId).catch(() => {});
        }
        break;

      case 'profile':
        if (operation.operation === 'create' || operation.operation === 'update') {
          await profileSync.uploadProfile(operation.data, operation.userId);
        }
        break;

      case 'exportBatch':
        if (operation.operation === 'create' || operation.operation === 'update') {
          await exportSync.uploadExportBatch(operation.data, operation.userId);
        } else if (operation.operation === 'delete') {
          await exportSync.deleteExportBatch(operation.data.id, operation.userId);
        }
        break;

      case 'pdfUpload':
        // Handle PDF upload to cloud storage
        const { uploadPDFToStorage } = await import('../storage/pdfStorage');
        const { pdfUri, batchId } = operation.data;
        const cloudUrl = await uploadPDFToStorage(pdfUri, batchId, operation.userId);
        
        // Update export batch with cloud URL
        const { useLogsStore } = await import('../state/logsStore');
        const logsStore = useLogsStore.getState();
        const batch = logsStore.exportBatches.find(b => b.id === batchId);
        
        if (batch) {
          const updatedBatch = { ...batch, pdfUri: cloudUrl };
          await exportSync.uploadExportBatch(updatedBatch, operation.userId);
          // Update local database
          await database.updateExportBatch(updatedBatch, operation.userId).catch(() => {});
        }
        break;
    }

    debug.debug('Successfully processed operation:', operation.id);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getPendingOperations(): SyncOperation[] {
    return [...this.queue];
  }
}

export const syncQueue = new SyncQueue();

