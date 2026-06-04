import type { GlossaryModel, GlossaryTerm, GlossaryItem, GlossaryNode } from '$lib/types';
import { buildXlsxBlob, downloadXlsx, type SheetSpec } from '$lib/cp-shared-xlsx';

function stripDateTimeSuffix(name: string): string {
	return name.replace(/-\d{4}-\d{2}-\d{2}-\d{6}$/, '');
}


function createId(prefix: string): string {
	const rand = typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID().slice(0, 8)
		: Math.random().toString(36).slice(2, 10);
	return `${prefix}-${rand}`;
}

function slugify(name: string, existing: string[]): string {
	let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
	if (!existing.includes(base)) return base;
	let i = 2;
	while (existing.includes(`${base}-${i}`)) i++;
	return `${base}-${i}`;
}

// --- Single reactive store ---

export const store = $state({
	savedList: [] as { id: string; name: string }[],
	model: {
		version: '1.0',
		id: 'empty',
		name: 'Loading...',
		description: '',
		terms: [],
		categories: [],
		stewards: [],
		statuses: []
	} as GlossaryModel,
	/** Currently selected Glossary Term ID within the model */
	selectedTermId: '' as string,
	dirty: false,
	loaded: false
});

// --- Demo mode (GitHub Pages static build) ---
// When the SvelteKit app is built with `DEMO_BUILD=true VITE_DEMO_MODE=true`
// (the `pnpm build:demo` script), all persistence flips to localStorage. The
// SvelteKit `+server.ts` API routes don't exist on a static GitHub Pages
// deployment, so we shim them. Normal dev / standalone install keeps using
// the API routes against `../data/`.
const DEMO_MODE =
	typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_DEMO_MODE?: string } }).env?.VITE_DEMO_MODE === 'true';
const LS_KEY = 'business-glossary-demo-models';

