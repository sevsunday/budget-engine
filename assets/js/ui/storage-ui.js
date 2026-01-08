/**
 * Finance Scenario Simulator - Storage UI Module
 * Export/import/reset controls
 */

const FSS = window.FSS || {};
FSS.UI = FSS.UI || {};

FSS.UI.Storage = (function() {
  'use strict';

  const { DateTime } = luxon;

  // State
  let pendingImport = null;

  /**
   * Initialize the storage UI
   */
  function init() {
    setupEventListeners();
    updateStats();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Export buttons
    document.getElementById('btn-export-base')?.addEventListener('click', handleExportBase);
    document.getElementById('btn-export-full')?.addEventListener('click', handleExportFull);
    
    // Import
    document.getElementById('import-file')?.addEventListener('change', handleFileSelect);
    document.getElementById('btn-import')?.addEventListener('click', handleImport);
    
    // Reset buttons
    document.getElementById('btn-reset-scenario')?.addEventListener('click', handleResetScenario);
    document.getElementById('btn-reset-base')?.addEventListener('click', handleResetBase);
    document.getElementById('btn-reset-all')?.addEventListener('click', handleResetAll);
    
    // Preview toggle
    document.getElementById('btn-toggle-preview')?.addEventListener('click', togglePreview);
  }

  /**
   * Update storage statistics
   */
  function updateStats() {
    const stats = FSS.Storage.getStats();
    
    // Format bytes
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 bytes';
      if (bytes < 1024) return `${bytes} bytes`;
      return `${(bytes / 1024).toFixed(1)} KB`;
    };
    
    // Base model stats
    document.getElementById('stat-base-size').textContent = formatBytes(stats.baseModelSize);
    if (stats.hasBaseModel) {
      const model = FSS.Storage.loadBaseModel();
      const ruleCount = model?.rules?.length || 0;
      const accountCount = model?.accounts?.length || 0;
      document.getElementById('stat-base-status').textContent = 
        `${accountCount} accounts, ${ruleCount} rules`;
      document.getElementById('stat-base-status').className = 'small text-success';
    } else {
      document.getElementById('stat-base-status').textContent = 'No data';
      document.getElementById('stat-base-status').className = 'small text-muted';
    }
    
    // Scenario stats
    document.getElementById('stat-scenario-size').textContent = formatBytes(stats.scenarioSize);
    if (stats.hasScenarioDraft) {
      const scenario = FSS.Storage.loadScenarioDraft();
      const opsCount = scenario?.ops?.length || 0;
      document.getElementById('stat-scenario-status').textContent = 
        `${opsCount} pending operations`;
      document.getElementById('stat-scenario-status').className = 'small text-warning';
    } else {
      document.getElementById('stat-scenario-status').textContent = 'No active scenario';
      document.getElementById('stat-scenario-status').className = 'small text-muted';
    }
    
    // Total stats
    document.getElementById('stat-total-size').textContent = formatBytes(stats.totalSize);
  }

  /**
   * Handle export base model
   */
  function handleExportBase() {
    const json = FSS.Storage.exportBaseModelJSON();
    
    if (!json) {
      FSS.App.showToast('No base model to export', 'warning');
      return;
    }
    
    const filename = `fss-model-${DateTime.now().toFormat('yyyy-MM-dd')}.json`;
    FSS.App.downloadFile(json, filename);
    FSS.App.showToast('Base model exported', 'success');
  }

  /**
   * Handle export full (base + scenario)
   */
  function handleExportFull() {
    const json = FSS.Storage.exportFullJSON();
    
    if (!json) {
      FSS.App.showToast('No data to export', 'warning');
      return;
    }
    
    const filename = `fss-full-export-${DateTime.now().toFormat('yyyy-MM-dd')}.json`;
    FSS.App.downloadFile(json, filename);
    FSS.App.showToast('Full export downloaded', 'success');
  }

  /**
   * Handle file selection for import
   */
  async function handleFileSelect(e) {
    const file = e.target.files[0];
    const previewAlert = document.getElementById('import-preview');
    const importBtn = document.getElementById('btn-import');
    
    if (!file) {
      previewAlert.classList.add('d-none');
      importBtn.disabled = true;
      pendingImport = null;
      return;
    }
    
    try {
      const content = await FSS.App.readFile(file);
      const data = JSON.parse(content);
      
      // Determine type and validate
      let preview = '';
      let isValid = false;
      
      if (data.baseModel) {
        // Full export
        const validation = FSS.Schema.validateModel(data.baseModel);
        if (validation.valid) {
          const accounts = data.baseModel.accounts?.length || 0;
          const rules = data.baseModel.rules?.length || 0;
          const hasScenario = data.scenarioDraft?.ops?.length > 0;
          
          preview = `
            <strong>Full Export Detected</strong><br>
            <span class="text-success"><i class="bi bi-check-circle me-1"></i>Valid structure</span><br>
            ${accounts} accounts, ${rules} rules${hasScenario ? ', includes scenario' : ''}
          `;
          isValid = true;
        } else {
          preview = `
            <strong>Invalid File</strong><br>
            <span class="text-danger"><i class="bi bi-x-circle me-1"></i>${validation.errors[0]?.message}</span>
          `;
        }
      } else if (data.meta && data.accounts) {
        // Base model only
        const validation = FSS.Schema.validateModel(data);
        if (validation.valid) {
          const accounts = data.accounts?.length || 0;
          const rules = data.rules?.length || 0;
          
          preview = `
            <strong>Base Model Detected</strong><br>
            <span class="text-success"><i class="bi bi-check-circle me-1"></i>Valid structure</span><br>
            ${accounts} accounts, ${rules} rules
          `;
          isValid = true;
        } else {
          preview = `
            <strong>Invalid File</strong><br>
            <span class="text-danger"><i class="bi bi-x-circle me-1"></i>${validation.errors[0]?.message}</span>
          `;
        }
      } else {
        preview = `
          <strong>Unknown Format</strong><br>
          <span class="text-danger"><i class="bi bi-x-circle me-1"></i>File does not appear to be an FSS export</span>
        `;
      }
      
      previewAlert.innerHTML = preview;
      previewAlert.classList.remove('d-none');
      previewAlert.classList.toggle('alert-success', isValid);
      previewAlert.classList.toggle('alert-danger', !isValid);
      
      importBtn.disabled = !isValid;
      pendingImport = isValid ? content : null;
      
    } catch (err) {
      previewAlert.innerHTML = `
        <strong>Error Reading File</strong><br>
        <span class="text-danger"><i class="bi bi-x-circle me-1"></i>${err.message}</span>
      `;
      previewAlert.classList.remove('d-none', 'alert-success');
      previewAlert.classList.add('alert-danger');
      importBtn.disabled = true;
      pendingImport = null;
    }
  }

  /**
   * Handle import
   */
  async function handleImport() {
    if (!pendingImport) return;
    
    const confirmed = await FSS.App.confirm(
      'This will replace your current data with the imported file. Continue?',
      'Import Data'
    );
    
    if (!confirmed) return;
    
    const result = FSS.Storage.importJSON(pendingImport);
    
    if (result.success) {
      FSS.App.showToast(result.message, 'success');
      
      // Reset form
      document.getElementById('import-file').value = '';
      document.getElementById('import-preview').classList.add('d-none');
      document.getElementById('btn-import').disabled = true;
      pendingImport = null;
      
      // Update stats
      updateStats();
      updatePreview();
    } else {
      FSS.App.showToast(result.message, 'error');
    }
  }

  /**
   * Handle reset scenario only
   */
  async function handleResetScenario() {
    if (!FSS.Storage.hasScenarioDraft()) {
      FSS.App.showToast('No scenario to reset', 'info');
      return;
    }
    
    const confirmed = await FSS.App.confirm(
      'This will clear your active scenario draft. Continue?',
      'Reset Scenario'
    );
    
    if (confirmed) {
      FSS.Storage.clearScenarioDraft();
      FSS.App.showToast('Scenario cleared', 'success');
      updateStats();
      updatePreview();
    }
  }

  /**
   * Handle reset base model
   */
  async function handleResetBase() {
    const confirmed = await FSS.App.confirm(
      'This will delete your entire financial model. This cannot be undone. Continue?',
      'Reset Base Model'
    );
    
    if (confirmed) {
      FSS.Storage.clearBaseModel();
      
      // Create new empty model
      const emptyModel = FSS.Schema.createEmptyModel();
      FSS.Storage.saveBaseModel(emptyModel);
      
      FSS.App.showToast('Base model reset', 'success');
      updateStats();
      updatePreview();
    }
  }

  /**
   * Handle reset all data
   */
  async function handleResetAll() {
    const confirmed = await FSS.App.confirm(
      'This will permanently delete ALL your data including your financial model and any scenarios. This cannot be undone. Are you absolutely sure?',
      'Reset All Data'
    );
    
    if (confirmed) {
      FSS.Storage.resetAll();
      
      // Create new empty model
      const emptyModel = FSS.Schema.createEmptyModel();
      FSS.Storage.saveBaseModel(emptyModel);
      
      FSS.App.showToast('All data reset', 'success');
      updateStats();
      updatePreview();
    }
  }

  /**
   * Toggle preview visibility
   */
  function togglePreview() {
    const previewBody = document.getElementById('preview-body');
    const toggleBtn = document.getElementById('btn-toggle-preview');
    
    if (previewBody.classList.contains('d-none')) {
      previewBody.classList.remove('d-none');
      toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i> Hide';
      updatePreview();
    } else {
      previewBody.classList.add('d-none');
      toggleBtn.innerHTML = '<i class="bi bi-eye"></i> Show';
    }
  }

  /**
   * Update data preview
   */
  function updatePreview() {
    const baseModel = FSS.Storage.loadBaseModel();
    const scenario = FSS.Storage.loadScenarioDraft();
    
    document.getElementById('preview-base-code').textContent = 
      baseModel ? JSON.stringify(baseModel, null, 2) : 'No base model';
    
    document.getElementById('preview-scenario-code').textContent = 
      scenario ? JSON.stringify(scenario, null, 2) : 'No active scenario';
  }

  // Public API
  return {
    init
  };
})();

window.FSS = FSS;


