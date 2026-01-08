/**
 * Finance Scenario Simulator - App Initialization
 * Bootstrap the application and load appropriate UI module based on current page
 */

const FSS = window.FSS || {};

FSS.App = (function() {
  'use strict';

  // Page detection
  const PAGES = {
    'index.html': 'home',
    'builder.html': 'builder',
    'dashboard.html': 'dashboard',
    'timeline.html': 'timeline',
    'scenarios.html': 'scenarios',
    'storage.html': 'storage',
    '': 'home' // Default for root
  };

  let currentPage = null;
  let isInitialized = false;

  /**
   * Detect which page we're on
   */
  function detectPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || '';
    return PAGES[filename] || 'home';
  }

  /**
   * Set active navigation link
   */
  function setActiveNav() {
    const page = currentPage;
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href') || '';
      const linkPage = PAGES[href] || PAGES[href.split('/').pop()];
      if (linkPage === page) {
        link.classList.add('active');
      }
    });
  }

  /**
   * Initialize base model if not exists
   */
  function ensureBaseModel() {
    if (!FSS.Storage.hasBaseModel()) {
      const emptyModel = FSS.Schema.createEmptyModel();
      FSS.Storage.saveBaseModel(emptyModel);
      console.log('Created empty base model');
    }
  }

  /**
   * Get the current base model (or create empty)
   */
  function getModel() {
    let model = FSS.Storage.loadBaseModel();
    if (!model) {
      model = FSS.Schema.createEmptyModel();
      FSS.Storage.saveBaseModel(model);
    }
    return model;
  }

  /**
   * Check for scenario draft and show banner if present
   */
  function checkScenarioBanner() {
    if (FSS.Storage.hasScenarioDraft() && currentPage !== 'scenarios') {
      const banner = document.getElementById('scenario-banner');
      if (banner) {
        banner.style.display = 'flex';
      }
    }
  }

  /**
   * Format currency amount
   */
  function formatCurrency(amount, options = {}) {
    const model = getModel();
    const currency = model?.meta?.currency || 'USD';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2
    });
    return formatter.format(amount);
  }

  /**
   * Format date using model settings
   */
  function formatDate(dateStr, format = null) {
    const model = getModel();
    const displayFormat = format || model?.settings?.display?.dateFormat || 'MMM d, yyyy';
    const dt = luxon.DateTime.fromISO(dateStr);
    return dt.isValid ? dt.toFormat(displayFormat) : dateStr;
  }

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'info') {
    // Create toast container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = '1100';
      document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const bgClass = {
      'success': 'bg-success',
      'error': 'bg-danger',
      'warning': 'bg-warning',
      'info': 'bg-primary'
    }[type] || 'bg-primary';

    const toastHTML = `
      <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', toastHTML);

    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }

  /**
   * Show confirmation modal
   */
  function confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      // Check if modal exists, create if not
      let modal = document.getElementById('confirm-modal');
      if (!modal) {
        const modalHTML = `
          <div class="modal fade" id="confirm-modal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title"></h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                  <button type="button" class="btn btn-danger" id="confirm-modal-ok">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('confirm-modal');
      }

      modal.querySelector('.modal-title').textContent = title;
      modal.querySelector('.modal-body').textContent = message;

      const bsModal = new bootstrap.Modal(modal);
      
      const okBtn = document.getElementById('confirm-modal-ok');
      const handleOk = () => {
        bsModal.hide();
        resolve(true);
      };
      
      okBtn.onclick = handleOk;
      
      modal.addEventListener('hidden.bs.modal', function handler() {
        modal.removeEventListener('hidden.bs.modal', handler);
        resolve(false);
      }, { once: true });

      bsModal.show();
    });
  }

  /**
   * Download a file
   */
  function downloadFile(content, filename, contentType = 'application/json') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Read file as text
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  /**
   * Initialize the page-specific UI
   */
  function initPageUI() {
    switch (currentPage) {
      case 'home':
        if (FSS.UI && FSS.UI.Home) FSS.UI.Home.init();
        break;
      case 'builder':
        if (FSS.UI && FSS.UI.Builder) FSS.UI.Builder.init();
        break;
      case 'dashboard':
        if (FSS.UI && FSS.UI.Dashboard) FSS.UI.Dashboard.init();
        break;
      case 'timeline':
        if (FSS.UI && FSS.UI.Timeline) FSS.UI.Timeline.init();
        break;
      case 'scenarios':
        if (FSS.UI && FSS.UI.Scenarios) FSS.UI.Scenarios.init();
        break;
      case 'storage':
        if (FSS.UI && FSS.UI.Storage) FSS.UI.Storage.init();
        break;
    }
  }

  /**
   * Main initialization
   */
  function init() {
    if (isInitialized) return;

    console.log('FSS: Initializing application...');

    // Check localStorage availability
    if (!FSS.Storage.isAvailable()) {
      document.body.innerHTML = `
        <div class="container py-5">
          <div class="alert alert-danger">
            <h4>Storage Not Available</h4>
            <p>This application requires localStorage to function. Please enable cookies and local storage in your browser settings.</p>
          </div>
        </div>
      `;
      return;
    }

    // Detect current page
    currentPage = detectPage();
    console.log('FSS: Current page:', currentPage);

    // Ensure base model exists
    ensureBaseModel();

    // Set active navigation
    setActiveNav();

    // Check for scenario banner
    checkScenarioBanner();

    // Initialize page-specific UI
    initPageUI();

    isInitialized = true;
    console.log('FSS: Initialization complete');
  }

  // Public API
  return {
    init,
    detectPage,
    getModel,
    formatCurrency,
    formatDate,
    showToast,
    confirm,
    downloadFile,
    readFile,
    get currentPage() { return currentPage; }
  };
})();

// Initialize FSS namespace for UI modules
FSS.UI = FSS.UI || {};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  FSS.App.init();
});

window.FSS = FSS;


