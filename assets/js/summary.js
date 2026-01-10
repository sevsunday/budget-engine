/**
 * Finance Scenario Simulator - Summary Module
 * Monthly summaries and safe surplus calculations
 */

var FSS = window.FSS || {};

FSS.Summary = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Calculate monthly summaries from ledger results
   * @param {Object} ledgerResult - Result from FSS.Ledger.runLedger()
   * @returns {Array} Monthly summaries
   */
  function calculateMonthlySummaries(ledgerResult) {
    const { entries, startingBalance } = ledgerResult;
    const byMonth = FSS.Ledger.groupByMonth(entries);
    const months = Object.keys(byMonth).sort();
    
    const summaries = [];
    let prevEndBalance = startingBalance;

    for (const month of months) {
      const monthEntries = byMonth[month];
      const monthStart = DateTime.fromISO(month + '-01');
      
      let income = 0;
      let expenses = 0;
      let transfersIn = 0;
      let transfersOut = 0;
      let minBalance = Infinity;
      let maxBalance = -Infinity;
      let minBalanceDate = null;
      let maxBalanceDate = null;
      let endBalance = prevEndBalance;

      for (const entry of monthEntries) {
        if (entry.isStartingBalance) continue;
        
        if (entry.kind === 'income') {
          income += entry.amount;
        } else if (entry.kind === 'expense') {
          expenses += Math.abs(entry.amount);
        } else if (entry.kind === 'transfer') {
          if (entry.amount > 0) {
            transfersIn += entry.amount;
          } else {
            transfersOut += Math.abs(entry.amount);
          }
        }

        endBalance = entry.balance;

        if (entry.balance < minBalance) {
          minBalance = entry.balance;
          minBalanceDate = entry.date;
        }
        if (entry.balance > maxBalance) {
          maxBalance = entry.balance;
          maxBalanceDate = entry.date;
        }
      }

      // Handle case where no transactions in month
      if (minBalance === Infinity) {
        minBalance = prevEndBalance;
        maxBalance = prevEndBalance;
      }

      summaries.push({
        month,
        monthName: monthStart.toFormat('MMMM yyyy'),
        startBalance: prevEndBalance,
        endBalance,
        income,
        expenses,
        transfersIn,
        transfersOut,
        netSurplus: income - expenses,
        minBalance,
        maxBalance,
        minBalanceDate,
        maxBalanceDate,
        transactionCount: monthEntries.filter(e => !e.isStartingBalance).length
      });

      prevEndBalance = endBalance;
    }

    return summaries;
  }

  /**
   * Calculate safe surplus for a given month
   * Uses next-month-trough + buffer algorithm
   * @param {Array} summaries - Monthly summaries
   * @param {number} monthIndex - Index of target month
   * @param {Object} settings - Safe surplus settings
   * @returns {Object} Safe surplus calculation
   */
  function calculateSafeSurplus(summaries, monthIndex, settings = {}) {
    const mode = settings.mode || 'next_month_trough';
    const buffer = settings.buffer || 300;
    const floor = settings.floor || 2000;

    const currentMonth = summaries[monthIndex];
    if (!currentMonth) {
      return { safeWithdrawable: 0, message: 'No data' };
    }

    const endBalance = currentMonth.endBalance;

    if (mode === 'floor') {
      // Simple floor mode
      const safeWithdrawable = Math.max(0, endBalance - floor);
      return {
        safeWithdrawable,
        endBalance,
        floor,
        mode: 'floor',
        message: safeWithdrawable > 0 
          ? `Safe to withdraw (above $${floor.toLocaleString()} floor)`
          : `Below floor of $${floor.toLocaleString()}`
      };
    }

    // Default: next_month_trough mode
    const nextMonth = summaries[monthIndex + 1];
    
    if (!nextMonth) {
      // No next month data, fall back to floor
      const safeWithdrawable = Math.max(0, endBalance - floor - buffer);
      return {
        safeWithdrawable,
        endBalance,
        floor,
        buffer,
        mode: 'next_month_trough',
        message: 'No next month data, using floor',
        isEstimate: true
      };
    }

    const nextMonthTrough = nextMonth.minBalance;
    const required = nextMonthTrough + buffer;
    const safeWithdrawable = endBalance - required;

    if (safeWithdrawable >= 0) {
      return {
        safeWithdrawable,
        endBalance,
        nextMonthTrough,
        buffer,
        required,
        mode: 'next_month_trough',
        message: `Safe to withdraw (covers next month trough + $${buffer} buffer)`,
        nextMonthTroughDate: nextMonth.minBalanceDate
      };
    } else {
      return {
        safeWithdrawable: 0,
        unsafeBy: Math.abs(safeWithdrawable),
        endBalance,
        nextMonthTrough,
        buffer,
        required,
        mode: 'next_month_trough',
        message: `Unsafe by $${Math.abs(safeWithdrawable).toLocaleString()}`,
        isUnsafe: true,
        nextMonthTroughDate: nextMonth.minBalanceDate
      };
    }
  }

  /**
   * Get summary for a specific month
   * @param {Object} model - The financial model
   * @param {string} month - Month in YYYY-MM format
   * @returns {Object} Month summary with safe surplus
   */
  function getMonthSummary(model, month) {
    const settings = model.settings || {};
    const horizonDays = settings.forecastHorizonDays || 180;
    
    const startDate = month + '-01';
    const endDate = DateTime.fromISO(startDate)
      .plus({ months: 3 })
      .endOf('month')
      .toISODate();

    const ledger = FSS.Ledger.runLedger(model, { startDate, endDate });
    const summaries = calculateMonthlySummaries(ledger);
    
    const monthIndex = summaries.findIndex(s => s.month === month);
    const monthSummary = summaries[monthIndex];
    
    if (!monthSummary) {
      return null;
    }

    const safeSurplus = calculateSafeSurplus(
      summaries, 
      monthIndex, 
      settings.safeSurplus
    );

    return {
      ...monthSummary,
      safeSurplus
    };
  }

  /**
   * Get dashboard data for display
   * @param {Object} model - The financial model
   * @param {string} month - Target month (YYYY-MM)
   * @returns {Object} Dashboard data
   */
  function getDashboardData(model, month = null) {
    const settings = model.settings || {};
    const horizonDays = settings.forecastHorizonDays || 180;
    
    // Default to current month
    if (!month) {
      month = DateTime.now().toFormat('yyyy-MM');
    }

    const startDate = DateTime.now().toISODate();
    const endDate = DateTime.now().plus({ days: horizonDays }).toISODate();

    const ledger = FSS.Ledger.runLedger(model, { startDate, endDate });
    const summaries = calculateMonthlySummaries(ledger);
    
    const monthIndex = summaries.findIndex(s => s.month === month);
    const currentMonthSummary = summaries[monthIndex] || summaries[0];
    
    const safeSurplus = monthIndex >= 0 
      ? calculateSafeSurplus(summaries, monthIndex, settings.safeSurplus)
      : { safeWithdrawable: 0, message: 'Select a month' };

    // Get available months for selector
    const availableMonths = summaries.map(s => ({
      value: s.month,
      label: s.monthName
    }));

    // Prepare chart data
    const balanceChartData = prepareBalanceChartData(ledger.entries);
    const monthlyNetChartData = prepareMonthlyNetChartData(summaries);

    return {
      month,
      summary: currentMonthSummary,
      safeSurplus,
      availableMonths,
      ledger,
      summaries,
      charts: {
        balance: balanceChartData,
        monthlyNet: monthlyNetChartData
      }
    };
  }

  /**
   * Prepare data for balance over time chart
   */
  function prepareBalanceChartData(entries) {
    // Sample data points (max ~60 for readability)
    const maxPoints = 60;
    const step = Math.max(1, Math.floor(entries.length / maxPoints));
    
    const labels = [];
    const data = [];
    
    for (let i = 0; i < entries.length; i += step) {
      const entry = entries[i];
      labels.push(entry.date);
      data.push(entry.balance);
    }
    
    // Always include last entry
    if (entries.length > 0 && labels[labels.length - 1] !== entries[entries.length - 1].date) {
      labels.push(entries[entries.length - 1].date);
      data.push(entries[entries.length - 1].balance);
    }

    return { labels, data };
  }

  /**
   * Prepare data for monthly net surplus chart
   */
  function prepareMonthlyNetChartData(summaries) {
    const labels = summaries.map(s => DateTime.fromISO(s.month + '-01').toFormat('MMM'));
    const income = summaries.map(s => s.income);
    const expenses = summaries.map(s => s.expenses);
    const net = summaries.map(s => s.netSurplus);

    return {
      labels,
      datasets: {
        income,
        expenses,
        net
      }
    };
  }

  /**
   * Get income breakdown by category
   */
  function getIncomeBreakdown(ledgerResult) {
    const incomeEntries = ledgerResult.entries.filter(e => e.kind === 'income');
    const byCategory = {};
    
    for (const entry of incomeEntries) {
      const cat = entry.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + entry.amount;
    }
    
    return Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get expense breakdown by category
   */
  function getExpenseBreakdown(ledgerResult) {
    const expenseEntries = ledgerResult.entries.filter(e => e.kind === 'expense');
    const byCategory = {};
    
    for (const entry of expenseEntries) {
      const cat = entry.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(entry.amount);
    }
    
    return Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  // Public API
  return {
    calculateMonthlySummaries,
    calculateSafeSurplus,
    getMonthSummary,
    getDashboardData,
    prepareBalanceChartData,
    prepareMonthlyNetChartData,
    getIncomeBreakdown,
    getExpenseBreakdown
  };
})();

window.FSS = FSS;


