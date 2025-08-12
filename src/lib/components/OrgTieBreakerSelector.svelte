<script lang="ts">
  import { onMount } from 'svelte';
  export let orgSlug: string;
  export let canEdit: boolean = false;

  type Member = { organization_id: string; user_id: string; role: string; user?: { id: string; email: string } };
  let members: Member[] = [];
  let loading = true;
  let error = '';
  let saving = false;
  let tieBreakerUserId: string | null = null;
  let success = '';

  onMount(async () => {
    await load();
  });

  async function load() {
    loading = true;
    error = '';
    try {
      const [mres, tres] = await Promise.all([
        fetch(`/api/organizations/${orgSlug}/members`),
        fetch(`/api/organizations/${orgSlug}/tie-breaker`)
      ]);
      const mdata = await mres.json();
      const tdata = await tres.json();
      members = mdata.members ?? [];
      tieBreakerUserId = tdata.tie_breaker_user_id ?? null;
    } catch (e: any) {
      error = e.message ?? 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (!canEdit) return;
    saving = true;
    error = '';
    success = '';
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/tie-breaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tieBreakerUserId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Save failed');
      }
      success = 'Saved';
      setTimeout(() => (success = ''), 2000);
    } catch (e: any) {
      error = e.message ?? 'Save failed';
    } finally {
      saving = false;
    }
  }
</script>

<div class="tiebreaker">
  <h3>President (Tie-Breaker)</h3>
  {#if loading}
    <p>Loading…</p>
  {:else}
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <label>Designated tie-breaker
      <select bind:value={tieBreakerUserId} disabled={!canEdit || saving} aria-label="Designated tie-breaker">
        <option value={null}>— None —</option>
        {#each members as m}
          <option value={m.user_id}>{m.user?.email ?? m.user_id}</option>
        {/each}
      </select>
    </label>
    {#if canEdit}
      <button class="btn" disabled={saving} on:click={save}>Save</button>
      {#if success}<span class="success">{success}</span>{/if}
    {/if}
  {/if}
</div>

<style>
  .error { color: #dc2626; }
  .success { color: #16a34a; margin-left: 0.5rem; }
  select { margin-right: 0.5rem; }
</style>

