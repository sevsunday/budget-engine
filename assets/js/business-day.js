/**
 * Finance Scenario Simulator - Business Day Module
 * Weekend detection and business day adjustment logic
 */

const FSS = window.FSS || {};

FSS.BusinessDay = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Check if a date is a weekend
   * @param {string|DateTime} date - Date to check
   * @returns {boolean}
   */
  function isWeekend(date) {
    const dt = typeof date === 'string' ? DateTime.fromISO(date) : date;
    // Luxon: 6 = Saturday, 7 = Sunday
    return dt.weekday === 6 || dt.weekday === 7;
  }

  /**
   * Check if a date is a business day
   * @param {string|DateTime} date - Date to check
   * @param {Object} settings - Business day settings
   * @returns {boolean}
   */
  function isBusinessDay(date, settings = {}) {
    const weekendsAreNonBusinessDays = settings.weekendsAreNonBusinessDays !== false;
    
    if (weekendsAreNonBusinessDays && isWeekend(date)) {
      return false;
    }
    
    // V1: No holiday support
    return true;
  }

  /**
   * Get the next business day
   * @param {string|DateTime} date - Starting date
   * @param {Object} settings - Business day settings
   * @returns {DateTime}
   */
  function nextBusinessDay(date, settings = {}) {
    let dt = typeof date === 'string' ? DateTime.fromISO(date) : date;
    dt = dt.plus({ days: 1 });
    
    while (!isBusinessDay(dt, settings)) {
      dt = dt.plus({ days: 1 });
    }
    
    return dt;
  }

  /**
   * Get the previous business day
   * @param {string|DateTime} date - Starting date
   * @param {Object} settings - Business day settings
   * @returns {DateTime}
   */
  function prevBusinessDay(date, settings = {}) {
    let dt = typeof date === 'string' ? DateTime.fromISO(date) : date;
    dt = dt.minus({ days: 1 });
    
    while (!isBusinessDay(dt, settings)) {
      dt = dt.minus({ days: 1 });
    }
    
    return dt;
  }

  /**
   * Adjust a date based on business day rules
   * @param {string|DateTime} date - Date to adjust
   * @param {string} adjustment - Adjustment type: 'none', 'next_business_day', 'prev_business_day'
   * @param {Object} settings - Business day settings
   * @returns {string} Adjusted date as ISO string
   */
  function adjustDate(date, adjustment = 'none', settings = {}) {
    const dt = typeof date === 'string' ? DateTime.fromISO(date) : date;
    
    if (adjustment === 'none' || isBusinessDay(dt, settings)) {
      return dt.toISODate();
    }
    
    if (adjustment === 'next_business_day') {
      let adjusted = dt;
      while (!isBusinessDay(adjusted, settings)) {
        adjusted = adjusted.plus({ days: 1 });
      }
      return adjusted.toISODate();
    }
    
    if (adjustment === 'prev_business_day') {
      let adjusted = dt;
      while (!isBusinessDay(adjusted, settings)) {
        adjusted = adjusted.minus({ days: 1 });
      }
      return adjusted.toISODate();
    }
    
    return dt.toISODate();
  }

  /**
   * Apply business day adjustment to a transaction
   * @param {Object} transaction - Transaction with date and businessDayAdjustment
   * @param {Object} settings - Business day settings from model
   * @returns {Object} Transaction with adjusted date (original date preserved)
   */
  function adjustTransaction(transaction, settings = {}) {
    const adjustment = transaction.businessDayAdjustment || 'none';
    const businessDaySettings = settings.businessDays || {};
    
    const adjustedDate = adjustDate(
      transaction.date,
      adjustment,
      businessDaySettings
    );
    
    return {
      ...transaction,
      originalDate: transaction.date,
      date: adjustedDate,
      wasAdjusted: adjustedDate !== transaction.date
    };
  }

  /**
   * Get business days in a month
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {Object} settings - Business day settings
   * @returns {number}
   */
  function businessDaysInMonth(year, month, settings = {}) {
    const start = DateTime.local(year, month, 1);
    const end = start.endOf('month');
    let count = 0;
    
    let current = start;
    while (current <= end) {
      if (isBusinessDay(current, settings)) {
        count++;
      }
      current = current.plus({ days: 1 });
    }
    
    return count;
  }

  /**
   * Get all business days in a date range
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {Object} settings - Business day settings
   * @returns {Array<string>} Array of ISO date strings
   */
  function getBusinessDaysInRange(startDate, endDate, settings = {}) {
    const dates = [];
    let current = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);
    
    while (current <= end) {
      if (isBusinessDay(current, settings)) {
        dates.push(current.toISODate());
      }
      current = current.plus({ days: 1 });
    }
    
    return dates;
  }

  /**
   * Get human-readable adjustment description
   * @param {string} adjustment - Adjustment type
   * @returns {string}
   */
  function describeAdjustment(adjustment) {
    switch (adjustment) {
      case 'next_business_day':
        return 'Next business day';
      case 'prev_business_day':
        return 'Previous business day';
      case 'none':
      default:
        return 'No adjustment';
    }
  }

  // Public API
  return {
    isWeekend,
    isBusinessDay,
    nextBusinessDay,
    prevBusinessDay,
    adjustDate,
    adjustTransaction,
    businessDaysInMonth,
    getBusinessDaysInRange,
    describeAdjustment
  };
})();

window.FSS = FSS;

