# Business Glossary Standalone App

**FOR IMMEDIATE RELEASE**
**Date: 2026-03-26**

## A dedicated app for managing business terminology

**Wellington, New Zealand** -- The Business Glossary is now available as a standalone SvelteKit application within the Context Plane ecosystem. Teams can define, categorise, and govern their business vocabulary in one place.

### What Changed

**Glossary term management** -- Create and maintain glossary terms with full definitions, synonyms, categories, data stewards, and approval statuses. Each term moves through a lifecycle: Draft, Approved, or Deprecated.

**Related concepts and business questions** -- Link glossary terms to global concepts and business questions. These links carry through to the Context Plane, where the same term can appear on a Concept Model, Business Event Matrix, or Information Product Canvas.

**Multi-glossary support** -- Organise terms across multiple glossaries. Each glossary scopes its own set of terms while sharing global entities with the wider ecosystem.

**Canvas deduplication with Context Plane** -- The glossary layout component is the single source of truth. The Context Plane imports it directly via pnpm workspace dependency. The component uses the DataAdapter interface and has no knowledge of whether it is running standalone or embedded.

### Why It Matters

Business terminology is the foundation of data governance. When teams disagree on what "Customer" or "Revenue" means, every downstream artefact -- reports, dashboards, data products -- inherits that ambiguity. The Business Glossary gives organisations a controlled, versioned vocabulary that integrates directly with the rest of the Context Plane ecosystem.

---

**Contact:** Context Plane Team
