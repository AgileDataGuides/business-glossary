# Glossary Sub-Header and Toolbar Redesign

**FOR IMMEDIATE RELEASE**
**Date: 2026-03-30**

## Glossary toolbar and sub-header aligned to the design system

**Wellington, New Zealand** -- The Business Glossary standalone toolbar has been rewritten to follow the Context Plane design system, and a new canvas sub-header brings consistent model management to the embedded glossary view.

### What Changed

**Standalone toolbar rewrite** -- The glossary's standalone app toolbar has been rebuilt to match the design system pattern. Controls are laid out consistently with other standalone apps in the ecosystem.

**Canvas sub-header with green accent** -- When running inside the Context Plane, the glossary canvas now renders its own sub-header bar using green accent styling (text-green-700). The sub-header includes a glossary switcher, New/Delete buttons, and inline-editable name and description fields.

**Root entity scoping** -- Glossaries are now scoped via a `gls_glossary` root entity with `has_term` links. Each glossary owns its terms through this relationship, enabling clean multi-glossary support.

**Export/Import moved to sub-header** -- JSON export and import have been relocated from the centralised GraphToolbar to the glossary's own sub-header. The canvas controls its own I/O.

### Why It Matters

Consistent toolbars reduce cognitive load. Whether a team member is working in the Business Glossary, the Data Dictionary, or the Business Event Matrix, the controls look and behave the same way. Moving I/O into the canvas sub-header means glossary-specific actions live where glossary work happens.

---

**Contact:** Context Plane Team
