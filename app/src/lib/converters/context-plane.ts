/**
 * Bidirectional converter between Glossary native JSON and Context Plane { nodes, links } format.
 */
import type { ContextNode, ContextLink } from '$lib/cp-shared';
import type { GlossaryModel, GlossaryTerm, GlossaryItem } from '$lib/types';

function createId(prefix: string): string {
	const rand = typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID().slice(0, 8)
		: Math.random().toString(36).slice(2, 10);
	return `${prefix}-${rand}`;
}

/** Deterministic slug for stable node IDs */
function nameSlug(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function now(): string {
	return new Date().toISOString();
}

/** Relationship label mapping */
const RELATIONSHIP_MAP: Record<string, string> = {
	gls_synonym: 'also_known_as',
	gls_category: 'categorised_as',
	gls_steward: 'stewarded_by',
	gls_status: 'has_status',
	global_concept: 'defined_by',
	global_business_question: 'asks'
};

/**
 * Convert a GlossaryModel to Context Plane nodes + links format.
 */
export function glossaryToContextPlane(model: GlossaryModel): { nodes: ContextNode[]; links: ContextLink[] } {
	const nodes: ContextNode[] = [];
	const links: ContextLink[] = [];
	const ts = now();

	// Glossary model node (parent container)
	const glossaryNodeId = `gls-model-${model.id}`;
	nodes.push({
		id: glossaryNodeId,
		label: 'gls_glossary',
		name: model.name,
		description: model.description || null,
		properties: { canvas: ['canvas_business_glossary'], sourceId: model.id },
		created_at: ts,
		updated_at: ts
	});

	// Create category/steward/status nodes upfront from model-level arrays (stable IDs + order)
	const categoryNodes = new Map<string, string>();
	for (let ci = 0; ci < model.categories.length; ci++) {
		const catName = model.categories[ci];
		const catNodeId = `gls-cat-${nameSlug(catName)}`;
		categoryNodes.set(catName, catNodeId);
		nodes.push({
			id: catNodeId,
			label: 'gls_category',
			name: catName,
			properties: { canvas: ['canvas_business_glossary'], sourceId: catName, order: ci + 1 },
			created_at: ts,
			updated_at: ts
		});
	}

	const stewardNodes = new Map<string, string>();
	for (let si = 0; si < model.stewards.length; si++) {
		const stewName = model.stewards[si];
		const stewNodeId = `gls-stew-${nameSlug(stewName)}`;
		stewardNodes.set(stewName, stewNodeId);
		nodes.push({
			id: stewNodeId,
			label: 'gls_steward',
			name: stewName,
			properties: { canvas: ['canvas_business_glossary'], sourceId: stewName, order: si + 1 },
			created_at: ts,
			updated_at: ts
		});
	}

	const statusNodes = new Map<string, string>();
	for (let sti = 0; sti < model.statuses.length; sti++) {
		const statName = model.statuses[sti];
		const statNodeId = `gls-status-${nameSlug(statName)}`;
		statusNodes.set(statName, statNodeId);
		nodes.push({
			id: statNodeId,
			label: 'gls_status',
			name: statName,
			properties: { canvas: ['canvas_business_glossary'], sourceId: statName, order: sti + 1 },
			created_at: ts,
			updated_at: ts
		});
	}

	for (let i = 0; i < model.terms.length; i++) {
		const term = model.terms[i];
		// Term node
		const termNodeId = `gls-term-${term.id}`;
		nodes.push({
			id: termNodeId,
			label: 'global_glossary_term',
			name: term.name,
			description: term.description,
			properties: { canvas: ['canvas_business_glossary'], sourceId: term.id, order: term.order ?? i + 1, definitionCategory: term.definitionCategory || '', definitionDifferentiator: term.definitionDifferentiator || '' },
			created_at: ts,
			updated_at: ts
		});

		// Link glossary → term
		links.push({
			id: createId('link'),
			source_id: glossaryNodeId,
			destination_id: termNodeId,
			label: 'has_term',
			properties: {},
			created_at: ts,
			updated_at: ts
		});

		// Synonyms (stable name-based IDs + order)
		for (let si = 0; si < term.synonyms.length; si++) {
			const synName = term.synonyms[si];
			const synNodeId = `gls-syn-${term.id}-${nameSlug(synName)}`;
			nodes.push({
				id: synNodeId,
				label: 'gls_synonym',
				name: synName,
				properties: { canvas: ['canvas_business_glossary'], sourceId: synName, termId: term.id, order: si + 1 },
				created_at: ts,
				updated_at: ts
			});
			links.push({
				id: createId('link'),
				source_id: termNodeId,
				destination_id: synNodeId,
				label: 'also_known_as',
				created_at: ts,
				updated_at: ts
			});
		}

		// Category (link to pre-created node)
		if (term.category) {
			const catNodeId = categoryNodes.get(term.category);
			if (catNodeId) {
				links.push({
					id: createId('link'),
					source_id: termNodeId,
					destination_id: catNodeId,
					label: 'categorised_as',
					created_at: ts,
					updated_at: ts
				});
			}
		}

		// Steward (link to pre-created node)
		if (term.steward) {
			const stewNodeId = stewardNodes.get(term.steward);
			if (stewNodeId) {
				links.push({
					id: createId('link'),
					source_id: termNodeId,
					destination_id: stewNodeId,
					label: 'stewarded_by',
					created_at: ts,
					updated_at: ts
				});
			}
		}

		// Status (link to pre-created node)
		if (term.status) {
			const statusNodeId = statusNodes.get(term.status);
			if (statusNodeId) {
				links.push({
					id: createId('link'),
					source_id: termNodeId,
					destination_id: statusNodeId,
					label: 'has_status',
					created_at: ts,
					updated_at: ts
				});
			}
		}

		// Related Concepts (with order + sourceId)
		for (let rci = 0; rci < term.relatedConcepts.length; rci++) {
			const rc = term.relatedConcepts[rci];
			const rcNodeId = `gls-concept-${rc.id}`;
			nodes.push({
				id: rcNodeId,
				label: 'global_concept,global_glossary_term',
				name: rc.name,
				description: rc.description || undefined,
				properties: { canvas: ['canvas_business_glossary'], sourceId: rc.id, termId: term.id, order: rci + 1 },
				created_at: ts,
				updated_at: ts
			});
			links.push({
				id: createId('link'),
				source_id: termNodeId,
				destination_id: rcNodeId,
				label: 'defined_by',
				created_at: ts,
				updated_at: ts
			});
		}

		// Related Questions (with order + sourceId)
		for (let rqi = 0; rqi < term.relatedQuestions.length; rqi++) {
			const rq = term.relatedQuestions[rqi];
			const rqNodeId = `gls-question-${rq.id}`;
			nodes.push({
				id: rqNodeId,
				label: 'global_business_question',
				name: rq.name,
				description: rq.description || undefined,
				properties: { canvas: ['canvas_business_glossary'], sourceId: rq.id, termId: term.id, order: rqi + 1 },
				created_at: ts,
				updated_at: ts
			});
			links.push({
				id: createId('link'),
				source_id: termNodeId,
				destination_id: rqNodeId,
				label: 'asks',
				created_at: ts,
				updated_at: ts
			});
		}
	}

	return { nodes, links };
}

/**
 * Convert Context Plane nodes + links back to a GlossaryModel.
 */
export function contextPlaneToGlossary(
	data: { nodes: ContextNode[]; links: ContextLink[] },
	modelName?: string
): GlossaryModel {
	const { nodes, links } = data;

	// Find glossary model node (if present)
	const modelNode = nodes.find((n) => n.label === 'gls_glossary');

	// Find all glossary term nodes
	const termNodes = nodes.filter((n) => n.label === 'global_glossary_term');

	const categories = new Set<string>();
	const stewards = new Set<string>();
	const statuses = new Set<string>();

	const terms: GlossaryTerm[] = termNodes.map((termNode) => {
		// Find all links FROM this term node
		const termLinks = links.filter((l) => l.source_id === termNode.id);
		const linkedNodeIds = new Set(termLinks.map((l) => l.destination_id));
		const linkedNodes = nodes.filter((n) => linkedNodeIds.has(n.id));

		function findByLabel(label: string): ContextNode[] {
			return linkedNodes.filter((n) => n.label === label);
		}

		// Synonyms
		const synonyms = findByLabel('gls_synonym').map((n) => n.name);

		// Category
		const categoryNode = findByLabel('gls_category')[0];
		const category = categoryNode?.name || '';
		if (category) categories.add(category);

		// Steward
		const stewardNode = findByLabel('gls_steward')[0];
		const steward = stewardNode?.name || '';
		if (steward) stewards.add(steward);

		// Status
		const statusNode = findByLabel('gls_status')[0];
		const status = statusNode?.name || '';
		if (status) statuses.add(status);

		// Related Concepts
		const relatedConcepts: GlossaryItem[] = findByLabel('global_concept').map((n) => ({
			id: n.properties?.sourceId as string || n.id,
			name: n.name,
			description: n.description || ''
		}));

		// Related Questions
		const relatedQuestions: GlossaryItem[] = findByLabel('global_business_question').map((n) => ({
			id: n.properties?.sourceId as string || n.id,
			name: n.name,
			description: n.description || ''
		}));

		return {
			id: termNode.properties?.sourceId as string || termNode.id,
			name: termNode.name,
			description: termNode.description || '',
			synonyms,
			category,
			steward,
			status,
			relatedConcepts,
			relatedQuestions,
			order: (termNode.properties?.order as number) || undefined,
			definitionCategory: (termNode.properties?.definitionCategory as string) || undefined,
			definitionDifferentiator: (termNode.properties?.definitionDifferentiator as string) || undefined
		};
	});

	return {
		version: '1.0',
		id: modelNode?.properties?.sourceId as string || modelName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'imported',
		name: modelName || modelNode?.name || 'Imported Glossary',
		description: modelNode?.description || '',
		terms,
		categories: Array.from(categories),
		stewards: Array.from(stewards),
		statuses: Array.from(statuses)
	};
}
