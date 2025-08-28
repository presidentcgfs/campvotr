<script lang="ts" context="module">
	export function toISOString(d: string | Date) {
		if (!d) return '';
		if (d instanceof Date) return d.toISOString();
		return d;
	}
</script>

<script lang="ts">
	import { Datepicker, P } from 'flowbite-svelte';

	export let startDate: Date = new Date();
	export let endDate: Date;
</script>

<Datepicker range bind:rangeFrom={startDate} bind:rangeTo={endDate} />
