# P007-A — Ecommerce Profitability & Promotion Decision Lab

**REAL WORKING PUBLIC PROJECT / PUBLIC-SAFE DEMO DATA / NOT CLIENT RESULT**  
**SYNTHETIC DEMO — NOT CLIENT DATA**

P007-A is a deterministic ecommerce promotion decision-support demo. It compares contribution economics for percentage-discount and Buy-N/Pay-M scenarios using user-supplied assumptions. It does not predict customer demand, prove sales uplift, or represent a client engagement.

## Run locally

No build step or dependency install is required.

Open `index.html` directly in a browser, or serve this directory with any local static server.

Run deterministic development checks with:

```bash
node tests.js
```

Development checks only — not independent validation or commercial performance evidence.

## What the first slice models

The tool calculates baseline contribution economics, then compares 2–4 promotion scenarios using either percentage discounts or Buy-N/Pay-M structures. It shows contribution/order, total contribution, contribution delta vs baseline, revenue-discount amount, break-even order change and an order-change sensitivity table.

Promotion adoption and expected order change are explicitly **user-supplied assumptions, not predictions**. The conditional summary only identifies the highest modelled contribution under the assumptions currently entered.

## Slice 1 limitations

- single representative SKU economics;
- user-supplied behaviour assumptions;
- no hidden market benchmarks;
- no tax/VAT modelling;
- no currency conversion;
- no platform integration;
- no backend, database, login, analytics or cloud persistence;
- no multi-SKU/product-mix optimisation;
- no inventory planning or forecasting model;
- no production reliability claim;
- no historical client ROI claim.

This project does **not** claim demand prediction, sales uplift, conversion prediction, client outcomes, paid pricing-consulting history, or Shopify/Etsy/Amazon implementation history.

## Data and network boundary

The default dataset is synthetic. The implementation contains only local HTML, CSS and JavaScript files and is designed to make no external network requests.

## Acceptance coverage

`tests.js` covers frozen deterministic acceptance tests T1–T10 plus extra checks for the supplied synthetic demo fixture and money display without visible binary floating artefacts.
