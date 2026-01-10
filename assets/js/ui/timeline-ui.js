/**
 * Finance Scenario Simulator - Timeline UI Module
 * Ledger table with filters and CSV export
 */

var FSS = window.FSS || {};
FSS.UI = FSS.UI || {};

FSS.UI.Timeline = (function() {
  'use strict';

  const { DateTime } = luxon;

  // State
  let ledgerResult = null;
  let filteredEntries = [];
  let currentPage = 1;
  const pageSize = 50;

  // Filter state
  let filters = {
    month: '',
    category: '',
    type: '',
    accountId: ''
  };

  /**
   * Initialize the timeline UI
   */
  function init() {
    setupEventListeners();
    loadLedger();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    document.getElementById('filter-month')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-category')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-type')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-account')?.addEventListener('change', handleFilterChange);
    document.getElementById('btn-export-csv')?.addEventListener('click', handleExportCSV);
  }

  /**
   * Load and render the ledger
   */
  function loadLedger() {
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

    // Run ledger
    ledgerResult = FSS.Ledger.runLedger(effectiveModel);
    
    // Populate filter options
    populateFilterOptions();
    
    // Apply filters and render
    applyFilters();
  }

  /**
   * Populate filter dropdowns
   */
  function populateFilterOptions() {
    if (!ledgerResult) return;

    // Month options
    const months = FSS.Ledger.getUniqueMonths(ledgerResult.entries);
    const monthSelect = document.getElementById('filter-month');
    monthSelect.innerHTML = '<option value="">All Months</option>' + 
      months.map(m => {
        const dt = DateTime.fromISO(m + '-01');
        return `<option value="${m}">${dt.toFormat('MMMM yyyy')}</option>`;
      }).join('');

    // Category options
    const categories = FSS.Ledger.getUniqueCategories(ledgerResult.entries);
    const categorySelect = document.getElementById('filter-category');
    categorySelect.innerHTML = '<option value="">All Categories</option>' + 
      categories.map(c => `<option value="${c}">${c}</option>`).join('');

    // Account options
    const accounts = FSS.Model.getAccountOptions();
    const accountSelect = document.getElementById('filter-account');
    accountSelect.innerHTML = '<option value="">All Accounts</option>' + 
      accounts.map(a => `<option value="${a.value}">${a.label}</option>`).join('');
  }

  /**
   * Handle filter changes
   */
  function handleFilterChange() {
    filters = {
      month: document.getElementById('filter-month').value,
      category: document.getElementById('filter-category').value,
      kind: document.getElementById('filter-type').value,
      accountId: document.getElementById('filter-account').value
    };
    
    currentPage = 1;
    applyFilters();
  }

  /**
   * Apply filters and render
   */
  function applyFilters() {
    if (!ledgerResult) return;

    // Filter entries (exclude starting balance from filters)
    const allEntries = ledgerResult.entries.filter(e => !e.isStartingBalance);
    filteredEntries = FSS.Ledger.filterEntries(allEntries, filters);
    
    renderTable();
    renderSummary();
    renderPagination();
    
    // Show/hide empty state
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('ledger-table');
    
    if (filteredEntries.length === 0 && ledgerResult.entries.length <= 1) {
      emptyState?.classList.remove('d-none');
      table?.classList.add('d-none');
    } else {
      emptyState?.classList.add('d-none');
      table?.classList.remove('d-none');
    }
  }

  /**
   * Render the ledger table
   */
  function renderTable() {
    const tbody = document.getElementById('ledger-body');
    if (!tbody) return;

    // Paginate
    const startIdx = (currentPage - 1) * pageSize;
    const pageEntries = filteredEntries.slice(startIdx, startIdx + pageSize);

    if (pageEntries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            No transactions match your filters
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageEntries.map(entry => {
      const rowClass = getRowClass(entry);
      const amountClass = entry.amount >= 0 ? 'text-income' : 'text-expense';
      const balanceClass = entry.balance < 0 ? 'text-expense' : '';
      
      // Determine if balance is below floor
      const settings = FSS.Model.getSettings();
      const floor = settings.safeSurplus?.floor || 2000;
      const isDanger = entry.balance < floor;
      
      return `
        <tr class="${rowClass} ${isDanger ? 'row-danger' : ''}">
          <td class="mono">${FSS.App.formatDate(entry.date)}</td>
          <td>
            ${entry.name}
            ${entry.wasAdjusted ? '<i class="bi bi-calendar-check text-muted ms-1" title="Business day adjusted"></i>' : ''}
          </td>
          <td>
            ${entry.category ? `<span class="badge bg-secondary">${entry.category}</span>` : ''}
          </td>
          <td class="text-end mono ${amountClass}">
            ${entry.amount >= 0 ? '+' : ''}${FSS.App.formatCurrency(entry.amount)}
          </td>
          <td class="text-end mono ${balanceClass}">
            ${FSS.App.formatCurrency(entry.balance)}
            ${isDanger ? '<i class="bi bi-exclamation-triangle text-warning ms-1"></i>' : ''}
          </td>
          <td class="text-muted small">
            ${entry.ruleId ? `<span class="badge bg-tertiary">${entry.ruleId}</span>` : ''}
            ${entry.isOneOff ? '<span class="badge bg-tertiary">one-off</span>' : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Get CSS class for row based on transaction type
   */
  function getRowClass(entry) {
    if (entry.kind === 'income') return 'row-income';
    if (entry.kind === 'expense') return 'row-expense';
    if (entry.kind === 'transfer') return 'row-transfer';
    return '';
  }

  /**
   * Render filter summary
   */
  function renderSummary() {
    // Count
    document.getElementById('showing-count').textContent = filteredEntries.length;

    // Period
    if (filteredEntries.length > 0) {
      const firstDate = filteredEntries[0].date;
      const lastDate = filteredEntries[filteredEntries.length - 1].date;
      document.getElementById('showing-period').textContent = 
        `${FSS.App.formatDate(firstDate)} - ${FSS.App.formatDate(lastDate)}`;
    } else {
      document.getElementById('showing-period').textContent = '--';
    }

    // Income total
    const incomeTotal = filteredEntries
      .filter(e => e.kind === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('filter-income-total').textContent = FSS.App.formatCurrency(incomeTotal);

    // Expense total
    const expenseTotal = filteredEntries
      .filter(e => e.kind === 'expense')
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    document.getElementById('filter-expense-total').textContent = FSS.App.formatCurrency(expenseTotal);
  }

  /**
   * Render pagination
   */
  function renderPagination() {
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const nav = document.getElementById('pagination-nav');
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
      nav?.classList.add('d-none');
      return;
    }
    
    nav?.classList.remove('d-none');
    
    let html = '';
    
    // Previous
    html += `
      <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="FSS.UI.Timeline.goToPage(${currentPage - 1}); return false;">
          <i class="bi bi-chevron-left"></i>
        </a>
      </li>
    `;
    
    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
      html += `<li class="page-item"><a class="page-link" href="#" onclick="FSS.UI.Timeline.goToPage(1); return false;">1</a></li>`;
      if (startPage > 2) {
        html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <li class="page-item ${i === currentPage ? 'active' : ''}">
          <a class="page-link" href="#" onclick="FSS.UI.Timeline.goToPage(${i}); return false;">${i}</a>
        </li>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      }
      html += `<li class="page-item"><a class="page-link" href="#" onclick="FSS.UI.Timeline.goToPage(${totalPages}); return false;">${totalPages}</a></li>`;
    }
    
    // Next
    html += `
      <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="FSS.UI.Timeline.goToPage(${currentPage + 1}); return false;">
          <i class="bi bi-chevron-right"></i>
        </a>
      </li>
    `;
    
    pagination.innerHTML = html;
  }

  /**
   * Go to specific page
   */
  function goToPage(page) {
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderTable();
    renderPagination();
    
    // Scroll to top of table
    document.getElementById('ledger-table')?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Show empty state
   */
  function showEmptyState() {
    document.getElementById('empty-state')?.classList.remove('d-none');
    document.querySelector('.card')?.classList.add('d-none');
    document.getElementById('pagination-nav')?.classList.add('d-none');
  }

  /**
   * Handle CSV export
   */
  function handleExportCSV() {
    if (!ledgerResult || filteredEntries.length === 0) {
      FSS.App.showToast('No data to export', 'warning');
      return;
    }

    const csv = FSS.Ledger.exportToCSV(filteredEntries, { includeStartingBalance: false });
    const filename = `fss-ledger-${DateTime.now().toFormat('yyyy-MM-dd')}.csv`;
    
    FSS.App.downloadFile(csv, filename, 'text/csv');
    FSS.App.showToast('Ledger exported to CSV', 'success');
  }

  // Public API
  return {
    init,
    goToPage
  };
})();

window.FSS = FSS;


