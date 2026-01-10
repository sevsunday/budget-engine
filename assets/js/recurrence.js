/**
 * Finance Scenario Simulator - Recurrence Module
 * Expand recurring rules into dated transactions
 */

var FSS = window.FSS || {};

FSS.Recurrence = (function() {
  'use strict';

  const { DateTime } = luxon;

  /**
   * Expand a rule into dated occurrences within a date range
   * @param {Object} rule - The rule to expand
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} model - The model (for followsRuleId resolution)
   * @returns {Array} Array of dated occurrences
   */
  function expandRule(rule, startDate, endDate, model = null) {
    if (!rule || !rule.enabled) return [];

    // Check validity period
    if (rule.validFrom && startDate < rule.validFrom) {
      startDate = rule.validFrom;
    }
    if (rule.validTo && endDate > rule.validTo) {
      endDate = rule.validTo;
    }
    if (startDate > endDate) return [];

    // Get recurrence (either from rule or from followed rule)
    let recurrence = rule.recurrence;
    if (rule.followsRuleId && model) {
      const followedRule = model.rules?.find(r => r.id === rule.followsRuleId);
      if (followedRule) {
        recurrence = followedRule.recurrence;
      }
    }

    if (!recurrence) return [];

    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);
    const occurrences = [];

    switch (recurrence.type) {
      case 'monthly_day':
        occurrences.push(...expandMonthlyDay(recurrence, start, end));
        break;
      case 'semimonthly_days':
        occurrences.push(...expandSemimonthlyDays(recurrence, start, end));
        break;
      case 'biweekly_anchor':
        occurrences.push(...expandBiweeklyAnchor(recurrence, start, end));
        break;
      case 'weekly_dow':
        occurrences.push(...expandWeeklyDow(recurrence, start, end));
        break;
    }

    return occurrences.map(date => ({
      date: date.toISODate(),
      ruleId: rule.id,
      name: rule.name,
      accountId: rule.accountId,
      kind: rule.kind,
      amount: rule.amount,
      category: rule.category || '',
      tags: rule.tags || [],
      priority: rule.priority || 100,
      businessDayAdjustment: rule.businessDayAdjustment || 'none',
      toAccountId: rule.toAccountId // For transfers
    }));
  }

  /**
   * Monthly on specific day (e.g., 1st, 15th)
   */
  function expandMonthlyDay(recurrence, start, end) {
    const dates = [];
    const day = recurrence.day || 1;
    
    let current = start.startOf('month');
    
    while (current <= end) {
      const targetDate = getValidDayOfMonth(current, day);
      
      if (targetDate >= start && targetDate <= end) {
        dates.push(targetDate);
      }
      
      current = current.plus({ months: 1 });
    }
    
    return dates;
  }

  /**
   * Semi-monthly (e.g., 1st and 15th)
   */
  function expandSemimonthlyDays(recurrence, start, end) {
    const dates = [];
    const day1 = recurrence.day1 || 1;
    const day2 = recurrence.day2 || 15;
    
    let current = start.startOf('month');
    
    while (current <= end) {
      const date1 = getValidDayOfMonth(current, day1);
      const date2 = getValidDayOfMonth(current, day2);
      
      if (date1 >= start && date1 <= end) {
        dates.push(date1);
      }
      if (date2 >= start && date2 <= end) {
        dates.push(date2);
      }
      
      current = current.plus({ months: 1 });
    }
    
    return dates.sort((a, b) => a < b ? -1 : 1);
  }

  /**
   * Biweekly from anchor date (e.g., every 2 weeks from Jan 9)
   */
  function expandBiweeklyAnchor(recurrence, start, end) {
    const dates = [];
    const anchor = DateTime.fromISO(recurrence.anchorDate);
    
    if (!anchor.isValid) return dates;
    
    // Find the first occurrence on or after start
    let daysDiff = start.diff(anchor, 'days').days;
    let weeksToAdd = Math.floor(daysDiff / 14);
    if (daysDiff % 14 !== 0 && daysDiff > 0) {
      weeksToAdd += 1;
    }
    
    let current = anchor.plus({ weeks: weeksToAdd * 2 });
    
    // Go back if we're before start
    while (current < start) {
      current = current.plus({ weeks: 2 });
    }
    
    while (current <= end) {
      dates.push(current);
      current = current.plus({ weeks: 2 });
    }
    
    return dates;
  }

  /**
   * Weekly on specific day of week (0 = Monday, 6 = Sunday)
   */
  function expandWeeklyDow(recurrence, start, end) {
    const dates = [];
    const dow = recurrence.dayOfWeek ?? 0; // Default to Monday
    
    // Luxon uses 1 = Monday, 7 = Sunday
    const luxonDow = dow + 1;
    
    // Find first occurrence on or after start
    let current = start;
    while (current.weekday !== luxonDow) {
      current = current.plus({ days: 1 });
    }
    
    while (current <= end) {
      dates.push(current);
      current = current.plus({ weeks: 1 });
    }
    
    return dates;
  }

  /**
   * Get valid day of month, handling overflow
   * (e.g., day 31 in February becomes Feb 28/29)
   */
  function getValidDayOfMonth(monthStart, day) {
    const daysInMonth = monthStart.daysInMonth;
    const actualDay = Math.min(day, daysInMonth);
    return monthStart.set({ day: actualDay });
  }

  /**
   * Get human-readable recurrence description
   */
  function describeRecurrence(recurrence) {
    if (!recurrence) return 'No recurrence';

    switch (recurrence.type) {
      case 'monthly_day':
        return `Monthly on the ${ordinal(recurrence.day || 1)}`;
      case 'semimonthly_days':
        return `Semi-monthly on the ${ordinal(recurrence.day1 || 1)} and ${ordinal(recurrence.day2 || 15)}`;
      case 'biweekly_anchor':
        const anchor = DateTime.fromISO(recurrence.anchorDate);
        return `Every 2 weeks (from ${anchor.isValid ? anchor.toFormat('MMM d') : 'anchor'})`;
      case 'weekly_dow':
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return `Weekly on ${days[recurrence.dayOfWeek || 0]}`;
      default:
        return 'Unknown recurrence';
    }
  }

  /**
   * Get ordinal suffix for number
   */
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Parse recurrence from form inputs
   */
  function parseRecurrence(type, params) {
    switch (type) {
      case 'monthly_day':
        return {
          type: 'monthly_day',
          day: parseInt(params.day, 10) || 1
        };
      case 'semimonthly_days':
        return {
          type: 'semimonthly_days',
          day1: parseInt(params.day1, 10) || 1,
          day2: parseInt(params.day2, 10) || 15
        };
      case 'biweekly_anchor':
        return {
          type: 'biweekly_anchor',
          anchorDate: params.anchorDate || DateTime.now().toISODate()
        };
      case 'weekly_dow':
        return {
          type: 'weekly_dow',
          dayOfWeek: parseInt(params.dayOfWeek, 10) || 0
        };
      default:
        return null;
    }
  }

  /**
   * Get next occurrence date from today
   */
  function getNextOccurrence(rule, model = null) {
    const today = DateTime.now().toISODate();
    const future = DateTime.now().plus({ months: 3 }).toISODate();
    const occurrences = expandRule(rule, today, future, model);
    return occurrences.length > 0 ? occurrences[0].date : null;
  }

  // Public API
  return {
    expandRule,
    describeRecurrence,
    parseRecurrence,
    getNextOccurrence,
    ordinal
  };
})();

window.FSS = FSS;


