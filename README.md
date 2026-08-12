# Lucent P&L — Income Statement Intelligence

Lucent P&L is a static, local-first financial analytics application that converts accounting workbooks into a controlled management Income Statement. It detects source structure, requests confirmation when mappings are uncertain, excludes probable balance-sheet and subtotal rows, and calculates only the financial lines supported by the data.

## Supported sources

- Excel `.xlsx` and `.xls`
- Comma-separated `.csv`
- Long transaction tables with account, amount, and optional date/dimension columns
- Wide monthly trial-balance layouts with one column per accounting period
- Additional dimensions such as department, cost center, branch, business unit, currency, scenario, and source classification

## Analytical features

- Header-name-based schema detection and user-confirmed column mapping
- Automated data-quality checks with visible exclusions and warnings
- Persistent account classification manager stored in browser `localStorage`
- Financial safeguards for probable balance-sheet accounts and source subtotals
- Dynamic P&L hierarchy, comparative KPIs, margins, and variance semantics
- Cross-filtering for available organizational dimensions
- Trend, expense-composition, and profitability-waterfall visuals
- Positive and negative profit drivers, deterministic insights, and management-attention items
- Source-record drill-down with search, pagination, and CSV export
- Filtered statement export and A4 landscape print/PDF layout
- Responsive desktop, tablet, and mobile interface

## Financial processing

Files are parsed entirely in browser memory. Data is normalized for whitespace, accounting negatives, numeric strings, blank values, Excel dates, and month-column layouts. Source rows that appear to be subtotals are identified and excluded to avoid double counting. Account classifications supplied in the workbook are used when reliable; otherwise deterministic name/code rules suggest classifications for review.

Revenue and other income are presented with positive management-reporting signs. Expenses retain positive cost values and are subtracted in the calculation engine. Gross Profit, EBITDA, EBIT, Profit Before Tax, Net Profit, and margins are shown only when the required classifications exist. Missing lines are never invented.

## Privacy

Uploaded financial records are not transmitted or persisted. Only user-approved account-to-classification preferences are stored locally in the browser. The application has no backend or database.

## Run locally

Serve the repository from any static web server:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`, then upload an XLSX, XLS, or CSV file.

## GitHub Pages

The repository is ready for GitHub Pages with `index.html` at the root. In repository settings, set Pages to deploy from the `main` branch and `/ (root)` if it is not already enabled.

## Technology

HTML5, custom CSS, and modular Vanilla JavaScript. Locally vendored SheetJS performs browser-side workbook parsing and Chart.js renders responsive financial charts. No build step, CDN dependency, or server is required.

---

Built by **X Academy** — *Learn. Analyse. Lead.*
