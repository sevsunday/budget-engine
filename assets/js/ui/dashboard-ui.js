/**
 * Finance Scenario Simulator - Dashboard UI Module
 * Summary cards and Chart.js visualizations
 */

const FSS = window.FSS || {};
FSS.UI = FSS.UI || {};

FSS.UI.Dashboard = (function() {
  'use strict';

  const { DateTime } = luxon;

  // Chart instances
  let balanceChart = null;
  let monthlyNetChart = null;

  // State
  let dashboardData = null;
  let selectedMonth = null;

  /**
   * Initialize the dashboard UI
   */
  function init() {
    selectedMonth = DateTime.now().toFormat('yyyy-MM');
    
    setupEventListeners();
    loadDashboard();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    document.getElementById('month-selector')?.addEventListener('change', handleMonthChange);
  }

  /**
   * Load and render dashboard
   */
  function loadDashboard() {
    const model = FSS.Model.load();
    
    // Check if model has meaningful data
    const hasRules = model.rules && model.rules.length > 0;
    const hasBalances = model.startingBalances && model.startingBalances.length > 0;
    
    if (!hasRules && !hasBalances) {
      showEmptyState();
      return;
    }

    // Check for scenario and apply if exists
    let effectiveModel = model;
    if (FSS.Storage.hasScenarioDraft() && FSS.Overlay) {
      const scenario = FSS.Storage.loadScenarioDraft();
      effectiveModel = FSS.Overlay.applyScenario(model, scenario);
    }

    // Get dashboard data
    dashboardData = FSS.Summary.getDashboardData(effectiveModel, selectedMonth);
    
    // Populate month selector
    populateMonthSelector();
    
    // Render all components
    renderSummaryCards();
    renderIncomeExpenseBreakdown();
    renderCharts();
    
    // Hide empty state
    document.getElementById('empty-state')?.classList.add('d-none');
  }

  /**
   * Populate month selector dropdown
   */
  function populateMonthSelector() {
    const selector = document.getElementById('month-selector');
    if (!selector || !dashboardData) return;

    selector.innerHTML = dashboardData.availableMonths
      .map(m => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.label}</option>`)
      .join('');
  }

  /**
   * Handle month selection change
   */
  function handleMonthChange(e) {
    selectedMonth = e.target.value;
    loadDashboard();
  }

  /**
   * Render summary cards
   */
  function renderSummaryCards() {
    if (!dashboardData || !dashboardData.summary) return;

    const { summary, safeSurplus } = dashboardData;

    // End balance
    const endBalanceEl = document.getElementById('end-balance');
    endBalanceEl.textContent = FSS.App.formatCurrency(summary.endBalance);
    endBalanceEl.className = `summary-value mono ${summary.endBalance >= 0 ? '' : 'text-expense'}`;
    
    const changeEl = document.getElementById('end-balance-change');
    const change = summary.endBalance - summary.startBalance;
    changeEl.textContent = `${change >= 0 ? '+' : ''}${FSS.App.formatCurrency(change)} from start`;
    changeEl.className = `text-muted small mt-1 ${change >= 0 ? 'text-income' : 'text-expense'}`;

    // Net surplus
    document.getElementById('net-surplus').textContent = FSS.App.formatCurrency(summary.netSurplus);
    document.getElementById('net-surplus').className = 
      `summary-value mono ${summary.netSurplus >= 0 ? 'text-income' : 'text-expense'}`;

    // Minimum balance
    document.getElementById('min-balance').textContent = FSS.App.formatCurrency(summary.minBalance);
    const minDateEl = document.getElementById('min-balance-date');
    if (summary.minBalanceDate) {
      minDateEl.textContent = `On ${FSS.App.formatDate(summary.minBalanceDate)}`;
    }

    // Safe withdrawable
    const safeEl = document.getElementById('safe-withdraw');
    const safeNoteEl = document.getElementById('safe-withdraw-note');
    
    if (safeSurplus.isUnsafe) {
      safeEl.textContent = FSS.App.formatCurrency(0);
      safeEl.className = 'summary-value mono text-expense';
      safeNoteEl.textContent = `Unsafe by ${FSS.App.formatCurrency(safeSurplus.unsafeBy)}`;
      safeNoteEl.className = 'text-expense small mt-1';
    } else {
      safeEl.textContent = FSS.App.formatCurrency(safeSurplus.safeWithdrawable);
      safeEl.className = 'summary-value mono text-income';
      safeNoteEl.textContent = safeSurplus.message || 'Safe to withdraw';
      safeNoteEl.className = 'text-muted small mt-1';
    }
  }

  /**
   * Render income and expense breakdowns
   */
  function renderIncomeExpenseBreakdown() {
    if (!dashboardData || !dashboardData.ledger) return;

    // Total income
    document.getElementById('total-income').textContent = 
      FSS.App.formatCurrency(dashboardData.summary?.income || 0);

    // Total expenses
    document.getElementById('total-expenses').textContent = 
      FSS.App.formatCurrency(dashboardData.summary?.expenses || 0);

    // Income breakdown
    const incomeBreakdown = FSS.Summary.getIncomeBreakdown(dashboardData.ledger);
    const incomeContainer = document.getElementById('income-breakdown');
    
    if (incomeBreakdown.length > 0) {
      incomeContainer.innerHTML = incomeBreakdown.slice(0, 5).map(item => `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="text-muted">${item.category}</span>
          <span class="mono">${FSS.App.formatCurrency(item.amount)}</span>
        </div>
      `).join('');
    } else {
      incomeContainer.innerHTML = '<div class="text-muted small">No income transactions</div>';
    }

    // Expense breakdown
    const expenseBreakdown = FSS.Summary.getExpenseBreakdown(dashboardData.ledger);
    const expenseContainer = document.getElementById('expense-breakdown');
    
    if (expenseBreakdown.length > 0) {
      expenseContainer.innerHTML = expenseBreakdown.slice(0, 5).map(item => `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="text-muted">${item.category}</span>
          <span class="mono">${FSS.App.formatCurrency(item.amount)}</span>
        </div>
      `).join('');
    } else {
      expenseContainer.innerHTML = '<div class="text-muted small">No expense transactions</div>';
    }
  }

  /**
   * Render charts
   */
  function renderCharts() {
    if (!dashboardData || !dashboardData.charts) return;

    renderBalanceChart();
    renderMonthlyNetChart();
  }

  /**
   * Render balance over time chart
   */
  function renderBalanceChart() {
    const ctx = document.getElementById('balance-chart')?.getContext('2d');
    if (!ctx) return;

    const { labels, data } = dashboardData.charts.balance;

    // Destroy existing chart
    if (balanceChart) {
      balanceChart.destroy();
    }

    // Format labels
    const formattedLabels = labels.map(d => DateTime.fromISO(d).toFormat('MMM d'));

    // Get settings for floor line
    const settings = FSS.Model.getSettings();
    const floor = settings.safeSurplus?.floor || 2000;

    balanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: [
          {
            label: 'Balance',
            data: data,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
          },
          {
            label: 'Floor',
            data: Array(data.length).fill(floor),
            borderColor: '#d29922',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#8b949e',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            borderColor: '#30363d',
            borderWidth: 1,
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${FSS.App.formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: '#21262d'
            },
            ticks: {
              color: '#8b949e',
              maxTicksLimit: 10
            }
          },
          y: {
            grid: {
              color: '#21262d'
            },
            ticks: {
              color: '#8b949e',
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render monthly net surplus chart
   */
  function renderMonthlyNetChart() {
    const ctx = document.getElementById('monthly-net-chart')?.getContext('2d');
    if (!ctx) return;

    const { labels, datasets } = dashboardData.charts.monthlyNet;

    // Destroy existing chart
    if (monthlyNetChart) {
      monthlyNetChart.destroy();
    }

    monthlyNetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Income',
            data: datasets.income,
            backgroundColor: 'rgba(63, 185, 80, 0.8)',
            borderColor: '#3fb950',
            borderWidth: 1
          },
          {
            label: 'Expenses',
            data: datasets.expenses.map(v => -v), // Show as negative for visual clarity
            backgroundColor: 'rgba(248, 81, 73, 0.8)',
            borderColor: '#f85149',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#8b949e',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#161b22',
            borderColor: '#30363d',
            borderWidth: 1,
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            callbacks: {
              label: function(context) {
                const value = Math.abs(context.raw);
                return `${context.dataset.label}: ${FSS.App.formatCurrency(value)}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: false,
            grid: {
              color: '#21262d'
            },
            ticks: {
              color: '#8b949e'
            }
          },
          y: {
            stacked: false,
            grid: {
              color: '#21262d'
            },
            ticks: {
              color: '#8b949e',
              callback: function(value) {
                return '$' + Math.abs(value).toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  /**
   * Show empty state
   */
  function showEmptyState() {
    document.getElementById('empty-state')?.classList.remove('d-none');
    
    // Hide other content
    document.querySelectorAll('.row.g-4').forEach(el => el.classList.add('d-none'));
  }

  /**
   * Refresh dashboard data
   */
  function refresh() {
    loadDashboard();
  }

  // Public API
  return {
    init,
    refresh
  };
})();

window.FSS = FSS;


