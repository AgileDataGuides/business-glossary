<script lang="ts">
	import CanvasSection from '$lib/components/canvas/CanvasSection.svelte';
	import GlossaryTableView from '$lib/components/canvas/GlossaryTableView.svelte';
	import ConceptCardEditModal from '$lib/components/canvas/ConceptCardEditModal.svelte';
	import type { ContextNode, ContextLink } from '$lib/cp-shared';
	import type { DataAdapter } from '$lib/cp-shared';
	import { getNodeLabels } from '$lib/cp-shared';
	import { getContext } from 'svelte';

	let {
		nodes,
		links = [],
		onSelectNode,
		onAddNode,
		onAddExisting,
		onExportJson,
		onImportJson,
		showGlossarySelector = true,
		showSwitcher,
		showToolbar = true,
		showTabs = true,
		controlledModelId,
		onModelListChange,
		// Opt-in: when both `activeGlossaryTab` and `onGlossaryTabChange` are
		// provided, the internal Tier 3 tab strip renders as `Canvas | Table`
		// and the layout body switches between the canvas grid and a
		// GlossaryTableView. Used by CP to give its embedded Glossary the
		// Canvas/Table split that previously sat in the CP page wrapper —
		// keeps the tabs in the layout's existing strip instead of stacking
		// a duplicate strip above. SA app passes neither and continues to
		// drive tabs from its external Toolbar — these props are inert there.
		activeGlossaryTab,
		onGlossaryTabChange
	}: {
		nodes: ContextNode[];
		links?: ContextLink[];
		onSelectNode: (id: string) => void;
		onAddNode: (entityLabel: string, name: string) => void;
		onAddExisting?: (entityLabel: string) => void;
		onExportJson?: (glossaryName: string) => void;
		onImportJson?: () => Promise<void>;
		showGlossarySelector?: boolean;
		showSwitcher?: boolean;
		showToolbar?: boolean;
		showTabs?: boolean;
		controlledModelId?: string | null;
		onModelListChange?: (models: { id: string; name: string }[], selectedId: string | null) => void;
		activeGlossaryTab?: 'canvas' | 'table';
		onGlossaryTabChange?: (tab: 'canvas' | 'table') => void;
	} = $props();

	// True when the caller has opted into the layout-owned Canvas/Table
	// tab toggle. SA app gets the legacy single-tab look.
	const tabsControlled = $derived(activeGlossaryTab !== undefined && onGlossaryTabChange !== undefined);

	// Backward-compat: legacy showGlossarySelector maps to showSwitcher when not explicitly set
	const effectiveShowSwitcher = $derived(showSwitcher ?? showGlossarySelector);

	let importing = $state(false);

	const adapter = getContext<DataAdapter>('dataAdapter');

	// ── Derived: glossary model nodes ──
	const glossaryNodes = $derived(nodes.filter((n) => getNodeLabels(n).includes('gls_glossary')));
	let selectedGlossaryId = $state<string | null>(null);

	// Auto-select first glossary (or respect controlledModelId from parent)
	$effect(() => {
		if (controlledModelId !== undefined && controlledModelId !== null) {
			selectedGlossaryId = controlledModelId;
		} else if (glossaryNodes.length > 0 && (!selectedGlossaryId || !glossaryNodes.find((n) => n.id === selectedGlossaryId))) {
			selectedGlossaryId = glossaryNodes[0].id;
		}
	});

	// Notify parent of glossary list changes (for CP sidebar switcher)
	$effect(() => {
		if (onModelListChange) {
			const models = glossaryNodes.map((n) => ({ id: n.id, name: n.name }));
			onModelListChange(models, selectedGlossaryId);
		}
	});

	const selectedGlossary = $derived(glossaryNodes.find((n) => n.id === selectedGlossaryId) ?? null);

	// Get term nodes linked to the selected glossary via has_term links
	const termLinks = $derived(
		selectedGlossaryId
			? links.filter((l) => l.source_id === selectedGlossaryId && l.label === 'has_term')
			: []
	);
	const termNodeIds = $derived(new Set(termLinks.map((l) => l.destination_id)));

	// All nodes grouped by label
	const byLabel = $derived.by(() => {
		const map: Record<string, ContextNode[]> = {};
		for (const node of nodes) {
			for (const label of getNodeLabels(node)) {
				if (!map[label]) map[label] = [];
				map[label].push(node);
			}
		}
		return map;
	});

	const get = (label: string) => byLabel[label] || [];

	// Terms filtered to selected glossary (or all terms if no glossary nodes exist — backward compat)
	const glossaryTerms = $derived.by(() => {
		const allTerms = get('global_glossary_term');
		if (glossaryNodes.length === 0) return allTerms; // No glossary nodes → show all (legacy data)
		return allTerms.filter((n) => termNodeIds.has(n.id));
	});

	// Related nodes: only those linked FROM glossary terms (scoped to selected glossary)
	const glossaryTermIds = $derived(new Set(glossaryTerms.map((n) => n.id)));
	const termOutLinks = $derived(links.filter((l) => glossaryTermIds.has(l.source_id)));
	const termLinkedNodeIds = $derived(new Set(termOutLinks.map((l) => l.destination_id)));

	function getScoped(label: string): ContextNode[] {
		const all = get(label);
		if (glossaryNodes.length === 0) return all; // Legacy: show all
		return all.filter((n) => termLinkedNodeIds.has(n.id));
	}

	// ── Drag-and-drop reordering for terms ──
	let dragId = $state<string | null>(null);
	let dropTargetId = $state<string | null>(null);
	let dropPosition = $state<'before' | 'after'>('before');

	function clearDragState() {
		dragId = null;
		dropTargetId = null;
		dropPosition = 'before';
	}

	function handleDragStart(e: DragEvent, id: string) {
		dragId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}

	function handleDragOverRow(e: DragEvent, targetId: string) {
		if (!dragId || dragId === targetId) return;
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dropPosition = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
		dropTargetId = targetId;
	}

	const sortedTerms = $derived(
		[...glossaryTerms].sort((a, b) => ((a.properties?.order as number) || 0) - ((b.properties?.order as number) || 0))
	);

	// ── Search filter for terms ──
	let termSearchQuery = $state('');

	const filteredTerms = $derived.by(() => {
		const q = termSearchQuery.toLowerCase().trim();
		if (!q) return sortedTerms;
		return sortedTerms.filter((n) => n.name.toLowerCase().includes(q));
	});

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (!dragId || !dropTargetId || dragId === dropTargetId) { clearDragState(); return; }
		const sorted = [...sortedTerms];
		const dragIdx = sorted.findIndex((n) => n.id === dragId);
		let dropIdx = sorted.findIndex((n) => n.id === dropTargetId);
		if (dragIdx === -1 || dropIdx === -1) { clearDragState(); return; }
		const [moved] = sorted.splice(dragIdx, 1);
		dropIdx = sorted.findIndex((n) => n.id === dropTargetId);
		const insertIdx = dropPosition === 'after' ? dropIdx + 1 : dropIdx;
		sorted.splice(insertIdx, 0, moved);
		for (let i = 0; i < sorted.length; i++) {
			const node = sorted[i];
			const newOrder = i + 1;
			if ((node.properties?.order as number) !== newOrder) {
				await adapter.updateNode(node.id, { properties: { ...node.properties, order: newOrder } });
			}
		}
		clearDragState();
	}

	// Inline add for Glossary Terms
	let addingTerm = $state(false);
	let newTermName = $state('');
	let termInputEl = $state<HTMLInputElement | null>(null);

	function startAddingTerm() {
		addingTerm = true;
		newTermName = '';
		setTimeout(() => termInputEl?.focus(), 0);
	}

	async function submitAddTerm() {
		const trimmed = newTermName.trim();
		if (!trimmed) { addingTerm = false; return; }
		// Create term node and link it to the selected glossary
		const newTerm = await adapter.createNode({
			label: 'global_glossary_term',
			name: trimmed,
			properties: { canvas: ['canvas_business_glossary'], order: glossaryTerms.length + 1 }
		});
		if (selectedGlossaryId && newTerm) {
			await adapter.createLink({
				source_id: selectedGlossaryId,
				destination_id: newTerm.id,
				label: 'has_term'
			});
		}
		newTermName = '';
		addingTerm = false;
	}

	function handleTermKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); submitAddTerm(); }
		else if (e.key === 'Escape') { addingTerm = false; newTermName = ''; }
	}

	// ── Hover tooltip for Glossary Term cards. Same pattern as the BEM
	// concept/domain tooltips: hover the card → tooltip appears with name,
	// definition, synonyms, category/steward/status chips, description.
	// Click "Edit details" inside the tooltip → opens the term edit modal.
	let tooltipId = $state<string | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let hideTooltipTimeout: ReturnType<typeof setTimeout> | null = null;
	const TERM_COLOR = '#14532d';   // green-900 — matches gls glossary term entity
	const TERM_BORDER = '#bbf7d0';  // green-200 — soft accent border

	function showTooltipFor(id: string, el: HTMLElement) {
		if (hideTooltipTimeout) { clearTimeout(hideTooltipTimeout); hideTooltipTimeout = null; }
		const r = el.getBoundingClientRect();
		tooltipX = r.left + r.width / 2;
		tooltipY = r.bottom;
		tooltipId = id;
	}
	function scheduleHideTooltip() {
		hideTooltipTimeout = setTimeout(() => { tooltipId = null; }, 200);
	}
	function cancelHideTooltip() {
		if (hideTooltipTimeout) { clearTimeout(hideTooltipTimeout); hideTooltipTimeout = null; }
	}

	const tooltipItem = $derived.by(() => {
		if (!tooltipId) return null;
		const term = filteredTerms.find((n) => n.id === tooltipId);
		if (!term) return null;
		const p = term.properties || {};
		return {
			name: term.name,
			description: term.description || '',
			synonyms: (p.aliases as string[]) || (p.synonyms as string[]) || [],
			category: (p.category as string) || '',
			steward: (p.steward as string) || '',
			status: (p.status as string) || '',
			definitionCategory: (p.definitionCategory as string) || '',
			definitionDifferentiator: (p.definitionDifferentiator as string) || '',
			notes: (p.notes as string) || ''
		};
	});

	// ── Edit modal for cards OTHER than glossary terms (Concepts, Synonyms,
	// Categories, Stewards, Statuses, Business Questions, etc). Delegates to
	// the shared ConceptCardEditModal. Glossary terms have a richer dedicated
	// modal below (definition genus/differentia + @-mention to other terms).
	let conceptModalId = $state<string | null>(null);
	const conceptModalNode = $derived(
		conceptModalId ? nodes.find((n) => n.id === conceptModalId) ?? null : null
	);
	function handleCardSelect(id: string) {
		const node = nodes.find((n) => n.id === id);
		// Glossary terms keep their existing inline term modal; everything
		// else opens the shared rich-card popup so Concepts, Synonyms,
		// Categories, Stewards, Statuses and Business Questions all behave
		// consistently with the same UX as BEM + Concept Model.
		if (node && !getNodeLabels(node).includes('global_glossary_term')) {
			conceptModalId = id;
		} else {
			onSelectNode(id);
		}
	}

	// ── Edit modal for term definition ──
	let editModalId = $state<string | null>(null);
	let editModalName = $state('');
	let editModalAliases = $state('');
	let editModalDesc = $state('');
	let editModalDefCategory = $state('');
	let editModalDefDifferentiator = $state('');
	let defCatQuery = $state('');
	let defCatFocusIdx = $state(-1);
	let showDefCatDropdown = $state(false);

	const defCatSuggestions = $derived.by(() => {
		const q = defCatQuery.toLowerCase().trim();
		if (!q) return [];
		const termNodes = get('global_glossary_term') || [];
		const conceptNodes = get('global_concept') || [];
		const all = [...termNodes, ...conceptNodes];
		return all
			.filter((n) => n.id !== editModalId && n.name.toLowerCase().includes(q))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, 8);
	});

	function handleDefCatInput() {
		defCatQuery = editModalDefCategory;
		showDefCatDropdown = defCatSuggestions.length > 0;
		defCatFocusIdx = -1;
	}

	function selectDefCatConcept(concept: ContextNode) {
		editModalDefCategory = concept.name;
		defCatQuery = '';
		showDefCatDropdown = false;
		defCatFocusIdx = -1;
	}

	function handleDefCatKeydown(e: KeyboardEvent) {
		if (!showDefCatDropdown) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			defCatFocusIdx = Math.min(defCatFocusIdx + 1, defCatSuggestions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			defCatFocusIdx = Math.max(defCatFocusIdx - 1, -1);
		} else if (e.key === 'Enter' && defCatFocusIdx >= 0) {
			e.preventDefault();
			selectDefCatConcept(defCatSuggestions[defCatFocusIdx]);
		} else if (e.key === 'Escape') {
			showDefCatDropdown = false;
		}
	}

	// ── @mention in differentiator ──
	let mentionQuery = $state('');
	let mentionStartPos = $state(-1);
	let showMentionDropdown = $state(false);
	let mentionFocusIdx = $state(-1);
	let mentionInputEl = $state<HTMLInputElement | null>(null);

	const mentionSuggestions = $derived.by(() => {
		const q = mentionQuery.toLowerCase().trim();
		if (!q) return [] as ContextNode[];
		const termNodes = get('global_glossary_term') || [];
		return termNodes
			.filter((n: ContextNode) => n.id !== editModalId && n.name.toLowerCase().includes(q))
			.sort((a: ContextNode, b: ContextNode) => a.name.localeCompare(b.name))
			.slice(0, 8);
	});

	function handleDiffInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const pos = input.selectionStart ?? 0;
		const text = editModalDefDifferentiator.substring(0, pos);
		let atPos = -1;
		for (let i = text.length - 1; i >= 0; i--) {
			if (text[i] === '@') { atPos = i; break; }
			if (text[i] === '}') break;
		}
		if (atPos >= 0) {
			const after = text.substring(atPos + 1);
			if (after.includes('{')) {
				if (after.includes('}')) { showMentionDropdown = false; return; }
				mentionQuery = after.substring(1);
			} else {
				mentionQuery = after;
			}
			mentionStartPos = atPos;
			showMentionDropdown = mentionQuery.length > 0;
			mentionFocusIdx = -1;
		} else {
			showMentionDropdown = false;
		}
	}

	function selectMention(term: ContextNode) {
		const input = mentionInputEl;
		const pos = input?.selectionStart ?? editModalDefDifferentiator.length;
		const before = editModalDefDifferentiator.substring(0, mentionStartPos);
		const after = editModalDefDifferentiator.substring(pos);
		editModalDefDifferentiator = before + '@{' + term.name + '} ' + after;
		showMentionDropdown = false;
		mentionFocusIdx = -1;
		const newPos = before.length + term.name.length + 4;
		setTimeout(() => { if (input) { input.focus(); input.setSelectionRange(newPos, newPos); } }, 0);
	}

	function handleDiffKeydown(e: KeyboardEvent) {
		if (!showMentionDropdown || mentionSuggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			mentionFocusIdx = Math.min(mentionFocusIdx + 1, mentionSuggestions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			mentionFocusIdx = Math.max(mentionFocusIdx - 1, -1);
		} else if (e.key === 'Enter' && mentionFocusIdx >= 0) {
			e.preventDefault();
			selectMention(mentionSuggestions[mentionFocusIdx]);
		} else if (e.key === 'Escape') {
			showMentionDropdown = false;
		}
	}

	function openEditModal(id: string) {
		const node = nodes.find((n) => n.id === id && getNodeLabels(n).includes('global_glossary_term'));
		if (!node) return;
		editModalId = id;
		editModalName = node.name;
		editModalAliases = ((node.properties?.aliases as string[]) || []).join(', ');
		editModalDesc = node.description || '';
		editModalDefCategory = (node.properties?.definitionCategory as string) || '';
		editModalDefDifferentiator = (node.properties?.definitionDifferentiator as string) || '';
		defCatQuery = '';
		showDefCatDropdown = false;
		defCatFocusIdx = -1;
		showMentionDropdown = false;
		mentionFocusIdx = -1;
	}

	async function saveEditModal() {
		if (!editModalId) return;
		const aliases = editModalAliases.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
		await adapter.updateNode(editModalId, {
			name: editModalName,
			description: editModalDesc,
			properties: { aliases, definitionCategory: editModalDefCategory, definitionDifferentiator: editModalDefDifferentiator }
		});
		editModalId = null;
	}

	/**
	 * Delete the glossary term currently open in the edit modal. Confirms before
	 * deletion (destructive) and closes the modal on success.
	 */
	async function deleteFromEditModal() {
		if (!editModalId) return;
		const ok = window.confirm(
			`Delete glossary term "${editModalName || 'this term'}"?\n\nThis cannot be undone.`
		);
		if (!ok) return;
		try {
			await adapter.deleteNode(editModalId);
		} catch (e) {
			alert(`Failed to delete: ${e instanceof Error ? e.message : String(e)}`);
			return;
		}
		editModalId = null;
	}

	// ── Glossary switcher ──
	let showGlossarySwitcher = $state(false);

	// ── Editable name / description ──
	let editingGlossaryName = $state(false);
	let editingGlossaryNameValue = $state('');
	let editingGlossaryDesc = $state(false);
	let editingGlossaryDescValue = $state('');

	function autofocus(node: HTMLInputElement | HTMLTextAreaElement) {
		node.focus();
		if ('select' in node) node.select();
	}

	async function handleGlossaryNameChange(newName: string) {
		editingGlossaryName = false;
		if (!selectedGlossaryId || !newName.trim()) return;
		await adapter.updateNode(selectedGlossaryId, {
			label: 'gls_glossary',
			name: newName.trim()
		});
	}

	async function handleGlossaryDescChange(newDesc: string) {
		editingGlossaryDesc = false;
		if (!selectedGlossaryId) return;
		await adapter.updateNode(selectedGlossaryId, {
			label: 'gls_glossary',
			name: selectedGlossary?.name ?? '',
			description: newDesc.trim()
		});
	}

	async function handleCreateGlossary() {
		const name = prompt('Glossary name:');
		if (!name) return;
		const newGls = await adapter.createNode({
			label: 'gls_glossary',
			name,
			properties: { canvas: ['canvas_business_glossary'] }
		});
		if (newGls) selectedGlossaryId = newGls.id;
	}

	async function handleDeleteGlossary() {
		if (!selectedGlossaryId || !selectedGlossary) return;
		if (!confirm(`Delete glossary "${selectedGlossary.name}"? This will also remove all its terms.`)) return;
		// Delete all term links and term nodes first
		for (const link of termLinks) {
			await adapter.deleteLink(link.id);
		}
		for (const term of glossaryTerms) {
			await adapter.deleteNode(term.id);
		}
		await adapter.deleteNode(selectedGlossaryId);
		selectedGlossaryId = null;
	}
</script>

<div class="flex-1 overflow-auto p-4">
	<!-- Tier 1: Header — Glossary switcher + New + Delete -->
	{#if effectiveShowSwitcher}
	<div class="bg-white border border-slate-200 rounded-lg px-4 py-2.5 mb-2">
		<div class="flex items-center gap-2">
			<div class="relative" data-glossary-switcher>
				<button
					onclick={() => (showGlossarySwitcher = !showGlossarySwitcher)}
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100"
				>
					<div class="text-left">
						<div class="text-sm font-semibold text-slate-800 leading-tight">{selectedGlossary?.name ?? 'No glossary'}</div>
						<div class="text-[10px] text-slate-400 leading-tight">Switch glossary</div>
					</div>
					<svg class="w-4 h-4 text-slate-400 transition-transform {showGlossarySwitcher ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if showGlossarySwitcher}
					<div class="absolute top-full left-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1 min-w-[200px]">
						{#each glossaryNodes as gls}
							<button
								onclick={() => { selectedGlossaryId = gls.id; showGlossarySwitcher = false; }}
								class="w-full text-left px-4 py-2 text-sm transition-colors {gls.id === selectedGlossaryId ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-600 hover:bg-slate-50'}"
							>
								{gls.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<button
				class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-green-700 border border-green-300 hover:bg-green-50 transition-colors"
				onclick={handleCreateGlossary}
			>
				New Glossary
			</button>
			{#if selectedGlossary && glossaryNodes.length > 0}
				<button
					class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-red-500 border border-red-300 hover:bg-red-50 transition-colors"
					onclick={handleDeleteGlossary}
				>
					Delete
				</button>
			{/if}
		</div>
	</div>

	{/if}

	<!-- Tier 2: Toolbar — Name/Desc + Export (Import moved to sidebar in CP) -->
	{#if selectedGlossary && showToolbar}
		<div class="bg-white border border-slate-200 rounded-lg mb-2">
			<div class="flex items-center justify-between px-4 py-2.5">
				<div class="flex items-center gap-3 min-w-0">
					<div class="min-w-0">
						{#if editingGlossaryName}
							<input
								use:autofocus
								type="text"
								bind:value={editingGlossaryNameValue}
								onblur={() => handleGlossaryNameChange(editingGlossaryNameValue)}
								onkeydown={(e) => { if (e.key === 'Enter') handleGlossaryNameChange(editingGlossaryNameValue); if (e.key === 'Escape') { editingGlossaryName = false; } }}
								class="text-sm font-semibold text-slate-800 px-1 border border-blue-400 rounded outline-none w-64"
							/>
						{:else}
							<button
								class="text-sm font-semibold text-slate-800 leading-tight cursor-pointer hover:text-slate-600 transition-colors text-left truncate max-w-md"
								onclick={() => { editingGlossaryNameValue = selectedGlossary!.name; editingGlossaryName = true; }}
								title="Click to edit name"
							>{selectedGlossary.name}</button>
						{/if}
						{#if editingGlossaryDesc}
							<input
								use:autofocus
								type="text"
								bind:value={editingGlossaryDescValue}
								onblur={() => handleGlossaryDescChange(editingGlossaryDescValue)}
								onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGlossaryDescChange(editingGlossaryDescValue); } if (e.key === 'Escape') { editingGlossaryDesc = false; } }}
								placeholder="Add a description..."
								class="text-[10px] text-slate-500 px-1 border border-blue-400 rounded outline-none w-full mt-0.5"
							/>
						{:else}
							<button
								class="block text-[10px] leading-tight mt-0.5 truncate max-w-md text-left cursor-pointer transition-colors {selectedGlossary.description ? 'text-slate-400 hover:text-slate-600' : 'text-slate-300 italic hover:text-slate-500'}"
								onclick={() => { editingGlossaryDescValue = selectedGlossary!.description || ''; editingGlossaryDesc = true; }}
								title="Click to edit description"
							>{selectedGlossary.description || 'Click to add a description'}</button>
						{/if}
					</div>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					{#if onExportJson}
						<button
							class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
							onclick={() => onExportJson(selectedGlossary?.name ?? '')}
						>
							Export JSON
						</button>
					{/if}
					{#if onImportJson}
						<button
							class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
							disabled={importing}
							onclick={async () => { importing = true; try { await onImportJson!(); } finally { importing = false; } }}
						>
							{importing ? 'Importing...' : 'Import JSON'}
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Tier 3: Tabs (§ Tier 3 — blue-600 active, slate-400 inactive)
	     When `activeGlossaryTab` + `onGlossaryTabChange` are both supplied (CP),
	     the strip becomes a real toggle: Canvas grid vs GlossaryTableView. SA
	     app passes neither and gets the legacy single-tab look. -->
	{#if selectedGlossary && showTabs}
		<div class="flex gap-0 px-4 border-b border-slate-200 mb-3">
			{#if tabsControlled}
				<button
					type="button"
					class="flex items-center px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors {activeGlossaryTab === 'canvas' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}"
					onclick={() => onGlossaryTabChange?.('canvas')}
				>Canvas</button>
				<button
					type="button"
					class="flex items-center px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors {activeGlossaryTab === 'table' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}"
					onclick={() => onGlossaryTabChange?.('table')}
				>Table</button>
			{:else}
				<button class="flex items-center px-3.5 py-2 text-xs font-medium border-b-2 -mb-px text-blue-600 border-blue-600">Canvas</button>
			{/if}
		</div>
	{/if}

	{#if tabsControlled && activeGlossaryTab === 'table'}
		<GlossaryTableView nodes={nodes} links={links ?? []} editable />
	{:else}

	{#if !selectedGlossary && effectiveShowSwitcher}
		<div class="text-center py-12 text-slate-400">
			<p class="text-lg mb-2">No glossary found</p>
			<p class="text-sm">Create a new glossary to get started.</p>
		</div>
	{:else if selectedGlossary || !effectiveShowSwitcher}
		<div class="grid grid-cols-4 gap-2 {effectiveShowSwitcher ? 'h-[calc(100%-10rem)]' : 'h-[calc(100%-1rem)]'}">
			<!-- Col 1: Glossary Terms (global, shared) — main list with definitions -->
			<div class="col-span-2 flex flex-col h-full rounded-lg border overflow-hidden" style="border-color: #14532d30;">
				<div class="px-3 py-1.5 shrink-0" style="background-color: #14532d12;">
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-bold uppercase tracking-wider" style="color: #14532d">
							Glossary Terms
						</span>
						<div class="flex items-center gap-1.5">
							<span class="text-[10px] text-slate-400">{glossaryTerms.length}</span>
							{#if onAddExisting}
								<button
									onclick={() => onAddExisting('global_glossary_term')}
									class="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
									style="color: #14532d"
									title="Add existing node to Glossary Terms"
								>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
										<path d="M1 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-4ZM10 1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V1ZM6.5 3.5a2.5 2.5 0 0 0-5 0v.006c0 .07.003.14.009.209l2.86 2.86a2.5 2.5 0 0 0 2.122-2.404L6.5 3.5ZM9.5 12.5a2.5 2.5 0 0 0 5 0v-.006a2.52 2.52 0 0 0-.009-.209l-2.86-2.86a2.5 2.5 0 0 0-2.122 2.404l-.009.671Z" />
									</svg>
								</button>
							{/if}
							<button
								onclick={startAddingTerm}
								class="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
								style="color: #14532d"
								title="Add Glossary Term"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
									<path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
								</svg>
							</button>
						</div>
					</div>

					{#if addingTerm}
						<div class="mt-1">
							<input
								bind:this={termInputEl}
								bind:value={newTermName}
								onkeydown={handleTermKeydown}
								onblur={submitAddTerm}
								type="text"
								placeholder="Term name..."
								class="w-full px-2 py-1 text-[11px] border rounded bg-white focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
								style="border-color: #14532d40;"
							/>
						</div>
					{/if}
					{#if glossaryTerms.length >= 5}
						<div class="mt-1 relative">
							<svg class="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
							<input bind:value={termSearchQuery} type="text" placeholder="Search terms..." class="w-full pl-6 pr-6 py-1 text-[11px] border rounded bg-white focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none" style="border-color: #14532d30;" />
							{#if termSearchQuery}
								<button onclick={() => (termSearchQuery = '')} class="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
							{/if}
						</div>
					{/if}
				</div>
				<div class="flex-1 overflow-y-auto p-2 space-y-2" style="background-color: #14532d04;">
					{#each filteredTerms as node (node.id)}
						<div
							class="flex items-stretch {dragId === node.id ? 'opacity-30' : ''} {dropTargetId === node.id ? (dropPosition === 'before' ? 'border-t-2 border-t-blue-500' : 'border-b-2 border-b-blue-500') : ''}"
							ondragover={(e) => handleDragOverRow(e, node.id)}
							ondrop={handleDrop}
						>
							{#if filteredTerms.length > 1}
								<span
									class="inline-flex items-center justify-center w-5 shrink-0 text-[10px] text-slate-400 hover:text-slate-600 cursor-grab select-none"
									draggable="true"
									ondragstart={(e) => handleDragStart(e, node.id)}
									ondragend={clearDragState}
									role="img"
									aria-label="Drag to reorder"
								>⠿</span>
							{/if}
							<button
								data-node-id={node.id}
								onclick={() => onSelectNode(node.id)}
								ondblclick={() => openEditModal(node.id)}
								onmouseenter={(e) => showTooltipFor(node.id, e.currentTarget as HTMLElement)}
								onmouseleave={() => scheduleHideTooltip()}
								class="flex-1 min-w-0 text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/30 transition-colors cursor-pointer group relative"
							>
							<div class="text-xs font-semibold text-slate-800">{node.name}</div>
							{#if node.properties?.definitionCategory || node.properties?.definitionDifferentiator}
								<div class="text-[11px] text-slate-600 mt-1 leading-relaxed">
									<span class="font-medium">{node.name}</span> is a <span class="text-orange-700 font-medium">{node.properties.definitionCategory || '…'}</span> that {#each ((node.properties.definitionDifferentiator as string) || '…').split(/(@\{[^}]+\})/) as segment}{#if segment.startsWith('@{') && segment.endsWith('}')}<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">{segment.slice(2, -1)}</span>{:else}<span class="text-orange-700 font-medium">{segment}</span>{/if}{/each}
								</div>
							{:else}
								<div class="text-[11px] text-slate-300 italic mt-1">No definition yet — double-click to add</div>
							{/if}
						</button>
						</div>
					{:else}
						<div class="flex items-center justify-center h-full">
							<span class="text-[10px] text-slate-300 italic">No glossary terms yet</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Col 2: Categories + Stewards + Statuses.
			     Each section is wrapped in `flex-1 min-h-0` so it gets an
			     equal share of the column's height AND can shrink below its
			     natural content size. CanvasSection's internal `h-full`
			     then fills the wrapper, and its `overflow-y-auto` body
			     scrolls when content exceeds the row. Without the explicit
			     flex-1 wrappers, the first section's natural content size
			     ate the whole column and the second + third didn't render. -->
			<div class="flex flex-col gap-2 h-full min-h-0">
				<div class="flex-1 min-h-0">
					<CanvasSection title="Categories" color="#047857" entityLabel="gls_category" nodes={getScoped("gls_category")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
				<div class="flex-1 min-h-0">
					<CanvasSection title="Data Stewards" color="#059669" entityLabel="gls_steward" nodes={getScoped("gls_steward")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
				<div class="flex-1 min-h-0">
					<CanvasSection title="Statuses" color="#10b981" entityLabel="gls_status" nodes={getScoped("gls_status")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
			</div>

			<!-- Col 3: Related global types — same flex-1 wrapper pattern as Col 2. -->
			<div class="flex flex-col gap-2 h-full min-h-0">
				<div class="flex-1 min-h-0">
					<CanvasSection title="Synonyms/Aliases" color="#065f46" entityLabel="gls_synonym" nodes={getScoped("gls_synonym")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
				<div class="flex-1 min-h-0">
					<CanvasSection title="Concepts" color="#e11d48" entityLabel="global_concept" nodes={getScoped("global_concept")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
				<div class="flex-1 min-h-0">
					<CanvasSection title="Business Questions" color="#0ea5e9" entityLabel="global_business_question" nodes={getScoped("global_business_question")} onSelectNode={handleCardSelect} {onAddNode} {onAddExisting} />
				</div>
			</div>
		</div>
	{/if}
	{/if}
</div>

<!-- Edit term modal -->
{#if editModalId}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onclick={() => (editModalId = null)}>
		<div class="bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md" onclick={(e) => e.stopPropagation()}>
			<h3 class="text-sm font-bold text-slate-700 mb-3">Term Details</h3>
			<label class="block text-xs font-medium text-slate-500 mb-1" for="edit-gls-name">Name</label>
			<input id="edit-gls-name" type="text" bind:value={editModalName}
				class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
			<label class="block text-xs font-medium text-slate-500 mb-1 mt-3" for="edit-gls-aliases">Aliases <span class="text-slate-400 font-normal">(comma-separated)</span></label>
			<input id="edit-gls-aliases" type="text" bind:value={editModalAliases} placeholder="e.g. Revenue, Income"
				class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
			<!-- Definition -->
			<div class="mt-3 p-3 rounded-lg border border-orange-200 bg-orange-50/30">
				<label class="block text-xs font-bold text-orange-700 mb-2">Definition</label>
				<div class="flex items-baseline gap-1 flex-wrap text-sm text-slate-700">
					<span class="font-semibold">{editModalName || '…'}</span>
					<span>is a</span>
					<div class="relative inline-block">
						<input type="text" bind:value={editModalDefCategory} placeholder="broader category"
							oninput={handleDefCatInput}
							onkeydown={handleDefCatKeydown}
							onfocus={() => { defCatQuery = editModalDefCategory; handleDefCatInput(); }}
							onblur={() => setTimeout(() => { showDefCatDropdown = false; }, 150)}
							autocomplete="off"
							class="inline-block w-40 px-2 py-1 border border-orange-200 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white" />
						{#if showDefCatDropdown && defCatSuggestions.length > 0}
							<div class="absolute top-full left-0 mt-1 bg-white rounded-lg border border-orange-200 shadow-xl z-[60] py-1 w-56 max-h-40 overflow-y-auto">
								{#each defCatSuggestions as concept, i}
									<button
										type="button"
										onmousedown={(e) => { e.preventDefault(); selectDefCatConcept(concept); }}
										class="w-full text-left px-3 py-1.5 text-sm transition-colors {i === defCatFocusIdx ? 'bg-orange-50 text-orange-800' : 'text-slate-700 hover:bg-slate-50'}"
									>
										<span class="font-medium">{concept.name}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
					<span>that</span>
					<div class="relative inline-block flex-1 min-w-[200px]">
						<input type="text" bind:value={editModalDefDifferentiator} bind:this={mentionInputEl}
							placeholder="distinguishing feature (type @ to link)"
							oninput={handleDiffInput}
							onkeydown={handleDiffKeydown}
							onblur={() => setTimeout(() => { showMentionDropdown = false; }, 150)}
							autocomplete="off"
							class="w-full px-2 py-1 border border-orange-200 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white" />
						{#if showMentionDropdown && mentionSuggestions.length > 0}
							<div class="absolute top-full left-0 mt-1 bg-white rounded-lg border border-orange-200 shadow-xl z-[60] py-1 w-64 max-h-40 overflow-y-auto">
								{#each mentionSuggestions as term, i}
									<button
										type="button"
										onmousedown={(e) => { e.preventDefault(); selectMention(term); }}
										class="w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 {i === mentionFocusIdx ? 'bg-orange-50 text-orange-800' : 'text-slate-700 hover:bg-slate-50'}"
									>
										<span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">@</span>
										<span class="font-medium">{term.name}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
				<p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
					Define by category (genus) and what distinguishes it (differentia)
				</p>
			</div>
			<label class="block text-xs font-medium text-slate-500 mb-1 mt-3" for="edit-gls-desc">Description</label>
			<textarea id="edit-gls-desc" bind:value={editModalDesc} rows={3} placeholder="Additional context or notes..."
				class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"></textarea>
			<div class="flex justify-between items-center gap-2 mt-4">
				<button onclick={deleteFromEditModal} class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-colors">Delete</button>
				<div class="flex gap-2">
					<button onclick={() => (editModalId = null)} class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-slate-500 border border-slate-300 hover:bg-slate-50 transition-colors">Cancel</button>
					<button onclick={saveEditModal} class="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 transition-colors">Save</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Hover tooltip for Glossary Term cards (same pattern as BEM
     domain/concept tooltips). Card colour = global_glossary_term green-900;
     border = green-200 soft accent. -->
{#if tooltipId && tooltipItem}
	<div
		class="fixed z-50 w-72"
		style="top: {tooltipY + 4}px; left: {tooltipX - 144}px;"
		onmouseenter={() => cancelHideTooltip()}
		onmouseleave={() => scheduleHideTooltip()}
		role="tooltip"
	>
		<div
			class="bg-white border text-slate-700 text-[11px] font-normal leading-relaxed rounded-lg shadow-lg px-3 py-2.5"
			style="border-color: {TERM_BORDER};"
		>
			<div class="font-semibold mb-1" style="color: {TERM_COLOR};">{tooltipItem.name}</div>
			{#if tooltipItem.definitionCategory || tooltipItem.definitionDifferentiator}
				<p class="text-slate-600">A <span class="font-semibold" style="color: {TERM_COLOR};">{tooltipItem.definitionCategory || '…'}</span> that {#each (tooltipItem.definitionDifferentiator || '…').split(/(@\{[^}]+\})/) as segment}{#if segment.startsWith('@{') && segment.endsWith('}')}<span class="inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium bg-orange-100 text-orange-700 border border-orange-200">{segment.slice(2, -1)}</span>{:else}<span class="font-semibold" style="color: {TERM_COLOR};">{segment}</span>{/if}{/each}</p>
			{:else if tooltipItem.description}
				<p class="text-slate-600">{tooltipItem.description}</p>
			{:else}
				<p class="text-slate-400 italic">No definition yet.</p>
			{/if}
			{#if tooltipItem.synonyms.length > 0}
				<div class="mt-1.5 flex flex-wrap gap-1 items-center">
					<span class="text-[10px] text-slate-400 uppercase tracking-wider">Synonyms:</span>
					{#each tooltipItem.synonyms as synonym}
						<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{synonym}</span>
					{/each}
				</div>
			{/if}
			{#if tooltipItem.category || tooltipItem.steward || tooltipItem.status}
				<div class="mt-1.5 flex flex-wrap gap-1 items-center">
					{#if tooltipItem.category}
						<span class="text-[10px] text-slate-400 uppercase tracking-wider">Cat:</span>
						<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tooltipItem.category}</span>
					{/if}
					{#if tooltipItem.steward}
						<span class="text-[10px] text-slate-400 uppercase tracking-wider">Steward:</span>
						<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tooltipItem.steward}</span>
					{/if}
					{#if tooltipItem.status}
						<span class="text-[10px] text-slate-400 uppercase tracking-wider">Status:</span>
						<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tooltipItem.status}</span>
					{/if}
				</div>
			{/if}
			{#if tooltipItem.notes}
				<div class="mt-1.5">
					<span class="text-[10px] text-slate-400 uppercase tracking-wider">Notes:</span>
					<p class="text-[10px] text-slate-600 mt-0.5 whitespace-pre-wrap">{tooltipItem.notes}</p>
				</div>
			{/if}
			<button
				class="mt-2 text-[10px] underline cursor-pointer"
				style="color: {TERM_COLOR};"
				onclick={() => { if (tooltipId) { openEditModal(tooltipId); tooltipId = null; } }}
			>Edit details</button>
		</div>
	</div>
{/if}

<!-- Click-away handler for dropdowns -->
{#if showGlossarySwitcher}
	<div
		class="fixed inset-0 z-40"
		onclick={() => { showGlossarySwitcher = false; }}
	></div>
{/if}

<!-- Shared rich-card popup for non-glossary-term cards (Concepts, Synonyms,
     Categories, Stewards, Statuses, Business Questions). Glossary terms keep
     their dedicated inline modal above (definition genus/differentia +
     @-mention to other terms). -->
{#if conceptModalNode}
	<ConceptCardEditModal
		node={conceptModalNode}
		allNodes={nodes}
		onClose={() => (conceptModalId = null)}
	/>
{/if}
