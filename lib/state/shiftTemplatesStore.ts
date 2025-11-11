import { create } from 'zustand';
import { ShiftTemplate } from '../../types';
import { database } from '../db/sqlite';
import { useAuthStore } from './authStore';
import { shiftTemplatesSync } from '../supabase';

const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

interface ShiftTemplatesState {
  templates: ShiftTemplate[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTemplates: (userId?: string | null) => Promise<void>;
  addTemplate: (template: ShiftTemplate, userId?: string | null) => Promise<void>;
  updateTemplate: (template: ShiftTemplate, userId?: string | null) => Promise<void>;
  deleteTemplate: (id: string, userId?: string | null) => Promise<void>;
  clearError: () => void;
}

export const useShiftTemplatesStore = create<ShiftTemplatesState>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,

  loadTemplates: async (userId?: string | null) => {
    devLog('🔄 ShiftTemplatesStore: Loading templates from database...', { userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const templates = await database.getShiftTemplates(userId);
      devLog('✅ ShiftTemplatesStore: Loaded templates successfully:', {
        count: templates.length,
        templates: templates.map(t => ({ id: t.id, label: t.label, times: `${t.rosteredStart}-${t.rosteredFinish}` }))
      });
      set({ 
        templates, 
        isLoading: false,
        error: null 
      });
      
      // Sync from Supabase in background (non-blocking)
      if (userId) {
        shiftTemplatesSync.downloadTemplates(userId).then(remoteTemplates => {
          if (remoteTemplates.length > 0 || templates.length > 0) {
            devLog('[shiftTemplatesStore.loadTemplates] Syncing templates from Supabase in background', {
              remoteCount: remoteTemplates.length,
              localCount: templates.length,
            });
            
            // Merge with timestamp-based conflict resolution
            const localTemplateMap = new Map(templates.map(template => [template.id, template]));
            const remoteTemplateMap = new Map(remoteTemplates.map(template => [template.id, template]));
            
            const mergedTemplates: ShiftTemplate[] = [];
            const allTemplateIds = new Set([...localTemplateMap.keys(), ...remoteTemplateMap.keys()]);
            
            // Process all templates with timestamp comparison
            for (const templateId of allTemplateIds) {
              const localTemplate = localTemplateMap.get(templateId);
              const remoteTemplate = remoteTemplateMap.get(templateId);
              
              if (localTemplate && remoteTemplate) {
                // Both exist - compare by updatedAt
                const localTime = new Date(localTemplate.updatedAt);
                const remoteTime = new Date(remoteTemplate.updatedAt);
                
                if (localTime > remoteTime) {
                  // Local is newer - use local and upload it
                  mergedTemplates.push(localTemplate);
                  shiftTemplatesSync.uploadTemplate(localTemplate, userId).catch(err => {
                    console.error('[shiftTemplatesStore.loadTemplates] Failed to upload newer local template:', err);
                    // Add to sync queue for retry
                    const { syncQueue } = require('../sync/queue');
                    syncQueue.add({
                      type: 'shift_template',
                      operation: 'update',
                      data: localTemplate,
                      userId,
                    }).catch(() => {});
                  });
                } else {
                  // Remote is newer - use remote and save it locally
                  mergedTemplates.push(remoteTemplate);
                  database.updateShiftTemplate(remoteTemplate, userId).catch(err => {
                    console.error('[shiftTemplatesStore.loadTemplates] Failed to save merged template:', err);
                  });
                }
              } else if (localTemplate) {
                // Only local - add it and upload if not already synced
                mergedTemplates.push(localTemplate);
                shiftTemplatesSync.uploadTemplate(localTemplate, userId).catch(err => {
                  console.error('[shiftTemplatesStore.loadTemplates] Failed to upload local-only template:', err);
                  // Add to sync queue for retry
                  const { syncQueue } = require('../sync/queue');
                  syncQueue.add({
                    type: 'shift_template',
                    operation: 'create',
                    data: localTemplate,
                    userId,
                  }).catch(() => {});
                });
              } else if (remoteTemplate) {
                // Only remote - add it and save locally
                mergedTemplates.push(remoteTemplate);
                database.createShiftTemplate(remoteTemplate, userId).catch(err => {
                  console.error('[shiftTemplatesStore.loadTemplates] Failed to save remote-only template:', err);
                });
              }
            }
            
            // Update store with merged templates
            set({ templates: mergedTemplates });
          }
        }).catch(err => {
          console.error('[shiftTemplatesStore.loadTemplates] Background sync failed (non-fatal):', err);
        });
      }
    } catch (error) {
      console.error('❌ ShiftTemplatesStore: Failed to load templates:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load templates' 
      });
    }
  },

  addTemplate: async (template: ShiftTemplate, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog('➕ ShiftTemplatesStore: Adding new template:', {
      id: template.id,
      label: template.label,
      times: `${template.rosteredStart}-${template.rosteredFinish}`,
      userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      // Save to local SQLite first
      await database.createShiftTemplate(template, finalUserId);
      const { templates } = get();
      devLog('✅ ShiftTemplatesStore: Template added successfully');
      set({ 
        templates: [...templates, template], 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftTemplatesSync.uploadTemplate(template, finalUserId).catch(err => {
          console.error('[shiftTemplatesStore.addTemplate] Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift_template',
            operation: 'create',
            data: template,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('❌ ShiftTemplatesStore: Failed to add template:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add template' 
      });
    }
  },

  updateTemplate: async (template: ShiftTemplate, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog('✏️ ShiftTemplatesStore: Updating template:', {
      id: template.id,
      label: template.label,
      userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous'
    });
    set({ isLoading: true, error: null });
    try {
      // Update local SQLite first
      await database.updateShiftTemplate(template, finalUserId);
      const { templates } = get();
      const updatedTemplates = templates.map(t => t.id === template.id ? template : t);
      devLog('✅ ShiftTemplatesStore: Template updated successfully');
      set({ 
        templates: updatedTemplates, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftTemplatesSync.uploadTemplate(template, finalUserId).catch(err => {
          console.error('[shiftTemplatesStore.updateTemplate] Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift_template',
            operation: 'update',
            data: template,
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('❌ ShiftTemplatesStore: Failed to update template:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update template' 
      });
    }
  },

  deleteTemplate: async (id: string, userId?: string | null) => {
    // Get userId from authStore if not provided
    const finalUserId = userId ?? useAuthStore.getState().user?.id ?? null;
    devLog('🗑️ ShiftTemplatesStore: Deleting template:', { id, userId: finalUserId ? `${finalUserId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Delete from local SQLite first
      await database.deleteShiftTemplate(id, finalUserId);
      const { templates } = get();
      const filteredTemplates = templates.filter(t => t.id !== id);
      devLog('✅ ShiftTemplatesStore: Template deleted successfully');
      set({ 
        templates: filteredTemplates, 
        isLoading: false,
        error: null 
      });
      
      // Sync delete to Supabase in background (non-blocking)
      if (finalUserId) {
        shiftTemplatesSync.deleteTemplate(id, finalUserId).catch(err => {
          console.error('[shiftTemplatesStore.deleteTemplate] Background sync failed (non-fatal):', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          syncQueue.add({
            type: 'shift_template',
            operation: 'delete',
            data: { id },
            userId: finalUserId,
          }).catch(() => {});
        });
      }
    } catch (error) {
      console.error('❌ ShiftTemplatesStore: Failed to delete template:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete template' 
      });
    }
  },

  clearError: () => set({ error: null }),
}));

