/**
 * Finance Scenario Simulator - Storage Module
 * localStorage wrapper for base model and scenario draft persistence
 */

const FSS = window.FSS || {};

FSS.Storage = (function() {
  'use strict';

  const KEYS = {
    BASE_MODEL: 'fss.baseModel.v1',
    SCENARIO_DRAFT: 'fss.scenarioDraft.v1',
    UI_STATE: 'fss.ui.v1'
  };

  /**
   * Check if localStorage is available
   */
  function isAvailable() {
    try {
      const test = '__fss_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get raw value from localStorage
   */
  function getRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('Storage read error:', e);
      return null;
    }
  }

  /**
   * Set raw value to localStorage
   */
  function setRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error('Storage write error:', e);
      return false;
    }
  }

  /**
   * Remove key from localStorage
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  }

  /**
   * Get parsed JSON from localStorage
   */
  function getJSON(key) {
    const raw = getRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Storage JSON parse error:', e);
      return null;
    }
  }

  /**
   * Set JSON to localStorage
   */
  function setJSON(key, value) {
    try {
      return setRaw(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage JSON stringify error:', e);
      return false;
    }
  }

  // === Base Model Operations ===

  /**
   * Load the base model from localStorage
   * Returns null if not found or invalid
   */
  function loadBaseModel() {
    const model = getJSON(KEYS.BASE_MODEL);
    if (!model) return null;
    
    const validation = FSS.Schema.validateModel(model);
    if (!validation.valid) {
      console.warn('Loaded base model has validation errors:', validation.errors);
    }
    return model;
  }

  /**
   * Save the base model to localStorage
   * Returns true on success
   */
  function saveBaseModel(model) {
    if (!model) return false;
    
    // Update timestamp
    FSS.Schema.touchModel(model);
    
    return setJSON(KEYS.BASE_MODEL, model);
  }

  /**
   * Check if a base model exists in localStorage
   */
  function hasBaseModel() {
    return getRaw(KEYS.BASE_MODEL) !== null;
  }

  /**
   * Clear the base model from localStorage
   */
  function clearBaseModel() {
    return remove(KEYS.BASE_MODEL);
  }

  // === Scenario Draft Operations ===

  /**
   * Load the scenario draft from localStorage
   */
  function loadScenarioDraft() {
    return getJSON(KEYS.SCENARIO_DRAFT);
  }

  /**
   * Save the scenario draft to localStorage
   */
  function saveScenarioDraft(scenario) {
    if (!scenario) return false;
    return setJSON(KEYS.SCENARIO_DRAFT, scenario);
  }

  /**
   * Check if a scenario draft exists
   */
  function hasScenarioDraft() {
    const draft = getJSON(KEYS.SCENARIO_DRAFT);
    return draft && draft.ops && draft.ops.length > 0;
  }

  /**
   * Clear the scenario draft
   */
  function clearScenarioDraft() {
    return remove(KEYS.SCENARIO_DRAFT);
  }

  // === UI State Operations ===

  /**
   * Load UI state from localStorage
   */
  function loadUIState() {
    return getJSON(KEYS.UI_STATE) || {};
  }

  /**
   * Save UI state to localStorage
   */
  function saveUIState(state) {
    return setJSON(KEYS.UI_STATE, state);
  }

  /**
   * Update a specific UI state property
   */
  function updateUIState(key, value) {
    const state = loadUIState();
    state[key] = value;
    return saveUIState(state);
  }

  // === Export/Import Operations ===

  /**
   * Export base model as JSON string
   */
  function exportBaseModelJSON() {
    const model = loadBaseModel();
    if (!model) return null;
    return JSON.stringify(model, null, 2);
  }

  /**
   * Export base model + scenario as combined JSON
   */
  function exportFullJSON() {
    const data = {
      baseModel: loadBaseModel(),
      scenarioDraft: loadScenarioDraft()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import JSON data
   * Returns { success: boolean, message: string, type: 'base'|'full' }
   */
  function importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      // Check if it's a full export (has baseModel property)
      if (data.baseModel) {
        const validation = FSS.Schema.validateModel(data.baseModel);
        if (!validation.valid) {
          return { 
            success: false, 
            message: 'Invalid base model: ' + validation.errors.map(e => e.message).join(', '),
            type: null
          };
        }
        
        saveBaseModel(data.baseModel);
        
        if (data.scenarioDraft) {
          saveScenarioDraft(data.scenarioDraft);
        }
        
        return { success: true, message: 'Full export imported successfully', type: 'full' };
      }

      // Otherwise, treat as base model only
      const validation = FSS.Schema.validateModel(data);
      if (!validation.valid) {
        return { 
          success: false, 
          message: 'Invalid model: ' + validation.errors.map(e => e.message).join(', '),
          type: null
        };
      }

      saveBaseModel(data);
      return { success: true, message: 'Base model imported successfully', type: 'base' };

    } catch (e) {
      return { success: false, message: 'Invalid JSON: ' + e.message, type: null };
    }
  }

  // === Reset Operations ===

  /**
   * Reset all FSS data
   */
  function resetAll() {
    clearBaseModel();
    clearScenarioDraft();
    remove(KEYS.UI_STATE);
    return true;
  }

  /**
   * Get storage statistics
   */
  function getStats() {
    const baseRaw = getRaw(KEYS.BASE_MODEL);
    const scenarioRaw = getRaw(KEYS.SCENARIO_DRAFT);
    const uiRaw = getRaw(KEYS.UI_STATE);

    return {
      hasBaseModel: !!baseRaw,
      hasScenarioDraft: hasScenarioDraft(),
      baseModelSize: baseRaw ? baseRaw.length : 0,
      scenarioSize: scenarioRaw ? scenarioRaw.length : 0,
      uiStateSize: uiRaw ? uiRaw.length : 0,
      totalSize: (baseRaw?.length || 0) + (scenarioRaw?.length || 0) + (uiRaw?.length || 0)
    };
  }

  // Public API
  return {
    KEYS,
    isAvailable,
    
    // Base Model
    loadBaseModel,
    saveBaseModel,
    hasBaseModel,
    clearBaseModel,
    
    // Scenario Draft
    loadScenarioDraft,
    saveScenarioDraft,
    hasScenarioDraft,
    clearScenarioDraft,
    
    // UI State
    loadUIState,
    saveUIState,
    updateUIState,
    
    // Export/Import
    exportBaseModelJSON,
    exportFullJSON,
    importJSON,
    
    // Reset
    resetAll,
    getStats
  };
})();

window.FSS = FSS;


