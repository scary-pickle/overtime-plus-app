import { create } from 'zustand';
import { LogTemplate } from '../../types';
import { database } from '../db/sqlite';
import { createScopedLogger } from '../utils/logger';

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
    debug.debug('🔄 TemplatesStore: Loading templates from database...', {
      userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
    });
    set({ isLoading: true, error: null });
    try {
      const templates = await database.getLogTemplates(userId);
      debug.debug('✅ TemplatesStore: Loaded templates successfully:', {
        count: templates.length,
        templates: templates.map(t => ({ id: t.id, name: t.name, category: t.category })),
      });
      set({ templates, isLoading: false, error: null });
    } catch (error) {
      debug.error('Failed to load templates:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load templates',
      });
    }
  },

  addTemplate: async (template: LogTemplate, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.createLogTemplate(template, userId);
      const allTemplates = await database.getLogTemplates(userId);
      set({ templates: allTemplates, isLoading: false, error: null });
    } catch (error) {
      debug.error('Failed to add template:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add template',
      });
      throw error;
    }
  },

  updateTemplate: async (template: LogTemplate, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.updateLogTemplate(template, userId);
      const { templates } = get();
      const updatedTemplates = templates.map(t =>
        t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t,
      );
      set({ templates: updatedTemplates, isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  },

  deleteTemplate: async (id: string, userId?: string | null) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteLogTemplate(id, userId);
      const { templates } = get();
      const filteredTemplates = templates.filter(t => t.id !== id);
      set({ templates: filteredTemplates, isLoading: false, error: null });
      debug.debug('[templatesStore.deleteTemplate] Template deleted from local database');
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
