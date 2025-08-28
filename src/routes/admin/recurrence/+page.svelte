<script lang="ts">
  import type { PageData } from './$types';
  import RecurrenceRulesManager from '$lib/components/field-draw/RecurrenceRulesManager.svelte';
  export let data: PageData;
</script>

<div class="container">
  <h1 class="text-2xl font-bold mb-4">Recurrence Rules</h1>
  <RecurrenceRulesManager {data} />
</div>

