// Business Glossary standalone types — mirrors the nested JSON schema

export interface GlossaryItem {
	id: string;
	name: string;
	description: string;
}

export interface GlossaryTerm {
	id: string;
	name: string;
	description: string;
	synonyms: string[];
	category: string;
	steward: string;
	status: string;
	relatedConcepts: GlossaryItem[];
	relatedQuestions: GlossaryItem[];
	order?: number;
	/** Aristotelian definition — broader category (genus): "A [Y] that [Z]" */
	definitionCategory?: string;
	/** Aristotelian definition — distinguishing feature (differentia): "A [Y] that [Z]" */
	definitionDifferentiator?: string;
}

export interface GlossaryModel {
	version: string;
	id: string;
	name: string;
	description: string;
	terms: GlossaryTerm[];
	categories: string[];
	stewards: string[];
	statuses: string[];
}

// Entity type config for the standalone app (subset of Context Plane's full entity type system)
export interface ContextTypeConfig {
	label: string;
	displayName: string;
	color: string;
	shape: string;
	description: string;
}

// Node representation used by canvas components (flat, adapter-compatible)
export interface GlossaryNode {
	id: string;
	label: string;
	name: string;
	description?: string;
	properties?: Record<string, unknown>;
}
