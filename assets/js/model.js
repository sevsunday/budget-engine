/**
 * Finance Scenario Simulator - Model Module
 * Base model CRUD operations for accounts, rules, one-offs, debts
 */

var FSS = window.FSS || {};

FSS.Model = (function() {
  'use strict';

  // Working copy of the model (in-memory)
  let workingModel = null;
  let isDirty = false;

  /**
   * Load model into memory
   */
  function load() {
    workingModel = FSS.Storage.loadBaseModel();
    if (!workingModel) {
      workingModel = FSS.Schema.createEmptyModel();
    }
    isDirty = false;
    return workingModel;
  }

  /**
   * Get the current working model
   */
  function get() {
    if (!workingModel) {
      load();
    }
    return workingModel;
  }

  /**
   * Save the working model to storage
   */
  function save() {
    if (!workingModel) return false;
    FSS.Schema.touchModel(workingModel);
    const result = FSS.Storage.saveBaseModel(workingModel);
    if (result) {
      isDirty = false;
    }
    return result;
  }

  /**
   * Discard changes and reload from storage
   */
  function discard() {
    return load();
  }

  /**
   * Check if model has unsaved changes
   */
  function hasUnsavedChanges() {
    return isDirty;
  }

  /**
   * Mark model as dirty
   */
  function markDirty() {
    isDirty = true;
  }

  // === Account Operations ===

  function getAccounts() {
    return get().accounts || [];
  }

  function getAccount(id) {
    return getAccounts().find(a => a.id === id);
  }

  function addAccount(data) {
    const account = FSS.Schema.createAccount(data);
    get().accounts.push(account);
    markDirty();
    return account;
  }

  function updateAccount(id, updates) {
    const account = getAccount(id);
    if (!account) return null;
    Object.assign(account, updates);
    markDirty();
    return account;
  }

  function deleteAccount(id) {
    const model = get();
    const index = model.accounts.findIndex(a => a.id === id);
    if (index === -1) return false;
    
    // Don't delete if it's the only checking account
    const isChecking = model.accounts[index].type === 'checking';
    if (isChecking) {
      const checkingCount = model.accounts.filter(a => a.type === 'checking').length;
      if (checkingCount <= 1) return false;
    }
    
    model.accounts.splice(index, 1);
    markDirty();
    return true;
  }

  function getAccountOptions() {
    return getAccounts().map(a => ({
      value: a.id,
      label: a.name,
      type: a.type
    }));
  }

  // === Starting Balance Operations ===

  function getStartingBalances() {
    return get().startingBalances || [];
  }

  function getStartingBalance(accountId, date = null) {
    const balances = getStartingBalances()
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date));
    
    if (date) {
      return balances.find(b => b.date <= date) || null;
    }
    return balances[0] || null;
  }

  function addStartingBalance(data) {
    const balance = FSS.Schema.createStartingBalance(data);
    get().startingBalances.push(balance);
    markDirty();
    return balance;
  }

  function updateStartingBalance(accountId, date, updates) {
    const balances = get().startingBalances;
    const index = balances.findIndex(b => b.accountId === accountId && b.date === date);
    if (index === -1) return null;
    Object.assign(balances[index], updates);
    markDirty();
    return balances[index];
  }

  function deleteStartingBalance(accountId, date) {
    const model = get();
    const index = model.startingBalances.findIndex(b => b.accountId === accountId && b.date === date);
    if (index === -1) return false;
    model.startingBalances.splice(index, 1);
    markDirty();
    return true;
  }

  // === Rule Operations ===

  function getRules(kind = null) {
    const rules = get().rules || [];
    if (kind) {
      return rules.filter(r => r.kind === kind);
    }
    return rules;
  }

  function getRule(id) {
    return getRules().find(r => r.id === id);
  }

  function addRule(data) {
    const rule = FSS.Schema.createRule(data);
    get().rules.push(rule);
    markDirty();
    return rule;
  }

  function updateRule(id, updates) {
    const rule = getRule(id);
    if (!rule) return null;
    Object.assign(rule, updates);
    markDirty();
    return rule;
  }

  function deleteRule(id) {
    const model = get();
    const index = model.rules.findIndex(r => r.id === id);
    if (index === -1) return false;
    model.rules.splice(index, 1);
    markDirty();
    return true;
  }

  function getIncomeRules() {
    return getRules('income');
  }

  function getExpenseRules() {
    return getRules('expense');
  }

  function getTransferRules() {
    return getRules('transfer');
  }

  function getEnabledRules() {
    return getRules().filter(r => r.enabled !== false);
  }

  function getRuleOptions(kind = null) {
    return getRules(kind).map(r => ({
      value: r.id,
      label: r.name,
      kind: r.kind,
      amount: r.amount
    }));
  }

  // === One-Off Operations ===

  function getOneOffs() {
    return get().oneOffs || [];
  }

  function getOneOff(id) {
    return getOneOffs().find(o => o.id === id);
  }

  function addOneOff(data) {
    const oneOff = FSS.Schema.createOneOff(data);
    get().oneOffs.push(oneOff);
    markDirty();
    return oneOff;
  }

  function updateOneOff(id, updates) {
    const oneOff = getOneOff(id);
    if (!oneOff) return null;
    Object.assign(oneOff, updates);
    markDirty();
    return oneOff;
  }

  function deleteOneOff(id) {
    const model = get();
    const index = model.oneOffs.findIndex(o => o.id === id);
    if (index === -1) return false;
    model.oneOffs.splice(index, 1);
    markDirty();
    return true;
  }

  // === Debt Operations ===

  function getDebts() {
    return get().debts || [];
  }

  function getDebt(id) {
    return getDebts().find(d => d.id === id);
  }

  function addDebt(data) {
    const debt = FSS.Schema.createDebt(data);
    get().debts.push(debt);
    markDirty();
    return debt;
  }

  function updateDebt(id, updates) {
    const debt = getDebt(id);
    if (!debt) return null;
    Object.assign(debt, updates);
    markDirty();
    return debt;
  }

  function deleteDebt(id) {
    const model = get();
    const index = model.debts.findIndex(d => d.id === id);
    if (index === -1) return false;
    model.debts.splice(index, 1);
    markDirty();
    return true;
  }

  // === Settings Operations ===

  function getSettings() {
    return get().settings || {};
  }

  function updateSettings(updates) {
    const model = get();
    model.settings = { ...model.settings, ...updates };
    markDirty();
    return model.settings;
  }

  function getSetting(path) {
    const settings = getSettings();
    return path.split('.').reduce((obj, key) => obj?.[key], settings);
  }

  function setSetting(path, value) {
    const settings = getSettings();
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = settings;
    
    for (const key of keys) {
      if (!target[key]) target[key] = {};
      target = target[key];
    }
    
    target[lastKey] = value;
    markDirty();
    return settings;
  }

  // === Meta Operations ===

  function getMeta() {
    return get().meta || {};
  }

  function getCurrency() {
    return getMeta().currency || 'USD';
  }

  function getTimezone() {
    return getMeta().timezone || 'America/Chicago';
  }

  // === Validation ===

  function validate() {
    return FSS.Schema.validateModel(get());
  }

  // === Utility ===

  function clone() {
    return FSS.Schema.cloneModel(get());
  }

  function replace(newModel) {
    workingModel = newModel;
    markDirty();
    return workingModel;
  }

  // Public API
  return {
    load,
    get,
    save,
    discard,
    hasUnsavedChanges,
    markDirty,

    // Accounts
    getAccounts,
    getAccount,
    addAccount,
    updateAccount,
    deleteAccount,
    getAccountOptions,

    // Starting Balances
    getStartingBalances,
    getStartingBalance,
    addStartingBalance,
    updateStartingBalance,
    deleteStartingBalance,

    // Rules
    getRules,
    getRule,
    addRule,
    updateRule,
    deleteRule,
    getIncomeRules,
    getExpenseRules,
    getTransferRules,
    getEnabledRules,
    getRuleOptions,

    // One-Offs
    getOneOffs,
    getOneOff,
    addOneOff,
    updateOneOff,
    deleteOneOff,

    // Debts
    getDebts,
    getDebt,
    addDebt,
    updateDebt,
    deleteDebt,

    // Settings
    getSettings,
    updateSettings,
    getSetting,
    setSetting,

    // Meta
    getMeta,
    getCurrency,
    getTimezone,

    // Utility
    validate,
    clone,
    replace
  };
})();

window.FSS = FSS;


