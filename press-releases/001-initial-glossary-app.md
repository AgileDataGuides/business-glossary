# Business Glossary App Now Available

**26 March 2026**

AgileDataGuides today released the Business Glossary, a free, open-source app that helps data teams define and govern the language of their business. Each glossary captures terms with full definitions, synonyms, categories, data stewards, and approval status, so everyone agrees on what words like "Customer", "Revenue", or "Churn" actually mean.

## The Problem

Every data team has the same argument on repeat: what does "Customer" mean? Is a churned account still a customer? Does "Revenue" mean booked, billed, or recognised? When the definitions live in people's heads — or scattered across spreadsheets, wiki pages, and Slack threads — every report, dashboard, and data product inherits the ambiguity. New joiners re-derive the meanings from scratch, and two teams quietly build the same metric two different ways.

## The Solution

The Business Glossary gives an organisation one controlled, versioned vocabulary. Open the app in a browser, add a term, and write its definition using a genus-differentia structure ("a Subscription is a recurring contract that…") with `@`-mentions that link terms to each other. Tag each term with a category, assign a data steward, and move it through a Draft → Approved → Deprecated lifecycle. Within an hour a team has a complete, shareable glossary that everyone can reference.

Terms link to global concepts and business questions, so the same definition flows through to a Concept Model, Business Event Matrix, or Information Product Canvas — define "Customer" once, use it everywhere.

## How It Works

Run `./start-business-glossary.sh` to launch the app at `localhost:5117`, or try the live demo in your browser with no install. The canvas shows glossary terms in the main column with their definitions rendered inline, and related entities (categories, stewards, statuses, synonyms, concepts, business questions) in supporting columns. Click a term to view it, hover for a quick-look tooltip, double-click to edit. Changes auto-save to a JSON file in the `data/` folder so they're version-controllable, diffable, and Claude-readable.

Multiple glossaries can live side by side via the glossary dropdown. The app ships with a starter "SaaS Revenue Glossary" — 15 terms covering MRR, ARR, ARPU, churn, expansion, and the subscription lifecycle — so users land on a populated app the first time they open it.

## Key Benefits

- **One agreed vocabulary** — every term has one definition, one steward, one status
- **Genus-differentia definitions** — define terms precisely by category and what distinguishes them, with `@`-mentions linking related terms
- **Lifecycle governance** — Draft / Approved / Deprecated so consumers know what they can rely on
- **Cross-canvas reuse** — terms flow to Concept Models, Event Matrices, and Information Product Canvases — define once, use everywhere
- **Claude-readable** — definitions persist as JSON your AI assistant can read and reason over

The Business Glossary is available now at [github.com/AgileDataGuides/business-glossary](https://github.com/AgileDataGuides/business-glossary), with a live browser demo at [agiledataguides.github.io/business-glossary](https://agiledataguides.github.io/business-glossary).
