<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  let organizations: { id: string; name: string; slug: string }[] = [];
  let currentSlug = '';

  export let fetchOrganizations: () => Promise<{ id: string; name: string; slug: string }[]> = async () => [];
  export let onSwitch: (slug: string) => void = () => {};

  onMount(async () => {
    if (!browser) return;
    currentSlug = new URL(location.href).searchParams.get('org') || '';
    organizations = await fetchOrganizations();
  });

  function handleChange(e: Event) {
    const slug = (e.target as HTMLSelectElement).value;
    currentSlug = slug;
    onSwitch(slug);
  }
</script>

<div class="org-switcher">
  <select on:change={handleChange} bind:value={currentSlug}>
    {#each organizations as org}
      <option value={org.slug}>{org.name}</option>
    {/each}
  </select>
</div>

<style>
  .org-switcher select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
  }
</style>

