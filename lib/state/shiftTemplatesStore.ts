import { create } from 'zustand';
import { ShiftTemplate } from '../../types';
import { database } from '../db/sqlite';
import { createScopedLogger } from '../utils/logger';

const devLog = createScopedLogger('shiftTemplatesStore');

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
    devLog.debug('🔄 ShiftTemplatesStore: Loading templates from database...', {
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
    });
    set({ isLoading: true, error: null });
    try {
      const templates = await database.getShiftTemplates(userId);
      devLog.debug('✅ ShiftTemplatesStore: Loaded templates successfully:', {
        count: templates.length,
        templates: templates.map(t => ({
          id: t.id,
          label: t.label,
          times: `${t.rosteredStart}-${t.rosteredFinish}`,
        })),
      });
      set({ templates, isLoading: false, error: null });
    } catch (error) {
      devLog.error('Failed to load templates:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      });
    }
  },

  addTemplate: async (template: ShiftTemplate, userId?: string | null) => {
    devLog.debug('➕ ShiftTemplatesStore: Adding new template:', {
      id: template.id,
      label: template.label,
      times: `${template.rosteredStart}-${template.rosteredFinish}`,
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
    });
    set({ isLoading: true, error: null });
    try {
      await database.createShiftTemplate(template, userId);
      const { templates } = get();
      devLog.debug('✅ ShiftTemplatesStore: Template added successfully');
      set({ templates: [...templates, template], isLoading: false, error: null });
    } catch (error) {
      devLog.error('Failed to add template:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add template',
      });
    }
  },

  updateTemplate: async (template: ShiftTemplate, userId?: string | null) => {
    devLog.debug('✏️ ShiftTemplatesStore: Updating template:', {
      id: template.id,
      label: template.label,
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
    });
    set({ isLoading: true, error: null });
    try {
      await database.updateShiftTemplate(template, userId);
      const { templates } = get();
      const updatedTemplates = templates.map(t => (t.id === template.id ? template : t));
      devLog.debug('✅ ShiftTemplatesStore: Template updated successfully');
      set({ templates: updatedTemplates, isLoading: false, error: null });
    } catch (error) {
      devLog.error('Failed to update template:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  },

  deleteTemplate: async (id: string, userId?: string | null) => {
    devLog.debug('🗑️ ShiftTemplatesStore: Deleting template:', {
      id,
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
    });
    set({ isLoading: true, error: null });
    try {
      await database.deleteShiftTemplate(id, userId);
      const { templates } = get();
      const filteredTemplates = templates.filter(t => t.id !== id);
      set({ templates: filteredTemplates, isLoading: false, error: null });
      devLog.debug('✅ ShiftTemplatesStore: Template deleted from local database');
    } catch (error) {
      devLog.error('Failed to delete template:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
