import { create } from 'zustand';
import { sync } from '../supabase';
import { syncQueue } from '../sync/queue';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'pending';

interface SyncState {
  status: SyncStatus;
  lastSyncTime: string | null;
  pendingOperations: number;
  error: string | null;
  
  // Actions
  checkSyncStatus: () => Promise<void>;
  triggerFullSync: (userId: string) => Promise<void>;
  updateStatus: (status: SyncStatus, error?: string | null) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'synced',
  lastSyncTime: null,
  pendingOperations: 0,
  error: null,

  checkSyncStatus: async () => {
    try {
      const isConnected = await sync.checkConnection();
      
      if (!isConnected) {
        set({ status: 'offline', error: 'Cannot connect to Supabase' });
        return;
      }

      const pendingOps = syncQueue.getQueueLength();
      
      if (pendingOps > 0) {
        set({ 
          status: 'pending', 
          pendingOperations: pendingOps,
          error: null 
        });
      } else {
        set({ 
          status: 'synced', 
          pendingOperations: 0,
          error: null,
          lastSyncTime: new Date().toISOString()
        });
      }
    } catch (error) {
      set({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Failed to check sync status'
      });
    }
  },

  triggerFullSync: async (userId: string) => {
    set({ status: 'syncing', error: null });
    
    try {
      const result = await sync.fullSync(userId);
      
      if (result.success) {
        set({ 
          status: 'synced', 
          lastSyncTime: new Date().toISOString(),
          error: null,
          pendingOperations: syncQueue.getQueueLength()
        });
      } else {
        set({ 
          status: 'error', 
          error: result.error || 'Sync failed',
          pendingOperations: syncQueue.getQueueLength()
        });
      }
    } catch (error) {
      set({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Sync failed',
        pendingOperations: syncQueue.getQueueLength()
      });
    }
  },

  updateStatus: (status: SyncStatus, error?: string | null) => {
    set({ 
      status, 
      error: error || null,
      pendingOperations: syncQueue.getQueueLength()
    });
    
    if (status === 'synced') {
      set({ lastSyncTime: new Date().toISOString() });
    }
  },
}));






