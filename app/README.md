# Business Glossary

Define and manage business terms with shared definitions. Track synonyms, categories, stewards, and approval status for each term.

An [AgileDataGuides](https://agiledataguides.com/agiledata-templates/) Pattern Template app.

## What It Does

The Business Glossary captures and governs the language of your business:

| Section | Purpose |
|---------|---------|
| **Terms** | Business terms with their definitions |
| **Synonyms** | Alternative names for a term |
| **Categories** | Grouping for terms (e.g. Finance, Customer, Product) |
| **Stewards** | Who is responsible for the term's definition |
| **Status** | Approval status (e.g. Draft, Approved, Deprecated) |

## Try It Online

**[Launch the Live Demo](https://agiledataguides.github.io/business-glossary)** — no install required. The demo runs entirely in your browser. Your data is saved in localStorage and never leaves your device.

The demo includes the *SaaS Revenue Glossary* example so you can explore the app straight away.

## Install and Run Locally

For full functionality including file-based storage and Claude Code integration, run it locally.

Run `./start-business-glossary.sh` from the terminal.

The app starts at [http://localhost:5117](http://localhost:5117).

**Requires**: [Node.js](https://nodejs.org/) (v18+).

## Features

- **Glossary canvas** — a table-style layout listing all business terms
- **Multiple models** — create, switch between, and delete glossary models
- **Inline editing** — click a term card to select; double-click to rename
- **Auto-save** — changes persist to browser localStorage
- **Export JSON** — download the glossary to share or re-import
- **Import JSON** — load a previously exported glossary
- **Save to disk** — writes JSON to `data/` for direct access by Claude or other tools

## Works With Claude

Export your glossary as JSON and use it with [Claude Code](https://claude.ai/claude-code) or [Claude Chat](https://claude.ai):

- *"Are there any terms that are missing definitions?"*
- *"Suggest additional terms based on the ones I've already defined"*
- *"Which terms could be synonyms of each other?"*
- *"Draft a data dictionary based on these business terms"*
- *"Review my definitions for clarity and consistency"*

## Data Storage

**Save** writes glossary files to the `data/` folder as JSON. This only works in dev mode (`pnpm dev`) where the server can write to disk. Claude Code can then read these files directly.

**Export** downloads files to your browser's downloads folder for sharing or backup.

**Auto-save** persists the current state to browser localStorage automatically.

**Demo mode** (live demo at GitHub Pages): All data is stored in your browser's localStorage. Nothing is sent to any server. Your glossaries persist between visits but are private to your browser.

## Security

This app is designed to run locally on your own machine. Do not expose it to the internet or deploy it on a public server. The Save feature writes files directly to your filesystem. There is no user authentication, so anyone who can reach the server can read and overwrite your data.

**Demo mode**: The [live demo](https://agiledataguides.github.io/business-glossary) is a static site with no server or backend. All data stays in your browser's localStorage and never leaves your device. There is nothing to attack — no API, no database, no file system access.

If you need to share your work, use the **Export** buttons to download files and share them manually.

## Tech Stack

- [SvelteKit 5](https://svelte.dev/) with Svelte 5 runes
- [Tailwind CSS 4](https://tailwindcss.com/)
- TypeScript
- pnpm

## Licensing

- **Code**: [MIT](./LICENSE)
- **Documentation**: [CC BY-SA 4.0](./docs/LICENSE)
