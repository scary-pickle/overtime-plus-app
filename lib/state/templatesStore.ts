import { create } from 'zustand';
import { LogTemplate, OvertimeLog } from '../../types';
import { database } from '../db/sqlite';
import { createScopedLogger } from '../utils/logger';
import { logTemplatesSync } from '../supabase';
import { useAuthStore } from './authStore';

const debug = createScopedLogger('templatesStore');

interface TemplatesState {
  templates: LogTemplate[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTemplates: (userId?: string | null) => Promise<void>;
  addTemplate: (template: LogTemplate, userId?: string | null) => Promise<void>;
  updateTemplate: (template: LogTemplate, userId?: string | null) => Promise<void>;
  deleteTemplate: (id: string, userId?: string | null) => Promise<void>;
  clearError: () => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,

  loadTemplates: async (userId?: string | null) => {
    const effectiveUserId = userId || useAuthStore.getState().user?.id;
    debug.debug('🔄 TemplatesStore: Loading templates from database...', { userId: effectiveUserId ? `${effectiveUserId.substring(0, 8)}...` : 'anonymous' });
    set({ isLoading: true, error: null });
    try {
      // Load from local SQLite first (fast)
      const templates = await database.getLogTemplates(effectiveUserId);
      debug.debug('✅ TemplatesStore: Loaded templates successfully:', {
        count: templates.length,
        templates: templates.map(t => ({ id: t.id, name: t.name, category: t.category }))
      });
      set({ 
        templates, 
        isLoading: false,
        error: null 
      });
      
      // Sync from Supabase in background (non-blocking)
      if (effectiveUserId) {
        logTemplatesSync.downloadTemplates(effectiveUserId).then(async (remoteTemplates) => {
          if (remoteTemplates.length > 0 || templates.length > 0) {
            debug.debug('[templatesStore.loadTemplates] Syncing templates from Supabase in background', {
              remoteCount: remoteTemplates.length,
              localCount: templates.length,
            });
            
            // Merge with timestamp-based conflict resolution
            const localTemplateMap = new Map(templates.map(template => [template.id, template]));
            const remoteTemplateMap = new Map(remoteTemplates.map(template => [template.id, template]));
            
            const mergedTemplates: LogTemplate[] = [];
            const allTemplateIds = new Set([...localTemplateMap.keys(), ...remoteTemplateMap.keys()]);
            
            // Process all templates with timestamp comparison
            const processTemplates = async () => {
              for (const templateId of allTemplateIds) {
                const localTemplate = localTemplateMap.get(templateId);
                const remoteTemplate = remoteTemplateMap.get(templateId);
                
                if (localTemplate && remoteTemplate) {
                  // Both exist - use timestamp to determine which is newer
                  const localTime = new Date(localTemplate.updatedAt || localTemplate.createdAt).getTime();
                  const remoteTime = new Date(remoteTemplate.updatedAt || remoteTemplate.createdAt).getTime();
                  
                  if (localTime >= remoteTime) {
                    // Local is newer or equal - keep local, but upload it
                    mergedTemplates.push(localTemplate);
                    logTemplatesSync.uploadTemplate(localTemplate, effectiveUserId).catch(err => {
                      debug.error('[templatesStore.loadTemplates] Failed to upload local template:', err);
                    });
                  } else {
                    // Remote is newer - use remote and save locally
                    mergedTemplates.push(remoteTemplate);
                    database.createLogTemplate(remoteTemplate, effectiveUserId).catch(err => {
                      debug.error('[templatesStore.loadTemplates] Failed to save remote template locally:', err);
                    });
                  }
                } else if (remoteTemplate) {
                  // Only remote exists - check if it's been deleted locally before re-creating
                  const isDeleted = await database.isLogTemplateDeleted(remoteTemplate.id, effectiveUserId);
                  
                  if (!isDeleted) {
                    // Not deleted locally - add it and save locally
                    mergedTemplates.push(remoteTemplate);
                    database.createLogTemplate(remoteTemplate, effectiveUserId).catch(err => {
                      debug.error('[templatesStore.loadTemplates] Failed to save remote template locally:', err);
                    });
                  } else {
                    debug.debug('[templatesStore.loadTemplates] Skipping remote template that was deleted locally:', remoteTemplate.id);
                  }
                } else if (localTemplate) {
                  // Only local exists - keep it and upload it
                  mergedTemplates.push(localTemplate);
                  logTemplatesSync.uploadTemplate(localTemplate, effectiveUserId).catch(err => {
                    debug.error('[templatesStore.loadTemplates] Failed to upload local template:', err);
                  });
                }
              }
            };
            
            await processTemplates();
            
            // Update store with merged templates
            if (mergedTemplates.length !== templates.length || 
                mergedTemplates.some((t, i) => t.id !== templates[i]?.id || t.updatedAt !== templates[i]?.updatedAt)) {
              debug.debug('[templatesStore.loadTemplates] Updating store with merged templates', {
                mergedCount: mergedTemplates.length,
                originalCount: templates.length,
              });
              set({ templates: mergedTemplates });
            }
          }
        }).catch(err => {
          debug.error('[templatesStore.loadTemplates] Error syncing templates from Supabase:', err);
          // Don't update error state - background sync failures shouldn't block UI
        });
      }
    } catch (error) {
      debug.error('Failed to load templates:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load templates' 
      });
    }
  },

