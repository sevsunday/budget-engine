# Finance Scenario Simulator (FSS)

A fully client-side financial planning and forecasting web application. Build your financial model, explore what-if scenarios, and make informed decisions — all without your data ever leaving your browser.

## Features

- **100% Client-Side**: No servers, no accounts, no tracking. Your data stays in your browser.
- **Financial Model Builder**: Define accounts, recurring income/expenses, transfers, and one-off transactions.
- **Cash Flow Projections**: See your projected balances up to 6 months (or more) into the future.
- **Scenario Lab**: Explore "what-if" changes without affecting your base model.
- **Safe Surplus Calculator**: Know how much you can safely withdraw based on upcoming obligations.
- **Data Portability**: Export/import your data as JSON for backup or transfer.

## Quick Start

1. Open `index.html` in your browser (or host on GitHub Pages)
2. Navigate to **Builder** to set up your financial model
3. Add your accounts, starting balances, and recurring transactions
4. View projections in **Dashboard** and **Timeline**
5. Explore changes safely in **Scenario Lab**

## Pages

| Page | Description |
|------|-------------|
| **Home** (`index.html`) | Overview and status |
| **Builder** (`builder.html`) | Create/edit your financial model |
| **Dashboard** (`dashboard.html`) | Summary cards and charts |
| **Timeline** (`timeline.html`) | Detailed transaction ledger |
| **Scenarios** (`scenarios.html`) | What-if exploration |
| **Storage** (`storage.html`) | Import/export/reset data |

## Technology Stack

- **Bootstrap 5** (CDN) - UI framework
- **Chart.js** (CDN) - Visualizations
- **Luxon** (CDN) - Date/time handling
- **localStorage** - Data persistence

No build process required — just static HTML, CSS, and JavaScript.

## Data Model

### Accounts
- Checking (required)
- Savings
- Reserve

### Rules (Recurring Transactions)
- Income rules (paychecks, etc.)
- Expense rules (bills, subscriptions)
- Transfer rules (savings contributions)

### Recurrence Types
- Monthly on day (e.g., 1st, 15th)
- Semi-monthly (e.g., 1st and 15th)
- Biweekly from anchor date
- Weekly on day of week

### Business Day Adjustment
- None
- Next business day
- Previous business day

## Local Storage Keys

- `fss.baseModel.v1` - Your financial model
- `fss.scenarioDraft.v1` - Active scenario (temporary)
- `fss.ui.v1` - UI preferences (optional)

## Privacy & Security

- **No data leaves your browser** unless you explicitly export it
- **No analytics or tracking** scripts
- **No server communication** — works completely offline
- Only CDN resources loaded are Bootstrap, Chart.js, and Luxon

## File Structure

```
/
├── index.html            # Home page
├── builder.html          # Model builder
├── dashboard.html        # Summary dashboard
├── timeline.html         # Transaction ledger
├── scenarios.html        # Scenario lab
├── storage.html          # Import/export
├── README.md
│
└── assets/
    ├── css/
    │   └── app.css       # Dark theme styles
    └── js/
        ├── app-init.js   # App initialization
        ├── storage.js    # localStorage wrapper
        ├── schema.js     # Data schema & validation
        ├── model.js      # Model CRUD operations
        ├── recurrence.js # Recurring rule expansion
        ├── business-day.js # Business day logic
        ├── ledger.js     # Transaction generation
        ├── summary.js    # Monthly summaries
        ├── overlay.js    # Scenario operations
        ├── debt.js       # Debt calculations
        └── ui/
            ├── builder-ui.js
            ├── dashboard-ui.js
            ├── timeline-ui.js
            ├── scenarios-ui.js
            └── storage-ui.js
```

## Hosting on GitHub Pages

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select "Deploy from a branch"
4. Choose `main` branch, `/ (root)` folder
5. Your app will be live at `https://[username].github.io/[repo-name]/`

## License

MIT License - Use freely for personal or commercial purposes.

---

**Built with privacy in mind. Your finances, your data, your control.**
