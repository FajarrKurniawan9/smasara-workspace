<script lang="ts">
	interface Props {
		children?: any;
		color?: 'slate' | 'emerald' | 'sky' | 'red';
		size?: 'xs' | 'sm';
	}

	let { children, color = 'slate', size = 'sm' }: Props = $props();

	const colorClasses = {
		slate: 'bg-slate-50 text-slate-600 border border-slate-200/70',
		emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
		sky: 'bg-sky-50 text-sky-700 border border-sky-200/80',
		red: 'bg-red-50 text-red-700 border border-red-200/70'
	};
</script>

<span
	class="inline-flex items-center rounded-full font-medium shadow-2xs {colorClasses[color]} {size === 'sm'
		? 'px-2.5 py-0.5 text-[11px]'
		: 'px-2 py-0.5 text-[10px]'}"
>
	{@render children?.()}
</span>