  addTemplate: async (template: LogTemplate, userId?: string | null) => {
    const effectiveUserId = userId || useAuthStore.getState().user?.id;
    set({ isLoading: true, error: null });
    try {
      await database.createLogTemplate(template, effectiveUserId);
      const { templates } = get();
      // Reload from database to ensure consistency
      const allTemplates = await database.getLogTemplates(effectiveUserId);
      set({ 
        templates: allTemplates, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (effectiveUserId) {
        logTemplatesSync.uploadTemplate(template, effectiveUserId).catch(err => {
          debug.error('[templatesStore.addTemplate] Failed to sync template to Supabase:', err);
          // Don't update error state - background sync failures shouldn't block UI
        });
      }
    } catch (error) {
      debug.error('Failed to add template:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add template' 
      });
      throw error; // Re-throw so the UI can show error
    }
  },

  updateTemplate: async (template: LogTemplate, userId?: string | null) => {
    const effectiveUserId = userId || useAuthStore.getState().user?.id;
    set({ isLoading: true, error: null });
    try {
      await database.updateLogTemplate(template, effectiveUserId);
      const { templates } = get();
      const updatedTemplates = templates.map(t => t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t);
      set({ 
        templates: updatedTemplates, 
        isLoading: false,
        error: null 
      });
      
      // Sync to Supabase in background (non-blocking)
      if (effectiveUserId) {
        const templateToSync = { ...template, updatedAt: new Date().toISOString() };
        logTemplatesSync.uploadTemplate(templateToSync, effectiveUserId).catch(err => {
          debug.error('[templatesStore.updateTemplate] Failed to sync template to Supabase:', err);
          // Don't update error state - background sync failures shouldn't block UI
        });
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update template' 
      });
    }
  },

  deleteTemplate: async (id: string, userId?: string | null) => {
    const effectiveUserId = userId || useAuthStore.getState().user?.id;
    set({ isLoading: true, error: null });
    try {
      await database.deleteLogTemplate(id, effectiveUserId);
      const { templates } = get();
      const filteredTemplates = templates.filter(t => t.id !== id);
      
      // Update UI immediately for better UX
      set({ 
        templates: filteredTemplates, 
        isLoading: false,
        error: null 
      });
      
      debug.debug('[templatesStore.deleteTemplate] Template deleted from local database');
      
      // Sync delete to Supabase (blocking to ensure completion)
      if (effectiveUserId) {
        try {
          await logTemplatesSync.deleteTemplate(id, effectiveUserId);
          debug.debug('[templatesStore.deleteTemplate] Template deleted from Supabase');
        } catch (err) {
          debug.error('[templatesStore.deleteTemplate] Failed to delete from Supabase, adding to sync queue:', err);
          // Add to sync queue for retry
          const { syncQueue } = require('../sync/queue');
          await syncQueue.add({
            type: 'log_template',
            operation: 'delete',
            data: { id },
            userId: effectiveUserId,
          });
        }
      }
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete template' 
      });
    }
  },


  clearError: () => set({ error: null }),
}));
