<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import {
		store,
		initStore,
		selectTerm,
		addNodeToTerm,
		getNodesForTerm,
		updateNodeName,
		updateTermOrder,
		updateTermDefinition,
		reorderModelList,
		reorderTermSynonyms,
		reorderTermItems,
		saveModel,
		newModel,
		deleteModel,
		renameModel,
		updateDescription,
		addTerm,
		removeTerm,
		switchTo,
		importJSON
	} from '$lib/stores/glossary.svelte';
	import { applyGlossaryDemoSeeds } from '$lib/stores/demo-seed';
	import { glossaryToContextPlane, contextPlaneToGlossary } from '$lib/converters/context-plane';
	import { createStandaloneAdapter } from '$lib/adapters/standalone-adapter';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import GlossaryLayout from '$lib/components/canvas/GlossaryLayout.svelte';
	import GlossaryTableView from '$lib/components/canvas/GlossaryTableView.svelte';

	let activeTab = $state<string>('glossary');

	// Model management
	let showSwitcher = $state(false);
	let showNew = $state(false);
	let newModelName = $state('');

	function handleClickOutsideSwitcher(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-model-switcher]')) showSwitcher = false;
	}

	async function handleNew() {
		const name = newModelName.trim();
		if (!name) return;
		await newModel(name);
		newModelName = '';
		showNew = false;
	}

	/**
	 * Import a Glossary file as a NEW glossary (never overwrites the current one).
	 * store.importJSON handles the creation side: it slugifies the imported
	 * name against existing IDs and calls apiCreateModel, so the existing
	 * glossary stays in the list and the new one lands alongside it.
	 *
	 * Accepts native Glossary JSON ({ id, terms, ... }) or a Context Plane
	 * graph export ({ nodes, links }) — the latter is converted via
	 * contextPlaneToGlossary before import.
	 */
	function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			if (file.size > 5 * 1024 * 1024) {
				alert('File too large (max 5MB)');
				return;
			}
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				if (data.nodes && data.links) {
					const glsModel = contextPlaneToGlossary(data);
					await importJSON(JSON.stringify(glsModel));
				} else {
					await importJSON(text);
				}
			} catch {
				alert('Could not parse JSON file');
			}
		};
		input.click();
	}

	async function handleDelete() {
		if (!confirm(`Delete "${store.model.name}"?`)) return;
		await deleteModel(store.model.id);
	}

	let orderSaveTimer: ReturnType<typeof setTimeout>;

	const adapter = createStandaloneAdapter({
		getModel: () => store.model,
		getSavedList: () => store.savedList,
		onUpdateNode: (id, updates) => {
			const node = snapshot.nodes.find((n) => n.id === id);
			const sourceId = (node?.properties?.sourceId as string) || id;
			const nodeLabel = node?.label || '';
			if (updates.name) updateNodeName(id, updates.name);
			if (updates.properties && typeof updates.properties.order === 'number') {
				const newOrder = updates.properties.order as number;
				if (nodeLabel.includes('global_glossary_term')) updateTermOrder(sourceId, newOrder);
				else if (nodeLabel === 'gls_category') reorderModelList('categories', sourceId, newOrder);
				else if (nodeLabel === 'gls_steward') reorderModelList('stewards', sourceId, newOrder);
				else if (nodeLabel === 'gls_status') reorderModelList('statuses', sourceId, newOrder);
				else if (nodeLabel === 'gls_synonym') {
					const termId = node?.properties?.termId as string;
					if (termId) reorderTermSynonyms(termId, sourceId, newOrder);
				} else if (nodeLabel.includes('global_concept')) {
					const termId = node?.properties?.termId as string;
					if (termId) reorderTermItems(termId, 'relatedConcepts', sourceId, newOrder);
				} else if (nodeLabel === 'global_business_question') {
					const termId = node?.properties?.termId as string;
					if (termId) reorderTermItems(termId, 'relatedQuestions', sourceId, newOrder);
				}
				clearTimeout(orderSaveTimer);
				orderSaveTimer = setTimeout(() => saveModel(), 300);
			}
			if (updates.properties && (updates.properties.definitionCategory !== undefined || updates.properties.definitionDifferentiator !== undefined)) {
				updateTermDefinition(sourceId, updates.properties.definitionCategory as string ?? '', updates.properties.definitionDifferentiator as string ?? '');
			}
		},
		onCreateGlossary: async (name) => { await newModel(name); },
		onDeleteGlossary: async (id) => { await deleteModel(id); },
		onRenameGlossary: (name) => { renameModel(name); },
		onUpdateDescription: (desc) => { updateDescription(desc); },
		onAddTerm: (name) => { addTerm(name); },
		onRemoveTerm: (id) => { removeTerm(id); },
		onSwitchTo: async (id) => { await switchTo(id); }
	});
	setContext('dataAdapter', adapter);

	onMount(() => {
		// Apply demo seeds BEFORE initStore so the store sees seeded localStorage
		// as the source of truth on first/cold visit. No-op outside demo mode.
		const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
		if (isDemo) applyGlossaryDemoSeeds();

		initStore();
	});

	const snapshot = $derived(glossaryToContextPlane(store.model));

	function handleSelectNode(id: string) {
		const sourceId = snapshot.nodes.find((n) => n.id === id)?.properties?.sourceId as string;
		if (sourceId) selectTerm(sourceId);
	}

	function handleAddNode(entityLabel: string, name: string) {
		if (entityLabel === 'gls_glossary') newModel(name);
		else addNodeToTerm(entityLabel, name);
	}
