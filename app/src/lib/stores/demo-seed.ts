// Demo-mode seed for the Business Glossary standalone GitHub Pages build.
//
// This file imports the example glossary JSON via the `$data` Vite alias
// (defined in `apps/business-glossary/app/vite.config.ts`). It is therefore
// only safe to import from the standalone app's own entrypoints (e.g.
// `+page.svelte`). The Context Plane frontend transitively imports
// `glossary.svelte.ts` through the workspace dependency, but does NOT
// import this file — keeping the `$data`-resolved imports out of CP's
// build graph.
//
// The version-aware overlay logic lives in `@context-plane/shared/demo-seed`.
// This file just declares the bundled JSONs + seed version.
//
// To roll out updated examples to existing visitors, bump SEED_VERSION
// to today's date and re-publish.

import { applyDemoSeeds } from '$lib/cp-shared-demo-seed';
import type { GlossaryModel } from '$lib/types';

import saasRevenueSeed from '$data/saas-revenue-glossary.json';

const LS_KEY = 'business-glossary-demo-models';
const SEED_VERSION_KEY = 'business-glossary-demo-seed-version';

/** Bump when bundled JSONs change. ISO date format. */
const SEED_VERSION = '2026-05-26';

const SEEDS: GlossaryModel[] = [
	saasRevenueSeed as unknown as GlossaryModel
];

/**
 * Apply demo seeds. Call from `+page.svelte` `onMount` BEFORE `initStore()`,
 * gated by `VITE_DEMO_MODE === 'true'`.
 */
export function applyGlossaryDemoSeeds(): void {
	applyDemoSeeds<GlossaryModel>({
		lsKey: LS_KEY,
		seedVersionKey: SEED_VERSION_KEY,
		seedVersion: SEED_VERSION,
		seeds: SEEDS
	});
}
