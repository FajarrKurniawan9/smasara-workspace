<script lang="ts">
	import type { Workspace } from '$lib/types';

	interface Props {
		workspace?: Workspace;
		path?: Array<{ name: string; id: string }>;
	}

	let { workspace, path = [] }: Props = $props();
</script>

<div class="flex items-center gap-2 text-xs text-zinc-500">
	{#if workspace}
		<span class="font-medium text-zinc-800">
			{workspace.name}
		</span>
		
		{#each path as item}
			<span class="text-zinc-300">/</span>
			<span class="font-medium text-zinc-600">
				{item.name}
			</span>
		{/each}
	{/if}
</div>
