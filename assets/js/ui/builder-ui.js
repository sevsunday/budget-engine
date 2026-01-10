/**
 * Finance Scenario Simulator - Builder UI Module
 * Accordion-based editor for all model sections
 */

var FSS = window.FSS || {};
FSS.UI = FSS.UI || {};

FSS.UI.Builder = (function() {
  'use strict';

  const { DateTime } = luxon;

  // State
  let model = null;
  let editingItem = null;

  /**
   * Initialize the builder UI
   */
  function init() {
    model = FSS.Model.load();
    
    setupEventListeners();
    renderAll();
    updateCounts();
    loadSettings();
    checkUnsavedChanges();
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Save buttons
    document.getElementById('btn-save')?.addEventListener('click', handleSave);
    document.getElementById('btn-save-bottom')?.addEventListener('click', handleSave);
    
    // Validate button
    document.getElementById('btn-validate')?.addEventListener('click', handleValidate);
    
    // Discard button
    document.getElementById('btn-discard')?.addEventListener('click', handleDiscard);
    
    // Export button
    document.getElementById('btn-export')?.addEventListener('click', handleExport);
    
    // Import file
    document.getElementById('import-file')?.addEventListener('change', handleImport);
    
    // Add buttons
    document.getElementById('btn-add-account')?.addEventListener('click', () => showAccountModal());
    document.getElementById('btn-add-balance')?.addEventListener('click', () => showBalanceModal());
    document.getElementById('btn-add-income')?.addEventListener('click', () => showRuleModal('income'));
    document.getElementById('btn-add-expense')?.addEventListener('click', () => showRuleModal('expense'));
    document.getElementById('btn-add-transfer')?.addEventListener('click', () => showRuleModal('transfer'));
    document.getElementById('btn-add-oneoff')?.addEventListener('click', () => showOneOffModal());
    document.getElementById('btn-add-debt')?.addEventListener('click', () => showDebtModal());
    
    // Settings changes
    document.getElementById('setting-horizon')?.addEventListener('change', handleSettingsChange);
    document.getElementById('setting-currency')?.addEventListener('change', handleSettingsChange);
    document.getElementById('setting-buffer')?.addEventListener('change', handleSettingsChange);
    document.getElementById('setting-floor')?.addEventListener('change', handleSettingsChange);
    document.getElementById('setting-weekends')?.addEventListener('change', handleSettingsChange);
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (FSS.Model.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Render all sections
   */
  function renderAll() {
    renderAccounts();
    renderBalances();
    renderRules('income');
    renderRules('expense');
    renderRules('transfer');
    renderOneOffs();
    renderDebts();
  }

  /**
   * Update badge counts
   */
  function updateCounts() {
    document.getElementById('accounts-count').textContent = FSS.Model.getAccounts().length;
    document.getElementById('balances-count').textContent = FSS.Model.getStartingBalances().length;
    document.getElementById('income-count').textContent = FSS.Model.getIncomeRules().length;
    document.getElementById('expense-count').textContent = FSS.Model.getExpenseRules().length;
    document.getElementById('transfer-count').textContent = FSS.Model.getTransferRules().length;
    document.getElementById('oneoff-count').textContent = FSS.Model.getOneOffs().length;
    document.getElementById('debt-count').textContent = FSS.Model.getDebts().length;
  }

  /**
   * Check and show unsaved changes alert
   */
  function checkUnsavedChanges() {
    const alert = document.getElementById('unsaved-alert');
    if (FSS.Model.hasUnsavedChanges()) {
      alert.classList.remove('d-none');
    } else {
      alert.classList.add('d-none');
    }
  }

  /**
   * Load settings into form
   */
  function loadSettings() {
    const settings = FSS.Model.getSettings();
    const meta = FSS.Model.getMeta();
    
    document.getElementById('setting-horizon').value = settings.forecastHorizonDays || 180;
    document.getElementById('setting-currency').value = meta.currency || 'USD';
    document.getElementById('setting-buffer').value = settings.safeSurplus?.buffer || 300;
    document.getElementById('setting-floor').value = settings.safeSurplus?.floor || 2000;
    document.getElementById('setting-weekends').checked = settings.businessDays?.weekendsAreNonBusinessDays !== false;
  }

  // === Event Handlers ===

  function handleSave() {
    const validation = FSS.Model.validate();
    
    if (!validation.valid) {
      showValidationAlert(validation, true);
      return;
    }
    
    if (FSS.Model.save()) {
      FSS.App.showToast('Model saved successfully', 'success');
      checkUnsavedChanges();
      hideValidationAlert();
    } else {
      FSS.App.showToast('Failed to save model', 'error');
    }
  }

  function handleValidate() {
    const validation = FSS.Model.validate();
    showValidationAlert(validation, false);
  }

  async function handleDiscard() {
    if (!FSS.Model.hasUnsavedChanges()) {
      FSS.App.showToast('No changes to discard', 'info');
      return;
    }
    
    const confirmed = await FSS.App.confirm(
      'Are you sure you want to discard all unsaved changes?',
      'Discard Changes'
    );
    
    if (confirmed) {
      FSS.Model.discard();
      renderAll();
      updateCounts();
      loadSettings();
      checkUnsavedChanges();
      FSS.App.showToast('Changes discarded', 'info');
    }
  }

  function handleExport() {
    const json = FSS.Storage.exportBaseModelJSON();
    if (json) {
      const filename = `fss-model-${DateTime.now().toFormat('yyyy-MM-dd')}.json`;
      FSS.App.downloadFile(json, filename);
      FSS.App.showToast('Model exported', 'success');
    }
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const content = await FSS.App.readFile(file);
      const result = FSS.Storage.importJSON(content);
      
      if (result.success) {
        model = FSS.Model.load();
        renderAll();
        updateCounts();
        loadSettings();
        checkUnsavedChanges();
        FSS.App.showToast(result.message, 'success');
      } else {
        FSS.App.showToast(result.message, 'error');
      }
    } catch (err) {
      FSS.App.showToast('Failed to read file', 'error');
    }
    
    e.target.value = '';
  }

  function handleSettingsChange() {
    const settings = {
      forecastHorizonDays: parseInt(document.getElementById('setting-horizon').value, 10) || 180,
      safeSurplus: {
        mode: 'next_month_trough',
        buffer: parseInt(document.getElementById('setting-buffer').value, 10) || 300,
        floor: parseInt(document.getElementById('setting-floor').value, 10) || 2000
      },
      businessDays: {
        weekendsAreNonBusinessDays: document.getElementById('setting-weekends').checked
      }
    };
    
    FSS.Model.updateSettings(settings);
    
    // Update currency in meta
    const model = FSS.Model.get();
    model.meta.currency = document.getElementById('setting-currency').value;
    FSS.Model.markDirty();
    
    checkUnsavedChanges();
  }

  // === Validation Alert ===

  function showValidationAlert(validation, isError = false) {
    const alert = document.getElementById('validation-alert');
    alert.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-warning');
    
    if (validation.valid && validation.warnings.length === 0) {
      alert.classList.add('alert-success');
      alert.innerHTML = '<i class="bi bi-check-circle me-2"></i>Model is valid!';
    } else if (validation.valid && validation.warnings.length > 0) {
      alert.classList.add('alert-warning');
      const warningList = validation.warnings.map(w => `<li>${w.message}</li>`).join('');
      alert.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i><strong>Valid with warnings:</strong><ul class="mb-0 mt-2">${warningList}</ul>`;
    } else {
      alert.classList.add('alert-danger');
      const errorList = validation.errors.map(e => `<li>${e.path ? `[${e.path}] ` : ''}${e.message}</li>`).join('');
      alert.innerHTML = `<i class="bi bi-x-circle me-2"></i><strong>Validation errors:</strong><ul class="mb-0 mt-2">${errorList}</ul>`;
    }
  }

  function hideValidationAlert() {
    document.getElementById('validation-alert').classList.add('d-none');
  }

  // === Render Functions ===

  function renderAccounts() {
    const container = document.getElementById('accounts-list');
    const accounts = FSS.Model.getAccounts();
    
    if (accounts.length === 0) {
      container.innerHTML = '<div class="empty-state py-3"><p class="mb-0 text-muted">No accounts</p></div>';
      return;
    }
    
    container.innerHTML = accounts.map(acc => `
      <div class="item-list">
        <div class="item">
          <div class="item-name">
            <span class="badge ${acc.type === 'checking' ? 'bg-primary' : 'bg-secondary'} me-2">${acc.type}</span>
            ${acc.name}
          </div>
          <div class="item-meta">${acc.includeInSurplus ? 'Included in surplus' : 'Excluded'}</div>
          <div class="item-actions">
            <button class="btn btn-sm btn-outline-secondary" onclick="FSS.UI.Builder.showAccountModal('${acc.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Builder.deleteAccount('${acc.id}')" 
              ${acc.type === 'checking' && accounts.filter(a => a.type === 'checking').length === 1 ? 'disabled' : ''}>
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderBalances() {
    const container = document.getElementById('balances-list');
    const balances = FSS.Model.getStartingBalances();
    
    if (balances.length === 0) {
      container.innerHTML = '<div class="empty-state py-3"><p class="mb-0 text-muted">No starting balances</p></div>';
      return;
    }
    
    container.innerHTML = balances.map(bal => {
      const account = FSS.Model.getAccount(bal.accountId);
      return `
        <div class="item-list">
          <div class="item">
            <div class="item-name">${account?.name || bal.accountId}</div>
            <div class="item-meta">${FSS.App.formatDate(bal.date)}</div>
            <div class="mono ${bal.amount >= 0 ? 'text-income' : 'text-expense'}">${FSS.App.formatCurrency(bal.amount)}</div>
            <div class="item-actions">
              <button class="btn btn-sm btn-outline-secondary" onclick="FSS.UI.Builder.showBalanceModal('${bal.accountId}', '${bal.date}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Builder.deleteBalance('${bal.accountId}', '${bal.date}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRules(kind) {
    const containerId = kind === 'income' ? 'income-list' : kind === 'expense' ? 'expense-list' : 'transfer-list';
    const container = document.getElementById(containerId);
    const rules = FSS.Model.getRules(kind);
    
    if (rules.length === 0) {
      container.innerHTML = `<div class="empty-state py-3"><p class="mb-0 text-muted">No ${kind} rules</p></div>`;
      return;
    }
    
    const colorClass = kind === 'income' ? 'text-income' : kind === 'expense' ? 'text-expense' : 'text-transfer';
    
    container.innerHTML = rules.map(rule => {
      const recDesc = rule.followsRuleId 
        ? `Follows: ${FSS.Model.getRule(rule.followsRuleId)?.name || rule.followsRuleId}`
        : FSS.Recurrence.describeRecurrence(rule.recurrence);
      
      return `
        <div class="item-list">
          <div class="item ${!rule.enabled ? 'opacity-50' : ''}">
            <div class="item-name">
              ${!rule.enabled ? '<i class="bi bi-pause-circle text-muted me-2"></i>' : ''}
              ${rule.name}
              ${rule.category ? `<span class="badge bg-secondary ms-2">${rule.category}</span>` : ''}
            </div>
            <div class="item-meta">${recDesc}</div>
            <div class="mono ${colorClass}">${FSS.App.formatCurrency(rule.amount)}</div>
            <div class="item-actions">
              <button class="btn btn-sm btn-outline-secondary" onclick="FSS.UI.Builder.showRuleModal('${kind}', '${rule.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Builder.deleteRule('${rule.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderOneOffs() {
    const container = document.getElementById('oneoff-list');
    const oneOffs = FSS.Model.getOneOffs();
    
    if (oneOffs.length === 0) {
      container.innerHTML = '<div class="empty-state py-3"><p class="mb-0 text-muted">No one-off transactions</p></div>';
      return;
    }
    
    container.innerHTML = oneOffs.map(oneOff => {
      const colorClass = oneOff.amount >= 0 ? 'text-income' : 'text-expense';
      return `
        <div class="item-list">
          <div class="item">
            <div class="item-name">${oneOff.name}</div>
            <div class="item-meta">${FSS.App.formatDate(oneOff.date)}</div>
            <div class="mono ${colorClass}">${FSS.App.formatCurrency(oneOff.amount)}</div>
            <div class="item-actions">
              <button class="btn btn-sm btn-outline-secondary" onclick="FSS.UI.Builder.showOneOffModal('${oneOff.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Builder.deleteOneOff('${oneOff.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDebts() {
    const container = document.getElementById('debt-list');
    const debts = FSS.Model.getDebts();
    
    if (debts.length === 0) {
      container.innerHTML = '<div class="empty-state py-3"><p class="mb-0 text-muted">No debts</p></div>';
      return;
    }
    
    container.innerHTML = debts.map(debt => `
      <div class="item-list">
        <div class="item">
          <div class="item-name">${debt.name}</div>
          <div class="item-meta">${debt.apr}% APR</div>
          <div class="mono text-expense">${FSS.App.formatCurrency(debt.principal)}</div>
          <div class="item-actions">
            <button class="btn btn-sm btn-outline-secondary" onclick="FSS.UI.Builder.showDebtModal('${debt.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="FSS.UI.Builder.deleteDebt('${debt.id}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // === Modal Functions ===

  function createModal(id, title, bodyHTML, onSave) {
    // Remove existing modal if any
    document.getElementById(id)?.remove();
    
    const modalHTML = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="${id}-save">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById(id);
    const bsModal = new bootstrap.Modal(modal);
    
    document.getElementById(`${id}-save`).addEventListener('click', () => {
      if (onSave()) {
        bsModal.hide();
        renderAll();
        updateCounts();
        checkUnsavedChanges();
      }
    });
    
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    
    bsModal.show();
    return bsModal;
  }

  function showAccountModal(accountId = null) {
    const account = accountId ? FSS.Model.getAccount(accountId) : null;
    const isNew = !account;
    
    const bodyHTML = `
      <div class="mb-3">
        <label class="form-label">Account Name</label>
        <input type="text" class="form-control" id="modal-acc-name" value="${account?.name || ''}" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Account Type</label>
        <select class="form-select" id="modal-acc-type">
          <option value="checking" ${account?.type === 'checking' ? 'selected' : ''}>Checking</option>
          <option value="savings" ${account?.type === 'savings' ? 'selected' : ''}>Savings</option>
          <option value="reserve" ${account?.type === 'reserve' ? 'selected' : ''}>Reserve</option>
        </select>
      </div>
      <div class="mb-3">
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="modal-acc-surplus" ${account?.includeInSurplus !== false ? 'checked' : ''}>
          <label class="form-check-label" for="modal-acc-surplus">Include in surplus calculations</label>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Note (optional)</label>
        <input type="text" class="form-control" id="modal-acc-note" value="${account?.note || ''}">
      </div>
    `;
    
    createModal('account-modal', isNew ? 'Add Account' : 'Edit Account', bodyHTML, () => {
      const name = document.getElementById('modal-acc-name').value.trim();
      if (!name) {
        FSS.App.showToast('Account name is required', 'error');
        return false;
      }
      
      const data = {
        name,
        type: document.getElementById('modal-acc-type').value,
        includeInSurplus: document.getElementById('modal-acc-surplus').checked,
        note: document.getElementById('modal-acc-note').value.trim()
      };
      
      if (isNew) {
        FSS.Model.addAccount(data);
        FSS.App.showToast('Account added', 'success');
      } else {
        FSS.Model.updateAccount(accountId, data);
        FSS.App.showToast('Account updated', 'success');
      }
      
      return true;
    });
  }

  function showBalanceModal(accountId = null, date = null) {
    const balance = accountId && date ? 
      FSS.Model.getStartingBalances().find(b => b.accountId === accountId && b.date === date) : null;
    const isNew = !balance;
    
    const accountOptions = FSS.Model.getAccountOptions()
      .map(a => `<option value="${a.value}" ${balance?.accountId === a.value ? 'selected' : ''}>${a.label}</option>`)
      .join('');
    
    const bodyHTML = `
      <div class="mb-3">
        <label class="form-label">Account</label>
        <select class="form-select" id="modal-bal-account" ${!isNew ? 'disabled' : ''}>
          ${accountOptions}
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label">Date</label>
        <input type="date" class="form-control" id="modal-bal-date" value="${balance?.date || DateTime.now().toISODate()}" ${!isNew ? 'disabled' : ''}>
      </div>
      <div class="mb-3">
        <label class="form-label">Balance Amount</label>
        <div class="input-group">
          <span class="input-group-text">$</span>
          <input type="number" step="0.01" class="form-control" id="modal-bal-amount" value="${balance?.amount || 0}">
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Note (optional)</label>
        <input type="text" class="form-control" id="modal-bal-note" value="${balance?.note || ''}">
      </div>
    `;
    
    createModal('balance-modal', isNew ? 'Add Starting Balance' : 'Edit Starting Balance', bodyHTML, () => {
      const data = {
        accountId: document.getElementById('modal-bal-account').value,
        date: document.getElementById('modal-bal-date').value,
        amount: parseFloat(document.getElementById('modal-bal-amount').value) || 0,
        note: document.getElementById('modal-bal-note').value.trim()
      };
      
      if (isNew) {
        FSS.Model.addStartingBalance(data);
        FSS.App.showToast('Starting balance added', 'success');
      } else {
        FSS.Model.updateStartingBalance(accountId, date, { amount: data.amount, note: data.note });
        FSS.App.showToast('Starting balance updated', 'success');
      }
      
      return true;
    });
  }

  function showRuleModal(kind, ruleId = null) {
    const rule = ruleId ? FSS.Model.getRule(ruleId) : null;
    const isNew = !rule;
    
    const accountOptions = FSS.Model.getAccountOptions()
      .map(a => `<option value="${a.value}" ${rule?.accountId === a.value ? 'selected' : ''}>${a.label}</option>`)
      .join('');
    
    const ruleOptions = FSS.Model.getRules()
      .filter(r => r.id !== ruleId)
      .map(r => `<option value="${r.id}" ${rule?.followsRuleId === r.id ? 'selected' : ''}>${r.name}</option>`)
      .join('');
    
    const recType = rule?.recurrence?.type || 'monthly_day';
    const useFollows = !!rule?.followsRuleId;
    
    const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
    
    const bodyHTML = `
      <div class="mb-3">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" id="modal-rule-name" value="${rule?.name || ''}" required>
      </div>
      <div class="row mb-3">
        <div class="col-6">
          <label class="form-label">Amount</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" step="0.01" class="form-control" id="modal-rule-amount" value="${rule?.amount || 0}">
          </div>
        </div>
        <div class="col-6">
          <label class="form-label">Account</label>
          <select class="form-select" id="modal-rule-account">${accountOptions}</select>
        </div>
      </div>
      ${kind === 'transfer' ? `
      <div class="mb-3">
        <label class="form-label">Transfer To</label>
        <select class="form-select" id="modal-rule-to-account">${accountOptions}</select>
      </div>
      ` : ''}
      <div class="mb-3">
        <label class="form-label">Category</label>
        <input type="text" class="form-control" id="modal-rule-category" value="${rule?.category || ''}" placeholder="e.g., paycheck, rent, utilities">
      </div>
      <div class="mb-3">
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="modal-rule-enabled" ${rule?.enabled !== false ? 'checked' : ''}>
          <label class="form-check-label" for="modal-rule-enabled">Enabled</label>
        </div>
      </div>
      <hr>
      <div class="mb-3">
        <label class="form-label">Recurrence</label>
        <div class="form-check mb-2">
          <input type="radio" class="form-check-input" name="rec-mode" id="rec-mode-own" ${!useFollows ? 'checked' : ''}>
          <label class="form-check-label" for="rec-mode-own">Own schedule</label>
        </div>
        <div class="form-check mb-2">
          <input type="radio" class="form-check-input" name="rec-mode" id="rec-mode-follows" ${useFollows ? 'checked' : ''}>
          <label class="form-check-label" for="rec-mode-follows">Follow another rule</label>
        </div>
      </div>
      <div id="own-schedule-fields" ${useFollows ? 'style="display:none"' : ''}>
        <div class="mb-3">
          <select class="form-select" id="modal-rule-rec-type">
            <option value="monthly_day" ${recType === 'monthly_day' ? 'selected' : ''}>Monthly on day</option>
            <option value="semimonthly_days" ${recType === 'semimonthly_days' ? 'selected' : ''}>Semi-monthly</option>
            <option value="biweekly_anchor" ${recType === 'biweekly_anchor' ? 'selected' : ''}>Biweekly</option>
            <option value="weekly_dow" ${recType === 'weekly_dow' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <div id="rec-params"></div>
      </div>
      <div id="follows-fields" ${!useFollows ? 'style="display:none"' : ''}>
        <div class="mb-3">
          <label class="form-label">Follow Rule</label>
          <select class="form-select" id="modal-rule-follows">
            <option value="">Select a rule...</option>
            ${ruleOptions}
          </select>
        </div>
      </div>
      <hr>
      <div class="mb-3">
        <label class="form-label">Business Day Adjustment</label>
        <select class="form-select" id="modal-rule-bda">
          <option value="none" ${rule?.businessDayAdjustment === 'none' ? 'selected' : ''}>None</option>
          <option value="next_business_day" ${rule?.businessDayAdjustment === 'next_business_day' ? 'selected' : ''}>Next business day</option>
          <option value="prev_business_day" ${rule?.businessDayAdjustment === 'prev_business_day' ? 'selected' : ''}>Previous business day</option>
        </select>
      </div>
    `;
    
    const bsModal = createModal('rule-modal', isNew ? `Add ${kindLabel} Rule` : `Edit ${kindLabel} Rule`, bodyHTML, () => {
      const name = document.getElementById('modal-rule-name').value.trim();
      if (!name) {
        FSS.App.showToast('Rule name is required', 'error');
        return false;
      }
      
      const usesFollows = document.getElementById('rec-mode-follows').checked;
      
      const data = {
        name,
        kind,
        amount: parseFloat(document.getElementById('modal-rule-amount').value) || 0,
        accountId: document.getElementById('modal-rule-account').value,
        category: document.getElementById('modal-rule-category').value.trim(),
        enabled: document.getElementById('modal-rule-enabled').checked,
        businessDayAdjustment: document.getElementById('modal-rule-bda').value
      };
      
      if (kind === 'transfer') {
        data.toAccountId = document.getElementById('modal-rule-to-account')?.value;
      }
      
      if (usesFollows) {
        data.followsRuleId = document.getElementById('modal-rule-follows').value;
        if (!data.followsRuleId) {
          FSS.App.showToast('Please select a rule to follow', 'error');
          return false;
        }
      } else {
        const recType = document.getElementById('modal-rule-rec-type').value;
        data.recurrence = getRecurrenceFromForm(recType);
      }
      
      if (isNew) {
        FSS.Model.addRule(data);
        FSS.App.showToast('Rule added', 'success');
      } else {
        FSS.Model.updateRule(ruleId, data);
        FSS.App.showToast('Rule updated', 'success');
      }
      
      return true;
    });
    
    // Setup recurrence mode toggle
    document.getElementById('rec-mode-own').addEventListener('change', () => {
      document.getElementById('own-schedule-fields').style.display = '';
      document.getElementById('follows-fields').style.display = 'none';
    });
    document.getElementById('rec-mode-follows').addEventListener('change', () => {
      document.getElementById('own-schedule-fields').style.display = 'none';
      document.getElementById('follows-fields').style.display = '';
    });
    
    // Setup recurrence type change
    document.getElementById('modal-rule-rec-type').addEventListener('change', (e) => {
      updateRecurrenceParams(e.target.value, rule?.recurrence);
    });
    
    // Initial recurrence params
    updateRecurrenceParams(recType, rule?.recurrence);
  }

  function updateRecurrenceParams(type, currentRec = null) {
    const container = document.getElementById('rec-params');
    
    switch (type) {
      case 'monthly_day':
        container.innerHTML = `
          <label class="form-label">Day of month</label>
          <input type="number" class="form-control" id="rec-day" min="1" max="31" value="${currentRec?.day || 1}">
        `;
        break;
      case 'semimonthly_days':
        container.innerHTML = `
          <div class="row">
            <div class="col-6">
              <label class="form-label">First day</label>
              <input type="number" class="form-control" id="rec-day1" min="1" max="31" value="${currentRec?.day1 || 1}">
            </div>
            <div class="col-6">
              <label class="form-label">Second day</label>
              <input type="number" class="form-control" id="rec-day2" min="1" max="31" value="${currentRec?.day2 || 15}">
            </div>
          </div>
        `;
        break;
      case 'biweekly_anchor':
        container.innerHTML = `
          <label class="form-label">Anchor date</label>
          <input type="date" class="form-control" id="rec-anchor" value="${currentRec?.anchorDate || DateTime.now().toISODate()}">
          <div class="form-text">Every 2 weeks from this date</div>
        `;
        break;
      case 'weekly_dow':
        container.innerHTML = `
          <label class="form-label">Day of week</label>
          <select class="form-select" id="rec-dow">
            <option value="0" ${currentRec?.dayOfWeek === 0 ? 'selected' : ''}>Monday</option>
            <option value="1" ${currentRec?.dayOfWeek === 1 ? 'selected' : ''}>Tuesday</option>
            <option value="2" ${currentRec?.dayOfWeek === 2 ? 'selected' : ''}>Wednesday</option>
            <option value="3" ${currentRec?.dayOfWeek === 3 ? 'selected' : ''}>Thursday</option>
            <option value="4" ${currentRec?.dayOfWeek === 4 ? 'selected' : ''}>Friday</option>
            <option value="5" ${currentRec?.dayOfWeek === 5 ? 'selected' : ''}>Saturday</option>
            <option value="6" ${currentRec?.dayOfWeek === 6 ? 'selected' : ''}>Sunday</option>
          </select>
        `;
        break;
    }
  }

  function getRecurrenceFromForm(type) {
    switch (type) {
      case 'monthly_day':
        return { type, day: parseInt(document.getElementById('rec-day').value, 10) || 1 };
      case 'semimonthly_days':
        return { 
          type, 
          day1: parseInt(document.getElementById('rec-day1').value, 10) || 1,
          day2: parseInt(document.getElementById('rec-day2').value, 10) || 15
        };
      case 'biweekly_anchor':
        return { type, anchorDate: document.getElementById('rec-anchor').value };
      case 'weekly_dow':
        return { type, dayOfWeek: parseInt(document.getElementById('rec-dow').value, 10) || 0 };
      default:
        return { type: 'monthly_day', day: 1 };
    }
  }

  function showOneOffModal(oneOffId = null) {
    const oneOff = oneOffId ? FSS.Model.getOneOff(oneOffId) : null;
    const isNew = !oneOff;
    
    const accountOptions = FSS.Model.getAccountOptions()
      .map(a => `<option value="${a.value}" ${oneOff?.accountId === a.value ? 'selected' : ''}>${a.label}</option>`)
      .join('');
    
    const bodyHTML = `
      <div class="mb-3">
        <label class="form-label">Description</label>
        <input type="text" class="form-control" id="modal-oneoff-name" value="${oneOff?.name || ''}" required>
      </div>
      <div class="row mb-3">
        <div class="col-6">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="modal-oneoff-date" value="${oneOff?.date || DateTime.now().toISODate()}">
        </div>
        <div class="col-6">
          <label class="form-label">Amount</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" step="0.01" class="form-control" id="modal-oneoff-amount" value="${oneOff?.amount || 0}">
          </div>
          <div class="form-text">Positive = income, Negative = expense</div>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Account</label>
        <select class="form-select" id="modal-oneoff-account">${accountOptions}</select>
      </div>
      <div class="mb-3">
        <label class="form-label">Category</label>
        <input type="text" class="form-control" id="modal-oneoff-category" value="${oneOff?.category || ''}">
      </div>
      <div class="mb-3">
        <label class="form-label">Note (optional)</label>
        <input type="text" class="form-control" id="modal-oneoff-note" value="${oneOff?.note || ''}">
      </div>
    `;
    
    createModal('oneoff-modal', isNew ? 'Add One-Off Transaction' : 'Edit One-Off Transaction', bodyHTML, () => {
      const name = document.getElementById('modal-oneoff-name').value.trim();
      if (!name) {
        FSS.App.showToast('Description is required', 'error');
        return false;
      }
      
      const data = {
        name,
        date: document.getElementById('modal-oneoff-date').value,
        amount: parseFloat(document.getElementById('modal-oneoff-amount').value) || 0,
        accountId: document.getElementById('modal-oneoff-account').value,
        category: document.getElementById('modal-oneoff-category').value.trim(),
        note: document.getElementById('modal-oneoff-note').value.trim()
      };
      
      if (isNew) {
        FSS.Model.addOneOff(data);
        FSS.App.showToast('One-off transaction added', 'success');
      } else {
        FSS.Model.updateOneOff(oneOffId, data);
        FSS.App.showToast('One-off transaction updated', 'success');
      }
      
      return true;
    });
  }

  function showDebtModal(debtId = null) {
    const debt = debtId ? FSS.Model.getDebt(debtId) : null;
    const isNew = !debt;
    
    const ruleOptions = FSS.Model.getExpenseRules()
      .map(r => `<option value="${r.id}" ${debt?.minPaymentRuleId === r.id ? 'selected' : ''}>${r.name}</option>`)
      .join('');
    
    const bodyHTML = `
      <div class="mb-3">
        <label class="form-label">Debt Name</label>
        <input type="text" class="form-control" id="modal-debt-name" value="${debt?.name || ''}" required>
      </div>
      <div class="row mb-3">
        <div class="col-6">
          <label class="form-label">Principal Balance</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input type="number" step="0.01" class="form-control" id="modal-debt-principal" value="${debt?.principal || 0}">
          </div>
        </div>
        <div class="col-6">
          <label class="form-label">APR (%)</label>
          <div class="input-group">
            <input type="number" step="0.1" class="form-control" id="modal-debt-apr" value="${debt?.apr || 0}">
            <span class="input-group-text">%</span>
          </div>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Minimum Payment Rule</label>
        <select class="form-select" id="modal-debt-min-rule">
          <option value="">None (manual tracking)</option>
          ${ruleOptions}
        </select>
        <div class="form-text">Link to an existing expense rule for minimum payment</div>
      </div>
      <div class="mb-3">
        <label class="form-label">Extra Monthly Payment</label>
        <div class="input-group">
          <span class="input-group-text">$</span>
          <input type="number" step="0.01" class="form-control" id="modal-debt-extra" value="${debt?.extraMonthlyPayment || 0}">
        </div>
      </div>
    `;
    
    createModal('debt-modal', isNew ? 'Add Debt' : 'Edit Debt', bodyHTML, () => {
      const name = document.getElementById('modal-debt-name').value.trim();
      if (!name) {
        FSS.App.showToast('Debt name is required', 'error');
        return false;
      }
      
      const data = {
        name,
        principal: parseFloat(document.getElementById('modal-debt-principal').value) || 0,
        apr: parseFloat(document.getElementById('modal-debt-apr').value) || 0,
        minPaymentRuleId: document.getElementById('modal-debt-min-rule').value || '',
        extraMonthlyPayment: parseFloat(document.getElementById('modal-debt-extra').value) || 0
      };
      
      if (isNew) {
        FSS.Model.addDebt(data);
        FSS.App.showToast('Debt added', 'success');
      } else {
        FSS.Model.updateDebt(debtId, data);
        FSS.App.showToast('Debt updated', 'success');
      }
      
      return true;
    });
  }

  // === Delete Functions ===

  async function deleteAccount(accountId) {
    const account = FSS.Model.getAccount(accountId);
    const confirmed = await FSS.App.confirm(
      `Are you sure you want to delete "${account?.name}"?`,
      'Delete Account'
    );
    
    if (confirmed) {
      if (FSS.Model.deleteAccount(accountId)) {
        renderAll();
        updateCounts();
        checkUnsavedChanges();
        FSS.App.showToast('Account deleted', 'success');
      } else {
        FSS.App.showToast('Cannot delete the only checking account', 'error');
      }
    }
  }

  async function deleteBalance(accountId, date) {
    const confirmed = await FSS.App.confirm(
      'Are you sure you want to delete this starting balance?',
      'Delete Starting Balance'
    );
    
    if (confirmed) {
      FSS.Model.deleteStartingBalance(accountId, date);
      renderAll();
      updateCounts();
      checkUnsavedChanges();
      FSS.App.showToast('Starting balance deleted', 'success');
    }
  }

  async function deleteRule(ruleId) {
    const rule = FSS.Model.getRule(ruleId);
    const confirmed = await FSS.App.confirm(
      `Are you sure you want to delete "${rule?.name}"?`,
      'Delete Rule'
    );
    
    if (confirmed) {
      FSS.Model.deleteRule(ruleId);
      renderAll();
      updateCounts();
      checkUnsavedChanges();
      FSS.App.showToast('Rule deleted', 'success');
    }
  }

  async function deleteOneOff(oneOffId) {
    const oneOff = FSS.Model.getOneOff(oneOffId);
    const confirmed = await FSS.App.confirm(
      `Are you sure you want to delete "${oneOff?.name}"?`,
      'Delete One-Off'
    );
    
    if (confirmed) {
      FSS.Model.deleteOneOff(oneOffId);
      renderAll();
      updateCounts();
      checkUnsavedChanges();
      FSS.App.showToast('One-off deleted', 'success');
    }
  }

  async function deleteDebt(debtId) {
    const debt = FSS.Model.getDebt(debtId);
    const confirmed = await FSS.App.confirm(
      `Are you sure you want to delete "${debt?.name}"?`,
      'Delete Debt'
    );
    
    if (confirmed) {
      FSS.Model.deleteDebt(debtId);
      renderAll();
      updateCounts();
      checkUnsavedChanges();
      FSS.App.showToast('Debt deleted', 'success');
    }
  }

  // Public API
  return {
    init,
    showAccountModal,
    showBalanceModal,
    showRuleModal,
    showOneOffModal,
    showDebtModal,
    deleteAccount,
    deleteBalance,
    deleteRule,
    deleteOneOff,
    deleteDebt
  };
})();

window.FSS = FSS;


