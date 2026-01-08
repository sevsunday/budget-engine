/**
 * Finance Scenario Simulator - Overlay Module
 * Scenario operations processor for what-if exploration
 */

const FSS = window.FSS || {};

FSS.Overlay = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Supported scenario operations
   */
  const OPS = {
    RULE_AMOUNT_SET: 'rule_amount_set',
    RULE_AMOUNT_DELTA: 'rule_amount_delta',
    RULE_DISABLE: 'rule_disable',
    RULE_RECURRENCE_SET: 'rule_recurrence_set',
    ADD_ONEOFF: 'add_oneoff',
    REMOVE_ONEOFF: 'remove_oneoff',
    SETTINGS_SET: 'settings_set'
  };

  /**
   * Create a new empty scenario
   */
  function createScenario(name = '') {
    return {
      meta: {
        name: name,
        createdAt: DateTime.now().toISO()
      },
      ops: []
    };
  }

  /**
   * Add an operation to a scenario
   */
  function addOperation(scenario, op) {
    if (!scenario.ops) {
      scenario.ops = [];
    }
    
    // For certain ops, replace existing rather than duplicate
    const replaceOps = [OPS.RULE_AMOUNT_SET, OPS.RULE_AMOUNT_DELTA, OPS.RULE_DISABLE];
    
    if (replaceOps.includes(op.op) && op.ruleId) {
      // Remove existing op for same rule
      scenario.ops = scenario.ops.filter(o => 
        !(o.op === op.op && o.ruleId === op.ruleId)
      );
    }
    
    scenario.ops.push(op);
    return scenario;
  }

  /**
   * Remove an operation from a scenario
   */
  function removeOperation(scenario, index) {
    if (scenario.ops && index >= 0 && index < scenario.ops.length) {
      scenario.ops.splice(index, 1);
    }
    return scenario;
  }

  /**
   * Apply a scenario to a base model, returning an effective model
   * Does NOT modify the original model
   */
  function applyScenario(baseModel, scenario) {
    if (!scenario || !scenario.ops || scenario.ops.length === 0) {
      return FSS.Schema.cloneModel(baseModel);
    }

    // Deep clone the base model
    const effectiveModel = FSS.Schema.cloneModel(baseModel);

    // Apply each operation
    for (const op of scenario.ops) {
      applyOperation(effectiveModel, op);
    }

    return effectiveModel;
  }

  /**
   * Apply a single operation to a model (mutates the model)
   */
  function applyOperation(model, op) {
    switch (op.op) {
      case OPS.RULE_AMOUNT_SET:
        applyRuleAmountSet(model, op);
        break;
      case OPS.RULE_AMOUNT_DELTA:
        applyRuleAmountDelta(model, op);
        break;
      case OPS.RULE_DISABLE:
        applyRuleDisable(model, op);
        break;
      case OPS.RULE_RECURRENCE_SET:
        applyRuleRecurrenceSet(model, op);
        break;
      case OPS.ADD_ONEOFF:
        applyAddOneOff(model, op);
        break;
      case OPS.REMOVE_ONEOFF:
        applyRemoveOneOff(model, op);
        break;
      case OPS.SETTINGS_SET:
        applySettingsSet(model, op);
        break;
    }
  }

  /**
   * Set rule amount to specific value
   */
  function applyRuleAmountSet(model, op) {
    const rule = model.rules?.find(r => r.id === op.ruleId);
    if (rule && typeof op.amount === 'number') {
      rule.amount = op.amount;
    }
  }

  /**
   * Adjust rule amount by delta
   */
  function applyRuleAmountDelta(model, op) {
    const rule = model.rules?.find(r => r.id === op.ruleId);
    if (rule && typeof op.delta === 'number') {
      rule.amount = (rule.amount || 0) + op.delta;
    }
  }

  /**
   * Enable or disable a rule
   */
  function applyRuleDisable(model, op) {
    const rule = model.rules?.find(r => r.id === op.ruleId);
    if (rule) {
      rule.enabled = !op.disabled;
    }
  }

  /**
   * Change rule recurrence
   */
  function applyRuleRecurrenceSet(model, op) {
    const rule = model.rules?.find(r => r.id === op.ruleId);
    if (rule && op.recurrence) {
      rule.recurrence = op.recurrence;
      // Clear followsRuleId if setting own recurrence
      delete rule.followsRuleId;
    }
  }

  /**
   * Add a one-off transaction
   */
  function applyAddOneOff(model, op) {
    if (!model.oneOffs) {
      model.oneOffs = [];
    }
    
    const oneOff = {
      id: op.oneOffId || FSS.Schema.generateId('scenario_oneoff'),
      date: op.date,
      name: op.name || 'Scenario One-Off',
      accountId: op.accountId || 'checking',
      amount: op.amount || 0,
      category: op.category || 'scenario',
      tags: ['scenario'],
      note: op.note || ''
    };
    
    model.oneOffs.push(oneOff);
  }

  /**
   * Remove a one-off transaction
   */
  function applyRemoveOneOff(model, op) {
    if (model.oneOffs && op.oneOffId) {
      model.oneOffs = model.oneOffs.filter(o => o.id !== op.oneOffId);
    }
  }

  /**
   * Update settings
   */
  function applySettingsSet(model, op) {
    if (op.path && op.value !== undefined) {
      const keys = op.path.split('.');
      const lastKey = keys.pop();
      let target = model.settings;
      
      for (const key of keys) {
        if (!target[key]) target[key] = {};
        target = target[key];
      }
      
      target[lastKey] = op.value;
    }
  }

  /**
   * Create operation builders
   */
  const createOp = {
    ruleAmountSet: (ruleId, amount) => ({
      op: OPS.RULE_AMOUNT_SET,
      ruleId,
      amount
    }),
    
    ruleAmountDelta: (ruleId, delta) => ({
      op: OPS.RULE_AMOUNT_DELTA,
      ruleId,
      delta
    }),
    
    ruleDisable: (ruleId, disabled = true) => ({
      op: OPS.RULE_DISABLE,
      ruleId,
      disabled
    }),
    
    ruleRecurrenceSet: (ruleId, recurrence) => ({
      op: OPS.RULE_RECURRENCE_SET,
      ruleId,
      recurrence
    }),
    
    addOneOff: (date, name, amount, accountId = 'checking', category = 'scenario') => ({
      op: OPS.ADD_ONEOFF,
      oneOffId: FSS.Schema.generateId('scenario_oneoff'),
      date,
      name,
      amount,
      accountId,
      category
    }),
    
    removeOneOff: (oneOffId) => ({
      op: OPS.REMOVE_ONEOFF,
      oneOffId
    }),
    
    settingsSet: (path, value) => ({
      op: OPS.SETTINGS_SET,
      path,
      value
    })
  };

  /**
   * Get human-readable description of an operation
   */
  function describeOperation(op, model) {
    const rule = model?.rules?.find(r => r.id === op.ruleId);
    const ruleName = rule?.name || op.ruleId || 'Unknown';

    switch (op.op) {
      case OPS.RULE_AMOUNT_SET:
        return `Set "${ruleName}" to ${FSS.App.formatCurrency(op.amount)}`;
      case OPS.RULE_AMOUNT_DELTA:
        const sign = op.delta >= 0 ? '+' : '';
        return `Adjust "${ruleName}" by ${sign}${FSS.App.formatCurrency(op.delta)}`;
      case OPS.RULE_DISABLE:
        return op.disabled ? `Disable "${ruleName}"` : `Enable "${ruleName}"`;
      case OPS.RULE_RECURRENCE_SET:
        return `Change schedule of "${ruleName}"`;
      case OPS.ADD_ONEOFF:
        return `Add one-off: ${op.name} (${FSS.App.formatCurrency(op.amount)}) on ${op.date}`;
      case OPS.REMOVE_ONEOFF:
        return `Remove one-off: ${op.oneOffId}`;
      case OPS.SETTINGS_SET:
        return `Change setting: ${op.path}`;
      default:
        return `Unknown operation: ${op.op}`;
    }
  }

  /**
   * Compare two models and return differences
   */
  function compareModels(baseModel, scenarioModel) {
    const baseLedger = FSS.Ledger.runLedger(baseModel);
    const scenarioLedger = FSS.Ledger.runLedger(scenarioModel);

    return {
      base: {
        endBalance: baseLedger.summary.endBalance,
        minBalance: baseLedger.summary.minBalance,
        totalIncome: baseLedger.summary.totalIncome,
        totalExpenses: baseLedger.summary.totalExpenses,
        netSurplus: baseLedger.summary.netSurplus
      },
      scenario: {
        endBalance: scenarioLedger.summary.endBalance,
        minBalance: scenarioLedger.summary.minBalance,
        totalIncome: scenarioLedger.summary.totalIncome,
        totalExpenses: scenarioLedger.summary.totalExpenses,
        netSurplus: scenarioLedger.summary.netSurplus
      },
      difference: {
        endBalance: scenarioLedger.summary.endBalance - baseLedger.summary.endBalance,
        minBalance: scenarioLedger.summary.minBalance - baseLedger.summary.minBalance,
        totalIncome: scenarioLedger.summary.totalIncome - baseLedger.summary.totalIncome,
        totalExpenses: scenarioLedger.summary.totalExpenses - baseLedger.summary.totalExpenses,
        netSurplus: scenarioLedger.summary.netSurplus - baseLedger.summary.netSurplus
      }
    };
  }

  /**
   * Commit scenario changes to base model
   */
  function commitToBase(baseModel, scenario) {
    const effectiveModel = applyScenario(baseModel, scenario);
    FSS.Schema.touchModel(effectiveModel);
    return effectiveModel;
  }

  // Public API
  return {
    OPS,
    createScenario,
    addOperation,
    removeOperation,
    applyScenario,
    applyOperation,
    createOp,
    describeOperation,
    compareModels,
    commitToBase
  };
})();

window.FSS = FSS;


