# A Glossary Imported From a Graph Now Keeps Its Related Concepts

**21 October 2026**

AgileDataGuides today released a fix to the Business Glossary's graph converter, so a glossary imported from a Context Plane graph file keeps every term's Related Concepts and its full lists of categories, stewards and statuses.

## The Problem

The Business Glossary can import a Context Plane graph export as well as its own JSON. In the graph, a Related Concept is marked as both a Concept and a Glossary Term, so the same idea serves both canvases. The converter that turns a graph back into a glossary looked for nodes marked as a Concept and nothing else, so it found none, and every term lost its Related Concepts. The category, steward and status lists also shrank. The converter kept only values some term used, so a status such as "Approved" that no term had reached yet disappeared.

## The Solution

The converter now reads every label on a node, so each term's Related Concepts come back. The category, steward and status lists come back whole, in their saved order.

## Key Benefits

- **Related Concepts stay**: each term keeps the Concepts it was linked to
- **Lookup lists stay whole**: categories, stewards and statuses keep every value and their order
- **Safe round trips**: export a glossary as a graph, import it again, and get the same glossary back

The fix is available now in the Business Glossary app in the Context Plane monorepo, and it reaches the public app at [github.com/AgileDataGuides/business-glossary](https://github.com/AgileDataGuides/business-glossary) on its next publish.