function lsGetAll(): Record<string, GlossaryModel> {
	try {
		const raw = localStorage.getItem(LS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function lsSaveAll(models: Record<string, GlossaryModel>): void {
	localStorage.setItem(LS_KEY, JSON.stringify(models));
}

// --- API helpers ---

async function apiListModels(): Promise<GlossaryModel[]> {
	if (DEMO_MODE) return Object.values(lsGetAll());
	const res = await fetch('/api/models');
	return res.json();
}

async function apiSaveModel(m: GlossaryModel): Promise<void> {
	if (DEMO_MODE) {
		const all = lsGetAll();
		all[m.id] = m;
		lsSaveAll(all);
		return;
	}
	await fetch(`/api/models/${m.id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(m)
	});
}

async function apiCreateModel(m: GlossaryModel): Promise<void> {
	if (DEMO_MODE) {
		const all = lsGetAll();
		all[m.id] = m;
		lsSaveAll(all);
		return;
	}
	await fetch('/api/models', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(m)
	});
}

async function apiDeleteModel(id: string): Promise<void> {
	if (DEMO_MODE) {
		const all = lsGetAll();
		delete all[id];
		lsSaveAll(all);
		return;
	}
	await fetch(`/api/models/${id}`, { method: 'DELETE' });
}

async function apiGetModel(id: string): Promise<GlossaryModel | null> {
	if (DEMO_MODE) {
		const all = lsGetAll();
		return all[id] ?? null;
	}
	const res = await fetch(`/api/models/${id}`);
	if (!res.ok) {
		console.error(`apiGetModel: GET /api/models/${id} returned ${res.status}`);
		return null;
	}
	return res.json();
}

// --- Init ---

function makeExampleModel(): GlossaryModel {
	return {
		version: '1.0',
		id: 'example-glossary',
		name: 'Data Analytics Glossary',
		description: 'A business glossary for common data analytics terms',
		terms: [
			{
				id: 'term-001',
				name: 'Customer',
				description: 'An individual or organisation that purchases or uses the company\'s products or services',
				synonyms: ['Client', 'Account'],
				category: 'Core Entity',
				steward: 'Head of Customer Data',
				status: 'Approved',
				relatedConcepts: [{ id: 'rc-001', name: 'Customer Lifecycle', description: 'The stages a customer progresses through' }],
				relatedQuestions: [{ id: 'rq-001', name: 'How many active customers do we have?', description: '' }]
			},
			{
				id: 'term-002',
				name: 'Revenue',
				description: 'The total income generated from the sale of goods or services before any expenses are deducted',
				synonyms: ['Income', 'Sales'],
				category: 'Financial',
				steward: 'CFO Office',
				status: 'Approved',
				relatedConcepts: [{ id: 'rc-002', name: 'Revenue Recognition', description: 'The accounting principle for recording revenue' }],
				relatedQuestions: [{ id: 'rq-002', name: 'What is our monthly recurring revenue?', description: '' }]
			}
		],
		categories: ['Core Entity', 'Financial', 'Metric', 'Data Management'],
		stewards: ['Head of Customer Data', 'CFO Office', 'Head of Customer Success', 'Chief Data Officer'],
		statuses: ['Draft', 'Approved', 'Deprecated']
	};
}

export async function initStore() {
	if (store.loaded) return;
	const models = await apiListModels();
	if (models.length === 0) {
		const example = makeExampleModel();
		await apiCreateModel(example);
		store.savedList = [{ id: example.id, name: example.name }];
		store.model = example;
	} else {
		store.savedList = models.map((m) => ({ id: m.id, name: m.name }));
		const lastId = typeof window !== 'undefined' ? localStorage.getItem('gls-current-id') : null;
		const found = models.find((m) => m.id === lastId);
		store.model = found || models[0];
	}
	// Select first term if available
	if (store.model.terms.length > 0) {
		store.selectedTermId = store.model.terms[0].id;
	}
	store.dirty = false;
	store.loaded = true;
}

// --- Model CRUD ---

export async function switchTo(id: string) {
	if (store.dirty) {
		try { await saveModel(); } catch { /* best effort */ }
	}
	const loaded = await apiGetModel(id);
	if (!loaded) {
		console.warn(`switchTo: glossary '${id}' not found`);
		return;
	}
	store.model = loaded;
	store.selectedTermId = store.model.terms[0]?.id || '';
	store.dirty = false;
	if (typeof window !== 'undefined') {
		localStorage.setItem('gls-current-id', id);
	}
}

export async function saveModel() {
	const snapshot = JSON.parse(JSON.stringify(store.model));
	await apiSaveModel(snapshot);
	const idx = store.savedList.findIndex((s) => s.id === store.model.id);
	if (idx >= 0) {
		store.savedList[idx] = { id: store.model.id, name: store.model.name };
	}
	store.dirty = false;
}

function markDirty() {
	store.dirty = true;
}

export async function newModel(name: string) {
	const existingIds = store.savedList.map((s) => s.id);
	const id = slugify(name, existingIds);
	const newM: GlossaryModel = {
		version: '1.0',
		id,
		name,
		description: '',
		terms: [],
		categories: [],
		stewards: [],
		statuses: []
	};
	await apiCreateModel(newM);
	store.savedList = [...store.savedList, { id, name }];
	store.model = newM;
	store.selectedTermId = '';
	store.dirty = false;
	if (typeof window !== 'undefined') {
		localStorage.setItem('gls-current-id', id);
	}
}

export async function deleteModel(id: string) {
	await apiDeleteModel(id);
	store.savedList = store.savedList.filter((s) => s.id !== id);
	if (store.savedList.length > 0) {
		await switchTo(store.savedList[0].id);
	} else {
		const example = makeExampleModel();
		await apiCreateModel(example);
		store.savedList = [{ id: example.id, name: example.name }];
		store.model = example;
		store.selectedTermId = example.terms[0]?.id || '';
	}
	store.dirty = false;
}

export function renameModel(name: string) {
	store.model.name = name;
	markDirty();
}

export function updateDescription(desc: string) {
	store.model.description = desc;
	markDirty();
}

// --- Glossary Term CRUD ---

export function getSelectedTerm(): GlossaryTerm | undefined {
	return store.model.terms.find((t) => t.id === store.selectedTermId);
}

export function selectTerm(id: string) {
	store.selectedTermId = id;
}

export function addTerm(name: string): GlossaryTerm {
	const term: GlossaryTerm = {
		id: createId('term'),
		name,
		description: '',
		synonyms: [],
		category: '',
		steward: '',
		status: '',
		relatedConcepts: [],
		relatedQuestions: [],
		order: store.model.terms.length + 1
	};
	store.model.terms = [...store.model.terms, term];
	store.selectedTermId = term.id;
	markDirty();
	return term;
}

export function removeTerm(id: string) {
	store.model.terms = store.model.terms.filter((t) => t.id !== id);
	if (store.selectedTermId === id) {
		store.selectedTermId = store.model.terms[0]?.id || '';
	}
	markDirty();
}

// --- Node operations for canvas ---

/**
 * Map from entity label to which field on GlossaryTerm it maps to.
 */
const LABEL_TO_FIELD: Record<string, { arrayField?: 'synonyms' | 'relatedConcepts' | 'relatedQuestions'; stringField?: 'category' | 'steward' | 'status' }> = {
	global_glossary_term: {},
	gls_synonym: { arrayField: 'synonyms' },
	gls_category: { stringField: 'category' },
	gls_steward: { stringField: 'steward' },
	gls_status: { stringField: 'status' },
	global_concept: { arrayField: 'relatedConcepts' },
	global_business_question: { arrayField: 'relatedQuestions' }
};

/**
 * Add a node to the current term by entity label.
 */
export function addNodeToTerm(entityLabel: string, name: string): GlossaryNode | null {
	const mapping = LABEL_TO_FIELD[entityLabel];
	if (!mapping) return null;

	// If adding a new glossary term
	if (entityLabel === 'global_glossary_term') {
		const term = addTerm(name);
		return { id: term.id, label: entityLabel, name };
	}

	const term = getSelectedTerm();
	if (!term) return null;

	// String fields (category, steward, status)
	if (mapping.stringField) {
		term[mapping.stringField] = name;
		// Also add to model-level unique lists
		if (mapping.stringField === 'category' && !store.model.categories.includes(name)) {
			store.model.categories = [...store.model.categories, name];
		} else if (mapping.stringField === 'steward' && !store.model.stewards.includes(name)) {
			store.model.stewards = [...store.model.stewards, name];
		} else if (mapping.stringField === 'status' && !store.model.statuses.includes(name)) {
			store.model.statuses = [...store.model.statuses, name];
		}
		markDirty();
		return { id: `${term.id}-${mapping.stringField}`, label: entityLabel, name };
	}

	// Array fields
	if (mapping.arrayField) {
		if (mapping.arrayField === 'synonyms') {
			// Synonyms are simple strings
			term.synonyms = [...term.synonyms, name];
			markDirty();
			return { id: `${term.id}-syn-${term.synonyms.length - 1}`, label: entityLabel, name };
		}
		// relatedConcepts and relatedQuestions are GlossaryItem[]
		const item: GlossaryItem = { id: createId(entityLabel.slice(0, 6)), name, description: '' };
		(term[mapping.arrayField] as GlossaryItem[]).push(item);
		markDirty();
		return { id: item.id, label: entityLabel, name };
	}

	return null;
}

/**
 * Update a node name (inline edit from CanvasCard).
 */
export function updateNodeName(nodeId: string, newName: string) {
	const term = getSelectedTerm();
	if (!term) return;

	// Check if it's the term itself
	const targetTerm = store.model.terms.find((t) => t.id === nodeId);
	if (targetTerm) {
		targetTerm.name = newName;
		markDirty();
		return;
	}

	// Check string fields
	for (const t of store.model.terms) {
		if (nodeId === `${t.id}-category`) { t.category = newName; markDirty(); return; }
		if (nodeId === `${t.id}-steward`) { t.steward = newName; markDirty(); return; }
		if (nodeId === `${t.id}-status`) { t.status = newName; markDirty(); return; }

		// Synonyms
		for (let i = 0; i < t.synonyms.length; i++) {
			if (nodeId === `${t.id}-syn-${i}`) {
				t.synonyms[i] = newName;
				markDirty();
				return;
			}
		}

		// Related concepts
		const rc = t.relatedConcepts.find((c) => c.id === nodeId);
		if (rc) { rc.name = newName; markDirty(); return; }

		// Related questions
		const rq = t.relatedQuestions.find((q) => q.id === nodeId);
		if (rq) { rq.name = newName; markDirty(); return; }
	}
}

/**
 * Flatten a term into GlossaryNode[] for the canvas to render.
 */
export function getNodesForTerm(termId: string): GlossaryNode[] {
	const term = store.model.terms.find((t) => t.id === termId);
	if (!term) return [];

	const nodes: GlossaryNode[] = [];

	// The term itself
	nodes.push({ id: term.id, label: 'global_glossary_term', name: term.name, description: term.description, properties: { order: term.order ?? 0, definitionCategory: term.definitionCategory || '', definitionDifferentiator: term.definitionDifferentiator || '' } });

	// Synonyms
	for (let i = 0; i < term.synonyms.length; i++) {
		nodes.push({ id: `${term.id}-syn-${i}`, label: 'gls_synonym', name: term.synonyms[i] });
	}

	// Category
	if (term.category) {
		nodes.push({ id: `${term.id}-category`, label: 'gls_category', name: term.category });
	}

	// Steward
	if (term.steward) {
		nodes.push({ id: `${term.id}-steward`, label: 'gls_steward', name: term.steward });
	}

	// Status
	if (term.status) {
		nodes.push({ id: `${term.id}-status`, label: 'gls_status', name: term.status });
	}

	// Related concepts
	for (const rc of term.relatedConcepts) {
		nodes.push({ id: rc.id, label: 'global_concept', name: rc.name, description: rc.description });
	}

	// Related questions
	for (const rq of term.relatedQuestions) {
		nodes.push({ id: rq.id, label: 'global_business_question', name: rq.name, description: rq.description });
	}

	return nodes;
}

export function updateTermOrder(id: string, order: number) {
	const term = store.model.terms.find((t) => t.id === id);
	if (!term) return;
	term.order = order;
	markDirty();
}

// --- Sub-item reordering ---

/** Move an item in a string array to a new position (0-based) */
function moveInStringArray(arr: string[], name: string, newIndex: number) {
	const currentIdx = arr.indexOf(name);
	if (currentIdx === -1 || currentIdx === newIndex) return;
	arr.splice(currentIdx, 1);
	arr.splice(Math.min(newIndex, arr.length), 0, name);
}

/** Reorder a model-level list (categories, stewards, or statuses) */
export function reorderModelList(field: 'categories' | 'stewards' | 'statuses', itemName: string, newOrder: number) {
	const arr = store.model[field];
	moveInStringArray(arr, itemName, newOrder - 1);
	markDirty();
}

/** Reorder synonyms within a term */
export function reorderTermSynonyms(termId: string, synonymName: string, newOrder: number) {
	const term = store.model.terms.find((t) => t.id === termId);
	if (!term) return;
	moveInStringArray(term.synonyms, synonymName, newOrder - 1);
	markDirty();
}

/** Reorder related concepts or questions within a term */
export function reorderTermItems(termId: string, field: 'relatedConcepts' | 'relatedQuestions', itemId: string, newOrder: number) {
	const term = store.model.terms.find((t) => t.id === termId);
	if (!term) return;
	const arr = term[field] as GlossaryItem[];
	const currentIdx = arr.findIndex((item) => item.id === itemId);
	if (currentIdx === -1) return;
	const newIndex = Math.min(newOrder - 1, arr.length - 1);
	if (currentIdx === newIndex) return;
	const [item] = arr.splice(currentIdx, 1);
	arr.splice(newIndex, 0, item);
	markDirty();
}

export function updateTermDefinition(id: string, definitionCategory: string, definitionDifferentiator: string) {
	const term = store.model.terms.find((t) => t.id === id);
	if (!term) return;
	term.definitionCategory = definitionCategory;
	term.definitionDifferentiator = definitionDifferentiator;
	markDirty();
}

// --- Import/Export ---

export function exportJSON(): string {
	return JSON.stringify(store.model, null, 2);
}

export function exportAsCsv(): string {
	const headers = ['Term Name', 'Description', 'Definition Category', 'Definition Differentiator', 'Synonyms', 'Category', 'Steward', 'Status', 'Related Concepts', 'Related Questions'];
	const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`;

	const rows = store.model.terms.map((t) => {
		return [
			csvEscape(t.name),
			csvEscape(t.description || ''),
			csvEscape(t.definitionCategory || ''),
			csvEscape(t.definitionDifferentiator || ''),
			csvEscape(t.synonyms.join(', ')),
			csvEscape(t.category || ''),
			csvEscape(t.steward || ''),
			csvEscape(t.status || ''),
			csvEscape(t.relatedConcepts.map((c) => c.name).join(', ')),
			csvEscape(t.relatedQuestions.map((q) => q.name).join(', '))
		].join(',');
	});

	return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

export async function exportAsXlsx() {
	// Sheet 1: Terms
	const headers = ['Term Name', 'Description', 'Definition Category', 'Definition Differentiator', 'Synonyms', 'Category', 'Steward', 'Status', 'Related Concepts', 'Related Questions'];
	const termData = store.model.terms.map((t) => [
		t.name,
		t.description || '',
		t.definitionCategory || '',
		t.definitionDifferentiator || '',
		t.synonyms.join(', '),
		t.category || '',
		t.steward || '',
		t.status || '',
		t.relatedConcepts.map((c) => c.name).join(', '),
		t.relatedQuestions.map((q) => q.name).join(', ')
	]);

	// Sheet 2: Categories, Stewards, Statuses
	const maxLen = Math.max(store.model.categories.length, store.model.stewards.length, store.model.statuses.length, 1);
	const lookupHeaders = ['Categories', 'Stewards', 'Statuses'];
	const lookupRows: string[][] = [];
	for (let i = 0; i < maxLen; i++) {
		lookupRows.push([
			store.model.categories[i] || '',
			store.model.stewards[i] || '',
			store.model.statuses[i] || ''
		]);
	}

	const sheets: SheetSpec[] = [
		{ title: store.model.name, rows: [headers, ...termData] },
		{ title: 'Lookups', rows: [lookupHeaders, ...lookupRows] }
	];

	const blob = await buildXlsxBlob(sheets);
	const slug = store.model.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'export';
	const d = new Date();
	const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
	downloadXlsx(blob, `${slug}-glossary-${ts}.xlsx`);
}

export async function importJSON(json: string) {
	const parsed = JSON.parse(json);
	if (!parsed.id || !parsed.terms) {
		throw new Error('Invalid Glossary model JSON');
	}
	parsed.name = stripDateTimeSuffix(parsed.name || 'imported');
	const existingIds = store.savedList.map((s) => s.id);
	const id = slugify(parsed.name, existingIds);
	parsed.id = id;
	await apiCreateModel(parsed);
	store.savedList = [...store.savedList, { id, name: parsed.name }];
	store.model = parsed;
	store.selectedTermId = parsed.terms[0]?.id || '';
	store.dirty = false;
	if (typeof window !== 'undefined') {
		localStorage.setItem('gls-current-id', id);
	}
}
