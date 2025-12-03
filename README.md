# Budget Copilot

A single-page web app for personal budgeting that simulates AI-assisted statement scanning, transaction categorization, and budget planning. Data stays in the browser via `localStorage`.

## Features

- **Scan documents**: drag-and-drop or select a statement image/PDF to simulate OCR extraction and auto-categorize expenses.
- **Transactions**: review every expense, fix categories, and teach the model through your corrections.
- **Budget plan**: set category targets, choose rollover vs. monthly reset, and track spending against the plan.

## Running locally

No build tools required. Serve the root directory with any static server (for example `python -m http.server 8000`) and open the site in your browser.
