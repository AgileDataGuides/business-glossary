import type { ContextTypeConfig } from '$lib/types';

export const CONTEXT_TYPES: Record<string, ContextTypeConfig> = {
	global_glossary_term: {
		label: 'global_glossary_term',
		displayName: 'Glossary Term',
		color: '#14532d',
		shape: 'round-rectangle',
		description: 'A business term with its definition'
	},
	gls_synonym: {
		label: 'gls_synonym',
		displayName: 'Synonym/Alias',
		color: '#065f46',
		shape: 'round-rectangle',
		description: 'An alternate name for a glossary term'
	},
	gls_category: {
		label: 'gls_category',
		displayName: 'Category',
		color: '#047857',
		shape: 'round-rectangle',
		description: 'A grouping for glossary terms'
	},
	gls_steward: {
		label: 'gls_steward',
		displayName: 'Data Steward',
		color: '#059669',
		shape: 'round-rectangle',
		description: 'The person or role accountable for a glossary term'
	},
	gls_status: {
		label: 'gls_status',
		displayName: 'Status',
		color: '#10b981',
		shape: 'round-rectangle',
		description: 'The approval status of a glossary term'
	},
	global_concept: {
		label: 'global_concept',
		displayName: 'Concept',
		color: '#e11d48',
		shape: 'round-rectangle',
		description: 'A conceptual model concept'
	},
	global_business_question: {
		label: 'global_business_question',
		displayName: 'Business Question',
		color: '#0ea5e9',
		shape: 'round-rectangle',
		description: 'A business question'
	}
};

export function getContextType(label: string): ContextTypeConfig | undefined {
	return CONTEXT_TYPES[label];
}
