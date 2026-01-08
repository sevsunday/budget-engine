/**
 * Finance Scenario Simulator - Ledger Module
 * Transaction generation pipeline and ledger runner
 */

const FSS = window.FSS || {};

FSS.Ledger = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Generate all transactions for a model within a date range
   * @param {Object} model - The financial model
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Array} Sorted array of transactions
   */
  function generateTransactions(model, startDate, endDate) {
    const transactions = [];
    const settings = model.settings || {};

    // 1. Expand all enabled rules into transactions
    const enabledRules = (model.rules || []).filter(r => r.enabled !== false);
    
    for (const rule of enabledRules) {
      const occurrences = FSS.Recurrence.expandRule(rule, startDate, endDate, model);
      transactions.push(...occurrences);
    }

    // 2. Apply business day adjustments
    const adjustedTransactions = transactions.map(t => 
      FSS.BusinessDay.adjustTransaction(t, settings)
    );

    // 3. Add one-off transactions within range
    const oneOffs = (model.oneOffs || []).filter(o => 
      o.date >= startDate && o.date <= endDate
    ).map(o => ({
      date: o.date,
      ruleId: null,
      oneOffId: o.id,
      name: o.name,
      accountId: o.accountId,
      kind: o.amount >= 0 ? 'income' : 'expense',
      amount: o.amount,
      category: o.category || 'one-off',
      tags: o.tags || [],
      priority: 50, // One-offs have higher priority (lower number)
      isOneOff: true
    }));
    
    adjustedTransactions.push(...oneOffs);

    // 4. Sort by date, then priority, then kind order
    const kindOrder = { income: 0, transfer: 1, expense: 2 };
    
    adjustedTransactions.sort((a, b) => {
      // Primary: date
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      // Secondary: priority (lower first)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Tertiary: kind order
      return (kindOrder[a.kind] || 0) - (kindOrder[b.kind] || 0);
    });

    return adjustedTransactions;
  }

  /**
   * Run the ledger and compute running balances
   * @param {Object} model - The financial model
   * @param {Object} options - Options { startDate, endDate, accountId }
   * @returns {Object} Ledger results
   */
  function runLedger(model, options = {}) {
    const settings = model.settings || {};
    const horizonDays = settings.forecastHorizonDays || 180;
    
    const today = DateTime.now().toISODate();
    const startDate = options.startDate || today;
    const endDate = options.endDate || DateTime.fromISO(today).plus({ days: horizonDays }).toISODate();
    const accountId = options.accountId || getDefaultAccountId(model);

    // Get starting balance
    const startingBalance = getStartingBalanceForAccount(model, accountId, startDate);
    
    // Generate transactions
    const transactions = generateTransactions(model, startDate, endDate);
    
    // Filter to account if specified
    const accountTransactions = accountId 
      ? transactions.filter(t => t.accountId === accountId || t.toAccountId === accountId)
      : transactions;

    // Run ledger
    let balance = startingBalance;
    let minBalance = balance;
    let maxBalance = balance;
    let minBalanceDate = startDate;
    let maxBalanceDate = startDate;
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTransfersIn = 0;
    let totalTransfersOut = 0;

    const entries = [];
    let prevDate = startDate;

    // Add starting balance entry
    entries.push({
      date: startDate,
      name: 'Starting Balance',
      amount: startingBalance,
      balance: startingBalance,
      kind: 'balance',
      category: 'starting',
      isStartingBalance: true
    });

    for (const tx of accountTransactions) {
      let amount = tx.amount;
      
      // Handle transfers (negative from source, positive to destination)
      if (tx.kind === 'transfer') {
        if (tx.accountId === accountId) {
          // Outgoing transfer
          amount = -Math.abs(amount);
          totalTransfersOut += Math.abs(amount);
        } else if (tx.toAccountId === accountId) {
          // Incoming transfer
          amount = Math.abs(amount);
          totalTransfersIn += Math.abs(amount);
        }
      } else if (tx.kind === 'expense') {
        amount = -Math.abs(amount);
        totalExpenses += Math.abs(amount);
      } else if (tx.kind === 'income') {
        amount = Math.abs(amount);
        totalIncome += Math.abs(amount);
      }

      balance += amount;

      // Track min/max
      if (balance < minBalance) {
        minBalance = balance;
        minBalanceDate = tx.date;
      }
      if (balance > maxBalance) {
        maxBalance = balance;
        maxBalanceDate = tx.date;
      }

      entries.push({
        ...tx,
        amount: amount,
        balance: balance,
        daysSinceLast: daysBetween(prevDate, tx.date)
      });

      prevDate = tx.date;
    }

    return {
      accountId,
      startDate,
      endDate,
      startingBalance,
      entries,
      summary: {
        endBalance: balance,
        minBalance,
        maxBalance,
        minBalanceDate,
        maxBalanceDate,
        totalIncome,
        totalExpenses,
        totalTransfersIn,
        totalTransfersOut,
        netSurplus: totalIncome - totalExpenses,
        transactionCount: entries.length - 1 // Exclude starting balance
      }
    };
  }

  /**
   * Get the starting balance for an account at a given date
   */
  function getStartingBalanceForAccount(model, accountId, date) {
    const balances = (model.startingBalances || [])
      .filter(b => b.accountId === accountId && b.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date));
    
    return balances.length > 0 ? balances[0].amount : 0;
  }

  /**
   * Get the default account ID (first checking account)
   */
  function getDefaultAccountId(model) {
    const checking = (model.accounts || []).find(a => a.type === 'checking');
    return checking ? checking.id : (model.accounts?.[0]?.id || 'checking');
  }

  /**
   * Calculate days between two dates
   */
  function daysBetween(date1, date2) {
    const d1 = DateTime.fromISO(date1);
    const d2 = DateTime.fromISO(date2);
    return Math.round(d2.diff(d1, 'days').days);
  }

  /**
   * Get entries grouped by month
   */
  function groupByMonth(entries) {
    const groups = {};
    
    for (const entry of entries) {
      const monthKey = entry.date.substring(0, 7); // YYYY-MM
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(entry);
    }
    
    return groups;
  }

  /**
   * Get entries grouped by category
   */
  function groupByCategory(entries) {
    const groups = {};
    
    for (const entry of entries) {
      const category = entry.category || 'uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(entry);
    }
    
    return groups;
  }

  /**
   * Filter entries by criteria
   */
  function filterEntries(entries, filters = {}) {
    let filtered = [...entries];
    
    if (filters.month) {
      filtered = filtered.filter(e => e.date.startsWith(filters.month));
    }
    
    if (filters.category) {
      filtered = filtered.filter(e => e.category === filters.category);
    }
    
    if (filters.kind) {
      filtered = filtered.filter(e => e.kind === filters.kind);
    }
    
    if (filters.accountId) {
      filtered = filtered.filter(e => e.accountId === filters.accountId || e.toAccountId === filters.accountId);
    }
    
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter(e => Math.abs(e.amount) >= filters.minAmount);
    }
    
    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter(e => Math.abs(e.amount) <= filters.maxAmount);
    }
    
    return filtered;
  }

  /**
   * Get unique categories from entries
   */
  function getUniqueCategories(entries) {
    const categories = new Set();
    entries.forEach(e => {
      if (e.category) categories.add(e.category);
    });
    return Array.from(categories).sort();
  }

  /**
   * Get unique months from entries
   */
  function getUniqueMonths(entries) {
    const months = new Set();
    entries.forEach(e => {
      if (e.date) months.add(e.date.substring(0, 7));
    });
    return Array.from(months).sort();
  }

  /**
   * Export ledger entries to CSV
   */
  function exportToCSV(entries, options = {}) {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Balance', 'Type', 'Source'];
    const rows = [headers.join(',')];
    
    for (const entry of entries) {
      if (entry.isStartingBalance && !options.includeStartingBalance) continue;
      
      const row = [
        entry.date,
        `"${(entry.name || '').replace(/"/g, '""')}"`,
        `"${(entry.category || '').replace(/"/g, '""')}"`,
        entry.amount.toFixed(2),
        entry.balance.toFixed(2),
        entry.kind || '',
        entry.ruleId || entry.oneOffId || ''
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  // Public API
  return {
    generateTransactions,
    runLedger,
    getStartingBalanceForAccount,
    getDefaultAccountId,
    groupByMonth,
    groupByCategory,
    filterEntries,
    getUniqueCategories,
    getUniqueMonths,
    exportToCSV
  };
})();

window.FSS = FSS;


