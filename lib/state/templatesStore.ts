import { create } from 'zustand';
import { LogTemplate, OvertimeLog } from '../../types';
import { database } from '../db/sqlite';

interface TemplatesState {
  templates: LogTemplate[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTemplates: () => Promise<void>;
  addTemplate: (template: LogTemplate) => Promise<void>;
  updateTemplate: (template: LogTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  isLoading: false,
  error: null,

  loadTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await database.getLogTemplates();
      console.log('Loaded templates:', templates.length);
      set({ 
        templates, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to load templates:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load templates' 
      });
    }
  },

  addTemplate: async (template: LogTemplate) => {
    set({ isLoading: true, error: null });
    try {
      await database.createLogTemplate(template);
      const { templates } = get();
      // Reload from database to ensure consistency
      const allTemplates = await database.getLogTemplates();
      set({ 
        templates: allTemplates, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      console.error('Failed to add template:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to add template' 
      });
      throw error; // Re-throw so the UI can show error
    }
  },

  updateTemplate: async (template: LogTemplate) => {
    set({ isLoading: true, error: null });
    try {
      await database.updateLogTemplate(template);
      const { templates } = get();
      const updatedTemplates = templates.map(t => t.id === template.id ? template : t);
      set({ 
        templates: updatedTemplates, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to update template' 
      });
    }
  },

  deleteTemplate: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await database.deleteLogTemplate(id);
      const { templates } = get();
      const filteredTemplates = templates.filter(t => t.id !== id);
      set({ 
        templates: filteredTemplates, 
        isLoading: false,
        error: null 
      });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to delete template' 
      });
    }
  },


  clearError: () => set({ error: null }),
}));
