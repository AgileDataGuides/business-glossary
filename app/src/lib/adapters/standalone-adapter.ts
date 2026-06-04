import type { DataAdapter, ContextNode, ContextLink } from '$lib/cp-shared';
import type { GlossaryModel } from '$lib/types';
import { glossaryToContextPlane, contextPlaneToGlossary } from '$lib/converters/context-plane';

/**
 * Create a DataAdapter that wraps the glossary store for standalone mode.
 * Converts between ContextNode/ContextLink format and the native GlossaryModel.
 */
export function createStandaloneAdapter(callbacks: {
	getModel: () => GlossaryModel;
	getSavedList: () => { id: string; name: string }[];
	onUpdateNode: (id: string, updates: Partial<ContextNode>) => void;
	onCreateGlossary: (name: string) => Promise<void>;
	onDeleteGlossary: (id: string) => Promise<void>;
	onRenameGlossary: (name: string) => void;
	onUpdateDescription: (desc: string) => void;
	onAddTerm: (name: string) => void;
	onRemoveTerm: (id: string) => void;
	onSwitchTo: (id: string) => Promise<void>;
}): DataAdapter {
	function getSnapshot() {
		return glossaryToContextPlane(callbacks.getModel());
	}

	return {
		async getNodes(filter) {
			const { nodes } = getSnapshot();
			if (filter?.label) return nodes.filter((n) => n.label.includes(filter.label!));
			return nodes;
		},
		async getNode(id) {
			const { nodes } = getSnapshot();
			return nodes.find((n) => n.id === id) ?? null;
		},
		async createNode(input) {
			const now = new Date().toISOString();
			const name = input.name || 'Untitled';
			const label = input.label;

			if (label === 'gls_glossary') {
				await callbacks.onCreateGlossary(name);
			} else if (label === 'global_glossary_term') {
				callbacks.onAddTerm(name);
			}

			// Return a synthetic node
			const { nodes } = getSnapshot();
			const found = nodes.find((n) => n.name === name && n.label.includes(label));
			return found || { id: `temp-${Date.now()}`, label, name, properties: input.properties || null, created_at: now, updated_at: now };
		},
		async updateNode(id, updates) {
			const { nodes } = getSnapshot();
			const node = nodes.find((n) => n.id === id);
			if (!node) return { id, label: '', name: '', ...updates } as ContextNode;

			if (node.label.includes('gls_glossary')) {
				if (updates.name) callbacks.onRenameGlossary(updates.name);
				if (updates.description !== undefined) callbacks.onUpdateDescription(updates.description || '');
			} else {
				callbacks.onUpdateNode(id, updates);
			}

			return { ...node, ...updates } as ContextNode;
		},
		async deleteNode(id) {
			const { nodes } = getSnapshot();
			const node = nodes.find((n) => n.id === id);
			if (!node) return;

			if (node.label.includes('gls_glossary')) {
				await callbacks.onDeleteGlossary((node.properties?.sourceId as string) || id);
			} else if (node.label.includes('global_glossary_term')) {
				const sourceId = (node.properties?.sourceId as string) || id;
				callbacks.onRemoveTerm(sourceId);
			}
		},
		async getLinks(filter) {
			const { links } = getSnapshot();
			if (filter?.label) return links.filter((l) => l.label === filter.label);
			if (filter?.source_id) return links.filter((l) => l.source_id === filter.source_id);
			return links;
		},
		async createLink(input) {
			const now = new Date().toISOString();
			// has_term links are structural — handled by glossary → term relationship in the model
			return { id: `temp-${Date.now()}`, ...input, created_at: now, updated_at: now } as ContextLink;
		},
		async deleteLink() {
			// Links are structural in standalone mode
		},
		async exportAll() { return getSnapshot(); },
		async importAll(data) {
			// Handled at the store level
		}
	};
}
