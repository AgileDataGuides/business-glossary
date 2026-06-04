# Business Glossary Adopts the Standard Toolbar and Sub-Header

**30 March 2026**

AgileDataGuides today released a redesigned toolbar and canvas sub-header for the Business Glossary, bringing it into line with the shared design system so the app looks and behaves consistently with the rest of the AgileDataGuides Pattern Template apps.

## The Problem

As more Pattern Template apps shipped — Information Product Canvas, Data Dictionary, Business Event Matrix — each had grown its own slightly different toolbar. Buttons sat in different places, exports lived in different menus, and the glossary's controls didn't quite match its siblings. A team member moving between apps had to relearn where everything was, every time.

## The Solution

The Business Glossary's toolbar was rebuilt to follow the standard three-tier pattern shared across all the apps: a dark app header with the glossary switcher, a toolbar card with the name, description, and export buttons, and a tab row beneath. Glossary-specific actions — JSON export and import — moved out of a central menu and into the glossary's own sub-header, so I/O lives where the glossary work happens.

## How It Works

Glossaries are scoped by a root entity with `has_term` links, so each glossary cleanly owns its terms and multiple glossaries can coexist without their terms bleeding together. The same layout component drives both the standalone app and the embedded view inside the wider AgileDataGuides ecosystem, so the redesign lands in both places at once with no duplicated code.

## Key Benefits

- **Consistent controls** — the same toolbar layout as every other Pattern Template app, so there's nothing to relearn when switching between them
- **I/O where you work** — export and import live in the glossary's own sub-header, not buried in a shared menu
- **Clean multi-glossary scoping** — each glossary owns its terms through an explicit root-entity relationship
- **One component, two contexts** — the standalone app and the embedded view share a single source of truth

The redesign is available now at [github.com/AgileDataGuides/business-glossary](https://github.com/AgileDataGuides/business-glossary).
