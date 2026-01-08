/**
 * Finance Scenario Simulator - Scenarios UI Module
 * What-if scenario exploration interface
 */

const FSS = window.FSS || {};
FSS.UI = FSS.UI || {};

FSS.UI.Scenarios = (function() {
  'use strict';

  const { DateTime } = luxon;

  // State
  let scenario = null;
  let baseModel = null;

  /**
   * Initialize the scenarios UI
   */
  function init() {
    baseModel = FSS.Model.load();
    loadScenario();
    setupEventListeners();
    populateRuleSelects();
    renderOperations();
    updateComparison();
    updateStatus();
  }

  /**
   * Load or create scenario
   */
  function loadScenario() {
    scenario = FSS.Storage.loadScenarioDraft();
    if (!scenario) {
      scenario = FSS.Overlay.createScenario('');
    }
    
    // Update name field
    document.getElementById('scenario-name').value = scenario.meta?.name || '';
  }

  /**
   * Save scenario to storage
   */
  function saveScenario() {
    scenario.meta.name = document.getElementById('scenario-name').value.trim();
    FSS.Storage.saveScenarioDraft(scenario);
    updateStatus();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Operation type selector
    document.getElementById('op-type')?.addEventListener('change', handleOpTypeChange);
    
    // Scenario name change
    document.getElementById('scenario-name')?.addEventListener('change', saveScenario);
    
    // Reset button
    document.getElementById('btn-reset-scenario')?.addEventListener('click', handleReset);
    
    // Commit button
    document.getElementById('btn-commit-scenario')?.addEventListener('click', handleCommit);
    
    // Add operation buttons
    document.getElementById('btn-add-delta')?.addEventListener('click', handleAddDelta);
    document.getElementById('btn-add-disable')?.addEventListener('click', handleAddDisable);
    document.getElementById('btn-add-oneoff')?.addEventListener('click', handleAddOneOff);
  }

  /**
   * Populate rule select dropdowns
   */
  function populateRuleSelects() {
    const rules = FSS.Model.getRules();
    const ruleOptions = rules.map(r => 
      `<option value="${r.id}">${r.name} (${r.kind}: ${FSS.App.formatCurrency(r.amount)})</option>`
    ).join('');

    // Delta rule select
    const deltaSelect = document.getElementById('delta-rule-id');
    if (deltaSelect) {
      deltaSelect.innerHTML = '<option value="">Select a rule...</option>' + ruleOptions;
    }

    // Disable rule select
    const disableSelect = document.getElementById('disable-rule-id');
    if (disableSelect) {
      disableSelect.innerHTML = '<option value="">Select a rule...</option>' + ruleOptions;
    }

    // Set default date for one-off
    const oneoffDate = document.getElementById('oneoff-date');
    if (oneoffDate) {
      oneoffDate.value = DateTime.now().plus({ days: 7 }).toISODate();
    }
  }

  /**
   * Handle operation type change
   */
  function handleOpTypeChange(e) {
    const opType = e.target.value;
    
    // Hide all forms
    document.querySelectorAll('.op-form').forEach(form => {
      form.classList.add('d-none');
    });
    
    // Show selected form
    if (opType) {
      const form = document.getElementById(`form-${opType}`);
      form?.classList.remove('d-none');
    }
  }

  /**
   * Handle adding amount delta operation
   */
  function handleAddDelta() {
    const ruleId = document.getElementById('delta-rule-id').value;
    const delta = parseFloat(document.getElementById('delta-amount').value);
    
    if (!ruleId) {
      FSS.App.showToast('Please select a rule', 'error');
      return;
    }
    
    if (isNaN(delta) || delta === 0) {
      FSS.App.showToast('Please enter a valid adjustment amount', 'error');
      return;
    }

    const op = FSS.Overlay.createOp.ruleAmountDelta(ruleId, delta);
    FSS.Overlay.addOperation(scenario, op);
    saveScenario();
    
    // Reset form
    document.getElementById('delta-rule-id').value = '';
    document.getElementById('delta-amount').value = '';
    
    renderOperations();
    updateComparison();
    FSS.App.showToast('Amount adjustment added', 'success');
  }

  /**
   * Handle adding disable operation
   */
  function handleAddDisable() {
    const ruleId = document.getElementById('disable-rule-id').value;
    const disabled = document.getElementById('disable-checked').checked;
    
    if (!ruleId) {
      FSS.App.showToast('Please select a rule', 'error');
      return;
    }

    const op = FSS.Overlay.createOp.ruleDisable(ruleId, disabled);
    FSS.Overlay.addOperation(scenario, op);
    saveScenario();
    
    // Reset form
    document.getElementById('disable-rule-id').value = '';
    document.getElementById('disable-checked').checked = true;
    
    renderOperations();
    updateComparison();
    FSS.App.showToast(disabled ? 'Rule disabled' : 'Rule enabled', 'success');
  }

  /**
   * Handle adding one-off operation
   */
  function handleAddOneOff() {
    const date = document.getElementById('oneoff-date').value;
    const amount = parseFloat(document.getElementById('oneoff-amount').value);
    const name = document.getElementById('oneoff-name').value.trim();
    
    if (!date) {
      FSS.App.showToast('Please select a date', 'error');
      return;
    }
    
    if (isNaN(amount) || amount === 0) {
      FSS.App.showToast('Please enter a valid amount', 'error');
      return;
    }
    
    if (!name) {
      FSS.App.showToast('Please enter a description', 'error');
      return;
    }

    const op = FSS.Overlay.createOp.addOneOff(date, name, amount);
    FSS.Overlay.addOperation(scenario, op);
    saveScenario();
    
    // Reset form
    document.getElementById('oneoff-date').value = DateTime.now().plus({ days: 7 }).toISODate();
    document.getElementById('oneoff-amount').value = '';
    document.getElementById('oneoff-name').value = '';
    
    renderOperations();
    updateComparison();
    FSS.App.showToast('One-off transaction added', 'success');
  }

  /**
   * Handle reset scenario
   */
  async function handleReset() {
    if (!scenario.ops || scenario.ops.length === 0) {
      FSS.App.showToast('No operations to reset', 'info');
      return;
    }

    const confirmed = await FSS.App.confirm(
      'Are you sure you want to reset all scenario changes?',
      'Reset Scenario'
    );
    
    if (confirmed) {
      scenario = FSS.Overlay.createScenario('');
      FSS.Storage.clearScenarioDraft();
      document.getElementById('scenario-name').value = '';
      
      renderOperations();
      updateComparison();
      updateStatus();
      FSS.App.showToast('Scenario reset', 'info');
    }
  }

  /**
   * Handle commit to base
   */
  async function handleCommit() {
    if (!scenario.ops || scenario.ops.length === 0) {
      FSS.App.showToast('No changes to commit', 'info');
      return;
    }

    const confirmed = await FSS.App.confirm(
      'This will permanently apply all scenario changes to your base model. Continue?',
      'Commit to Base Model'
    );
    
    if (confirmed) {
      const effectiveModel = FSS.Overlay.commitToBase(baseModel, scenario);
      FSS.Storage.saveBaseModel(effectiveModel);
      FSS.Storage.clearScenarioDraft();
      
      // Reload
      baseModel = FSS.Model.load();
      scenario = FSS.Overlay.createScenario('');
      document.getElementById('scenario-name').value = '';
      
      renderOperations();
      updateComparison();
      updateStatus();
      FSS.App.showToast('Changes committed to base model', 'success');
    }
  }

  /**
   * Remove an operation
   */
  function removeOperation(index) {
    FSS.Overlay.removeOperation(scenario, index);
    saveScenario();
    renderOperations();
    updateComparison();
  }

  /**
   * Render operations list
   */
  function renderOperations() {
    const container = document.getElementById('ops-list');
    const empty = document.getElementById('ops-empty');
    
    if (!scenario.ops || scenario.ops.length === 0) {
      empty.classList.remove('d-none');
      container.innerHTML = '';
      container.appendChild(empty);
      return;
    }
    
    empty.classList.add('d-none');
    
    container.innerHTML = scenario.ops.map((op, index) => {
      const description = FSS.Overlay.describeOperation(op, baseModel);
      const iconClass = getOpIcon(op.op);
      
      return `
        <div class="d-flex align-items-center gap-2 p-2 mb-2 rounded" style="background: var(--bg-tertiary);">
          <i class="bi ${iconClass} text-muted"></i>
          <span class="flex-grow-1 small">${description}</span>
          <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Scenarios.removeOperation(${index})">
            <i class="bi bi-x"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * Get icon class for operation type
   */
  function getOpIcon(opType) {
    switch (opType) {
      case FSS.Overlay.OPS.RULE_AMOUNT_SET:
      case FSS.Overlay.OPS.RULE_AMOUNT_DELTA:
        return 'bi-currency-dollar';
      case FSS.Overlay.OPS.RULE_DISABLE:
        return 'bi-pause-circle';
      case FSS.Overlay.OPS.ADD_ONEOFF:
        return 'bi-calendar-plus';
      case FSS.Overlay.OPS.REMOVE_ONEOFF:
        return 'bi-calendar-minus';
      default:
        return 'bi-gear';
    }
  }

  /**
   * Update comparison view
   */
  function updateComparison() {
    const effectiveModel = FSS.Overlay.applyScenario(baseModel, scenario);
    const comparison = FSS.Overlay.compareModels(baseModel, effectiveModel);
    
    // Base values
    document.getElementById('base-end-balance').textContent = FSS.App.formatCurrency(comparison.base.endBalance);
    document.getElementById('base-min-balance').textContent = FSS.App.formatCurrency(comparison.base.minBalance);
    document.getElementById('base-income').textContent = FSS.App.formatCurrency(comparison.base.totalIncome);
    document.getElementById('base-expenses').textContent = FSS.App.formatCurrency(comparison.base.totalExpenses);
    
    // Scenario values
    document.getElementById('scenario-end-balance').textContent = FSS.App.formatCurrency(comparison.scenario.endBalance);
    document.getElementById('scenario-min-balance').textContent = FSS.App.formatCurrency(comparison.scenario.minBalance);
    document.getElementById('scenario-income').textContent = FSS.App.formatCurrency(comparison.scenario.totalIncome);
    document.getElementById('scenario-expenses').textContent = FSS.App.formatCurrency(comparison.scenario.totalExpenses);
    
    // Net difference
    const netDiff = comparison.difference.endBalance;
    const netDiffEl = document.getElementById('net-difference');
    netDiffEl.textContent = `${netDiff >= 0 ? '+' : ''}${FSS.App.formatCurrency(netDiff)}`;
    netDiffEl.className = `h4 mono mb-0 ${netDiff >= 0 ? 'text-income' : 'text-expense'}`;
  }

  /**
   * Update status indicators
   */
  function updateStatus() {
    const opsCount = scenario.ops?.length || 0;
    const statusDot = document.getElementById('scenario-status-dot');
    const statusText = document.getElementById('scenario-status-text');
    
    document.getElementById('ops-count').textContent = opsCount;
    
    if (opsCount > 0) {
      statusDot.className = 'status-dot warning';
      statusText.textContent = 'Unsaved changes';
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'No changes';
    }
  }

  // Public API
  return {
    init,
    removeOperation
  };
})();

window.FSS = FSS;