</script>

<svelte:window onclick={handleClickOutsideSwitcher} />

<!-- App Header (dark) -->
<header class="bg-slate-900 text-white px-6 py-3 shrink-0">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-lg font-bold tracking-tight">Business Glossary</h1>
			<p class="text-xs text-slate-400 mt-0.5">Define and manage business terms with shared definitions</p>
		</div>
		<div class="flex items-center gap-2" data-model-switcher>
			<div class="relative">
				<button
					onclick={() => (showSwitcher = !showSwitcher)}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-800 text-sm"
				>
					<span class="text-slate-300">{store.model.name}</span>
					<svg class="w-3.5 h-3.5 text-slate-400 transition-transform {showSwitcher ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				{#if showSwitcher}
					<div class="absolute top-full right-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 min-w-[200px]">
						{#each store.savedList as item}
							<button
								onclick={() => { switchTo(item.id); showSwitcher = false; }}
								class="w-full text-left px-4 py-2 text-sm transition-colors {item.id === store.model.id ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-600 hover:bg-slate-50'}"
							>{item.name}</button>
						{/each}
					</div>
				{/if}
			</div>
			{#if showNew}
				<input type="text" placeholder="Glossary name..." bind:value={newModelName} onkeydown={(e) => e.key === 'Enter' && handleNew()} class="px-3 py-1.5 border border-slate-600 bg-slate-800 text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-40 placeholder-slate-500" />
				<button onclick={handleNew} class="px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">Create</button>
				<button onclick={() => { showNew = false; newModelName = ''; }} class="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
			{:else}
				<button onclick={() => (showNew = true)} class="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-800 transition-colors">New Glossary</button>
				<!-- Import sits next to New Glossary because Import IS a creation
				     action — it always lands as a brand-new glossary alongside
				     the existing ones, never overwriting the current one. -->
				<button
					onclick={handleImport}
					class="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-300 border border-slate-600 hover:bg-slate-800 transition-colors"
					title="Import a Glossary JSON file as a new glossary"
				>Import</button>
			{/if}
			<button onclick={handleDelete} class="px-3 py-1.5 text-sm font-medium rounded-lg text-red-400 border border-slate-600 hover:bg-slate-800 transition-colors">Delete</button>
		</div>
	</div>
</header>

{#if store.loaded}
	<div class="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
		<Toolbar bind:activeTab />
	</div>
	<div class="flex-1 overflow-hidden">
		{#if activeTab === 'glossary'}
			<GlossaryLayout
				nodes={snapshot.nodes}
				links={snapshot.links}
				onSelectNode={handleSelectNode}
				onAddNode={handleAddNode}
				showGlossarySelector={false}
				showToolbar={false}
				showTabs={false}
			/>
		{:else if activeTab === 'table'}
			<GlossaryTableView nodes={snapshot.nodes} links={snapshot.links} editable />
		{/if}
	</div>
{:else}
	<div class="flex items-center justify-center h-64 text-slate-400 text-sm">Loading models...</div>
{/if}
