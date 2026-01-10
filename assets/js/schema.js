/**
 * Finance Scenario Simulator - Schema Module
 * JSON schema definition, validation, and default factory functions
 */

var FSS = window.FSS || {};

FSS.Schema = (function() {
  'use strict';

  const SCHEMA_VERSION = 1;
  const DEFAULT_CURRENCY = 'USD';
  const DEFAULT_TIMEZONE = 'America/Chicago';
  const DEFAULT_FORECAST_HORIZON_DAYS = 180;

  /**
   * Create a new empty base model with defaults
   */
  function createEmptyModel() {
    const now = luxon.DateTime.now().toISO();
    return {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        currency: DEFAULT_CURRENCY,
        timezone: DEFAULT_TIMEZONE
      },
      accounts: [
        {
          id: 'checking',
          name: 'Checking',
          type: 'checking',
          includeInSurplus: true,
          note: ''
        }
      ],
      startingBalances: [],
      rules: [],
      oneOffs: [],
      debts: [],
      settings: {
        forecastHorizonDays: DEFAULT_FORECAST_HORIZON_DAYS,
        safeSurplus: {
          mode: 'next_month_trough',
          buffer: 300,
          floor: 2000
        },
        businessDays: {
          weekendsAreNonBusinessDays: true
        },
        display: {
          dateFormat: 'MMM d, yyyy',
          showRuleIds: false
        }
      }
    };
  }

  /**
   * Create a new empty scenario draft
   */
  function createEmptyScenario() {
    return {
      meta: {
        name: '',
        createdAt: luxon.DateTime.now().toISO()
      },
      ops: []
    };
  }

  /**
   * Generate a unique ID
   */
  function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new account object
   */
  function createAccount(data = {}) {
    return {
      id: data.id || generateId('acc'),
      name: data.name || 'New Account',
      type: data.type || 'checking',
      includeInSurplus: data.includeInSurplus !== false,
      note: data.note || ''
    };
  }

  /**
   * Create a new starting balance object
   */
  function createStartingBalance(data = {}) {
    return {
      accountId: data.accountId || 'checking',
      date: data.date || luxon.DateTime.now().toISODate(),
      amount: typeof data.amount === 'number' ? data.amount : 0,
      note: data.note || ''
    };
  }

  /**
   * Create a new rule object
   */
  function createRule(data = {}) {
    const rule = {
      id: data.id || generateId('rule'),
      name: data.name || 'New Rule',
      accountId: data.accountId || 'checking',
      kind: data.kind || 'expense',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      category: data.category || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      enabled: data.enabled !== false,
      priority: typeof data.priority === 'number' ? data.priority : 100,
      businessDayAdjustment: data.businessDayAdjustment || 'none'
    };

    // Add recurrence if provided
    if (data.recurrence) {
      rule.recurrence = { ...data.recurrence };
    } else if (data.followsRuleId) {
      rule.followsRuleId = data.followsRuleId;
    } else {
      // Default recurrence
      rule.recurrence = {
        type: 'monthly_day',
        day: 1
      };
    }

    // Optional validity dates
    if (data.validFrom) rule.validFrom = data.validFrom;
    if (data.validTo) rule.validTo = data.validTo;

    // Transfer-specific fields
    if (data.kind === 'transfer' && data.toAccountId) {
      rule.toAccountId = data.toAccountId;
    }

    return rule;
  }

  /**
   * Create a new one-off object
   */
  function createOneOff(data = {}) {
    return {
      id: data.id || generateId('oneoff'),
      date: data.date || luxon.DateTime.now().toISODate(),
      name: data.name || 'One-time Transaction',
      accountId: data.accountId || 'checking',
      amount: typeof data.amount === 'number' ? data.amount : 0,
      category: data.category || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      note: data.note || ''
    };
  }

  /**
   * Create a new debt object
   */
  function createDebt(data = {}) {
    return {
      id: data.id || generateId('debt'),
      name: data.name || 'New Debt',
      apr: typeof data.apr === 'number' ? data.apr : 0,
      principal: typeof data.principal === 'number' ? data.principal : 0,
      minPaymentRuleId: data.minPaymentRuleId || '',
      extraMonthlyPayment: typeof data.extraMonthlyPayment === 'number' ? data.extraMonthlyPayment : 0,
      lumpSums: Array.isArray(data.lumpSums) ? data.lumpSums : []
    };
  }

  /**
   * Validate a base model and return validation results
   */
  function validateModel(model) {
    const errors = [];
    const warnings = [];

    if (!model) {
      errors.push({ path: '', message: 'Model is null or undefined' });
      return { valid: false, errors, warnings };
    }

    // Meta validation
    if (!model.meta) {
      errors.push({ path: 'meta', message: 'Meta object is required' });
    } else {
      if (model.meta.schemaVersion !== SCHEMA_VERSION) {
        errors.push({ path: 'meta.schemaVersion', message: `Schema version must be ${SCHEMA_VERSION}` });
      }
    }

    // Accounts validation
    if (!Array.isArray(model.accounts)) {
      errors.push({ path: 'accounts', message: 'Accounts must be an array' });
    } else {
      const hasChecking = model.accounts.some(a => a.type === 'checking');
      if (!hasChecking) {
        errors.push({ path: 'accounts', message: 'At least one checking account is required' });
      }

      const accountIds = new Set();
      model.accounts.forEach((acc, i) => {
        if (!acc.id) {
          errors.push({ path: `accounts[${i}].id`, message: 'Account ID is required' });
        } else if (accountIds.has(acc.id)) {
          errors.push({ path: `accounts[${i}].id`, message: `Duplicate account ID: ${acc.id}` });
        } else {
          accountIds.add(acc.id);
        }

        if (!acc.name) {
          warnings.push({ path: `accounts[${i}].name`, message: 'Account name is empty' });
        }

        if (!['checking', 'reserve', 'savings'].includes(acc.type)) {
          errors.push({ path: `accounts[${i}].type`, message: `Invalid account type: ${acc.type}` });
        }
      });

      // Validate references
      if (Array.isArray(model.startingBalances)) {
        model.startingBalances.forEach((sb, i) => {
          if (!accountIds.has(sb.accountId)) {
            errors.push({ path: `startingBalances[${i}].accountId`, message: `Referenced account not found: ${sb.accountId}` });
          }
          if (typeof sb.amount !== 'number' || isNaN(sb.amount)) {
            errors.push({ path: `startingBalances[${i}].amount`, message: 'Amount must be a valid number' });
          }
        });
      }
    }

    // Rules validation
    if (!Array.isArray(model.rules)) {
      errors.push({ path: 'rules', message: 'Rules must be an array' });
    } else {
      const ruleIds = new Set();
      model.rules.forEach((rule, i) => {
        if (!rule.id) {
          errors.push({ path: `rules[${i}].id`, message: 'Rule ID is required' });
        } else if (ruleIds.has(rule.id)) {
          errors.push({ path: `rules[${i}].id`, message: `Duplicate rule ID: ${rule.id}` });
        } else {
          ruleIds.add(rule.id);
        }

        if (!['income', 'expense', 'transfer'].includes(rule.kind)) {
          errors.push({ path: `rules[${i}].kind`, message: `Invalid rule kind: ${rule.kind}` });
        }

        if (typeof rule.amount !== 'number' || isNaN(rule.amount)) {
          errors.push({ path: `rules[${i}].amount`, message: 'Amount must be a valid number' });
        }

        // Validate recurrence or followsRuleId
        if (!rule.recurrence && !rule.followsRuleId) {
          errors.push({ path: `rules[${i}]`, message: 'Rule must have either recurrence or followsRuleId' });
        }

        if (rule.recurrence) {
          const validTypes = ['monthly_day', 'semimonthly_days', 'biweekly_anchor', 'weekly_dow'];
          if (!validTypes.includes(rule.recurrence.type)) {
            errors.push({ path: `rules[${i}].recurrence.type`, message: `Invalid recurrence type: ${rule.recurrence.type}` });
          }

          // Validate day-of-month overflow
          if (rule.recurrence.type === 'monthly_day' && rule.recurrence.day > 28) {
            warnings.push({ path: `rules[${i}].recurrence.day`, message: `Day ${rule.recurrence.day} may shift to end of month in short months` });
          }
        }
      });

      // Validate followsRuleId references
      model.rules.forEach((rule, i) => {
        if (rule.followsRuleId && !ruleIds.has(rule.followsRuleId)) {
          errors.push({ path: `rules[${i}].followsRuleId`, message: `Referenced rule not found: ${rule.followsRuleId}` });
        }
      });
    }

    // One-offs validation
    if (model.oneOffs && !Array.isArray(model.oneOffs)) {
      errors.push({ path: 'oneOffs', message: 'OneOffs must be an array' });
    } else if (model.oneOffs) {
      model.oneOffs.forEach((oneOff, i) => {
        if (typeof oneOff.amount !== 'number' || isNaN(oneOff.amount)) {
          errors.push({ path: `oneOffs[${i}].amount`, message: 'Amount must be a valid number' });
        }
      });
    }

    // Debts validation
    if (model.debts && !Array.isArray(model.debts)) {
      errors.push({ path: 'debts', message: 'Debts must be an array' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a scenario draft
   */
  function validateScenario(scenario) {
    const errors = [];
    const warnings = [];

    if (!scenario) {
      errors.push({ path: '', message: 'Scenario is null or undefined' });
      return { valid: false, errors, warnings };
    }

    if (!scenario.meta) {
      errors.push({ path: 'meta', message: 'Meta object is required' });
    }

    if (!Array.isArray(scenario.ops)) {
      errors.push({ path: 'ops', message: 'Operations must be an array' });
    } else {
      const validOps = [
        'rule_amount_set', 'rule_amount_delta', 'rule_disable',
        'rule_recurrence_set', 'add_oneoff', 'remove_oneoff', 'settings_set'
      ];

      scenario.ops.forEach((op, i) => {
        if (!validOps.includes(op.op)) {
          errors.push({ path: `ops[${i}].op`, message: `Invalid operation type: ${op.op}` });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Deep clone a model
   */
  function cloneModel(model) {
    return JSON.parse(JSON.stringify(model));
  }

  /**
   * Update model's updatedAt timestamp
   */
  function touchModel(model) {
    if (model && model.meta) {
      model.meta.updatedAt = luxon.DateTime.now().toISO();
    }
    return model;
  }

  // Public API
  return {
    SCHEMA_VERSION,
    DEFAULT_CURRENCY,
    DEFAULT_TIMEZONE,
    DEFAULT_FORECAST_HORIZON_DAYS,
    createEmptyModel,
    createEmptyScenario,
    generateId,
    createAccount,
    createStartingBalance,
    createRule,
    createOneOff,
    createDebt,
    validateModel,
    validateScenario,
    cloneModel,
    touchModel
  };
})();

window.FSS = FSS;


