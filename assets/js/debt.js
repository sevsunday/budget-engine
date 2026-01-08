/**
 * Finance Scenario Simulator - Debt Module
 * APR calculations and payoff timeline projections
 */

const FSS = window.FSS || {};

FSS.Debt = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Calculate monthly interest rate from APR
   * @param {number} apr - Annual Percentage Rate (e.g., 16.5 for 16.5%)
   * @returns {number} Monthly rate as decimal
   */
  function getMonthlyRate(apr) {
    return (apr / 100) / 12;
  }

  /**
   * Calculate daily interest rate from APR
   * @param {number} apr - Annual Percentage Rate
   * @returns {number} Daily rate as decimal
   */
  function getDailyRate(apr) {
    return (apr / 100) / 365;
  }

  /**
   * Calculate interest accrued for a period
   * @param {number} principal - Current principal balance
   * @param {number} apr - Annual Percentage Rate
   * @param {number} days - Number of days
   * @returns {number} Interest amount
   */
  function calculateInterest(principal, apr, days) {
    const dailyRate = getDailyRate(apr);
    return principal * dailyRate * days;
  }

  /**
   * Calculate minimum payment for a debt
   * Based on common credit card formula: greater of (interest + 1% principal) or $25
   * @param {number} principal - Current balance
   * @param {number} apr - Annual Percentage Rate
   * @returns {number} Minimum payment
   */
  function calculateMinPayment(principal, apr) {
    if (principal <= 0) return 0;
    
    const monthlyInterest = principal * getMonthlyRate(apr);
    const principalPortion = principal * 0.01;
    const calculated = monthlyInterest + principalPortion;
    
    // Minimum of $25 or remaining balance
    return Math.min(principal, Math.max(25, calculated));
  }

  /**
   * Project debt payoff timeline
   * @param {Object} debt - Debt object with principal, apr, etc.
   * @param {Object} options - Options like extra payments
   * @returns {Object} Payoff projection
   */
  function projectPayoff(debt, options = {}) {
    const {
      startDate = DateTime.now().toISODate(),
      maxMonths = 360, // 30 years max
      extraMonthly = debt.extraMonthlyPayment || 0,
      lumpSums = debt.lumpSums || []
    } = options;

    // Get minimum payment from linked rule or calculate
    let minPayment = 0;
    if (debt.minPaymentRuleId) {
      const rule = FSS.Model?.getRule(debt.minPaymentRuleId);
      minPayment = rule?.amount || 0;
    }
    if (!minPayment) {
      minPayment = calculateMinPayment(debt.principal, debt.apr);
    }

    const totalMonthlyPayment = minPayment + extraMonthly;
    
    if (totalMonthlyPayment <= 0) {
      return {
        isPaidOff: false,
        message: 'No payments configured',
        schedule: []
      };
    }

    const schedule = [];
    let balance = debt.principal;
    let currentDate = DateTime.fromISO(startDate);
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;

    // Sort lump sums by date
    const sortedLumpSums = [...lumpSums].sort((a, b) => a.date.localeCompare(b.date));

    while (balance > 0 && month < maxMonths) {
      month++;
      
      // Calculate monthly interest
      const interest = balance * getMonthlyRate(debt.apr);
      totalInterest += interest;
      balance += interest;

      // Check for lump sum payments this month
      const monthStr = currentDate.toFormat('yyyy-MM');
      const lumpSum = sortedLumpSums.find(ls => ls.date.startsWith(monthStr));
      let lumpSumAmount = 0;
      
      if (lumpSum) {
        lumpSumAmount = Math.min(lumpSum.amount, balance);
        balance -= lumpSumAmount;
        totalPaid += lumpSumAmount;
      }

      // Regular payment
      const payment = Math.min(totalMonthlyPayment, balance);
      balance -= payment;
      totalPaid += payment;

      // Ensure we don't go negative
      balance = Math.max(0, balance);

      schedule.push({
        month,
        date: currentDate.toISODate(),
        payment,
        lumpSum: lumpSumAmount,
        interest,
        principal: payment - interest + lumpSumAmount,
        balance,
        totalPaid,
        totalInterest
      });

      currentDate = currentDate.plus({ months: 1 });
    }

    const lastEntry = schedule[schedule.length - 1];
    const payoffDate = balance <= 0 ? lastEntry?.date : null;

    return {
      isPaidOff: balance <= 0,
      payoffDate,
      payoffMonths: balance <= 0 ? month : null,
      totalInterest,
      totalPaid,
      originalPrincipal: debt.principal,
      finalBalance: balance,
      monthlyPayment: totalMonthlyPayment,
      schedule,
      message: balance <= 0 
        ? `Paid off in ${month} months (${DateTime.fromISO(payoffDate).toFormat('MMMM yyyy')})`
        : `Not paid off within ${maxMonths} months`
    };
  }

  /**
   * Compare different payoff strategies
   * @param {Object} debt - Debt object
   * @returns {Object} Comparison of strategies
   */
  function compareStrategies(debt) {
    const strategies = [];

    // Minimum only
    const minOnly = projectPayoff(debt, { extraMonthly: 0 });
    strategies.push({
      name: 'Minimum Payment Only',
      payment: minOnly.monthlyPayment,
      months: minOnly.payoffMonths,
      totalInterest: minOnly.totalInterest,
      payoffDate: minOnly.payoffDate
    });

    // With extra payment
    if (debt.extraMonthlyPayment > 0) {
      const withExtra = projectPayoff(debt);
      strategies.push({
        name: `With $${debt.extraMonthlyPayment} Extra`,
        payment: withExtra.monthlyPayment,
        months: withExtra.payoffMonths,
        totalInterest: withExtra.totalInterest,
        payoffDate: withExtra.payoffDate,
        interestSaved: minOnly.totalInterest - withExtra.totalInterest,
        monthsSaved: (minOnly.payoffMonths || 360) - (withExtra.payoffMonths || 360)
      });
    }

    // Double payment
    const doubled = projectPayoff(debt, { 
      extraMonthly: (debt.extraMonthlyPayment || 0) + (minOnly.monthlyPayment || 0)
    });
    strategies.push({
      name: 'Double Payment',
      payment: doubled.monthlyPayment,
      months: doubled.payoffMonths,
      totalInterest: doubled.totalInterest,
      payoffDate: doubled.payoffDate,
      interestSaved: minOnly.totalInterest - doubled.totalInterest,
      monthsSaved: (minOnly.payoffMonths || 360) - (doubled.payoffMonths || 360)
    });

    return strategies;
  }

  /**
   * Calculate debt-free date across all debts
   * @param {Array} debts - Array of debt objects
   * @returns {Object} Overall debt-free projection
   */
  function projectAllDebts(debts) {
    if (!debts || debts.length === 0) {
      return {
        hasDebts: false,
        message: 'No debts'
      };
    }

    const projections = debts.map(debt => ({
      debt,
      projection: projectPayoff(debt)
    }));

    // Find latest payoff date
    let latestDate = null;
    let totalOriginalPrincipal = 0;
    let totalInterest = 0;
    let allPaidOff = true;

    for (const { debt, projection } of projections) {
      totalOriginalPrincipal += debt.principal;
      totalInterest += projection.totalInterest;
      
      if (!projection.isPaidOff) {
        allPaidOff = false;
      } else if (projection.payoffDate) {
        if (!latestDate || projection.payoffDate > latestDate) {
          latestDate = projection.payoffDate;
        }
      }
    }

    return {
      hasDebts: true,
      totalDebts: debts.length,
      totalOriginalPrincipal,
      totalInterest,
      allPaidOff,
      debtFreeDate: latestDate,
      projections,
      message: allPaidOff 
        ? `Debt-free by ${DateTime.fromISO(latestDate).toFormat('MMMM yyyy')}`
        : 'Some debts will not be paid off with current payments'
    };
  }

  /**
   * Get debt summary for display
   * @param {Object} debt - Debt object
   * @returns {Object} Summary data
   */
  function getDebtSummary(debt) {
    const projection = projectPayoff(debt);
    
    return {
      name: debt.name,
      principal: debt.principal,
      apr: debt.apr,
      monthlyPayment: projection.monthlyPayment,
      payoffDate: projection.payoffDate,
      payoffMonths: projection.payoffMonths,
      totalInterest: projection.totalInterest,
      totalCost: debt.principal + projection.totalInterest,
      isPaidOff: projection.isPaidOff
    };
  }

  /**
   * Format debt info for display
   */
  function formatDebtInfo(debt) {
    const summary = getDebtSummary(debt);
    
    return {
      ...summary,
      principalFormatted: FSS.App.formatCurrency(summary.principal),
      monthlyPaymentFormatted: FSS.App.formatCurrency(summary.monthlyPayment),
      totalInterestFormatted: FSS.App.formatCurrency(summary.totalInterest),
      totalCostFormatted: FSS.App.formatCurrency(summary.totalCost),
      payoffDateFormatted: summary.payoffDate 
        ? DateTime.fromISO(summary.payoffDate).toFormat('MMMM yyyy')
        : 'N/A'
    };
  }

  // Public API
  return {
    getMonthlyRate,
    getDailyRate,
    calculateInterest,
    calculateMinPayment,
    projectPayoff,
    compareStrategies,
    projectAllDebts,
    getDebtSummary,
    formatDebtInfo
  };
})();

window.FSS = FSS;


