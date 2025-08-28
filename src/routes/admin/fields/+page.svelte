<script lang="ts">
  import FieldsManager from '$lib/components/field-draw/FieldsManager.svelte';
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<div class="container">
  <h1 class="text-2xl font-bold mb-4">Fields</h1>
  <FieldsManager {data} />
</div>

