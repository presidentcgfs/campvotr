<script lang="ts">
  import { onMount } from 'svelte';

  let name = '';
  let initialName = '';
  let error = '';
  let success = '';
  let loading = true;
  let saving = false;

  onMount(async () => {
    await loadProfile();
  });

  async function loadProfile() {
    loading = true; error='';
    try {
      const res = await fetch('/api/users/me');
      if (!res.ok) throw await mapError(res);
      const data = await res.json();
      name = data.name ?? '';
      initialName = name;
    } catch (e:any) { error = e.message ?? 'Failed to load profile'; }
    finally { loading = false; }
  }

  function validate(n: string): string | null {
    const trimmed = n.trim();
    if (trimmed.length < 1 || trimmed.length > 100) return 'Name must be between 1 and 100 characters.';
    // allow letters, spaces, hyphens, apostrophes, periods; disallow control chars
    if (!/^[A-Za-z0-9 .\-']+$/.test(trimmed)) return 'Name contains invalid characters.';
    return null;
  }

  async function onSave() {
    error=''; success='';
    const v = validate(name);
    if (v) { error = v; return; }
    saving = true;
    try {
      const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
      if (!res.ok) throw await mapError(res);
      const data = await res.json();
      name = data.name ?? name.trim();
      initialName = name;
      success = 'Saved';
      setTimeout(() => success = '', 2000);
    } catch (e:any) { error = e.message ?? 'Request failed. Try again.'; }
    finally { saving = false; }
  }

  async function mapError(res: Response) {
    const body = await safeJson(res);
    if (res.status === 401) return new Error('You must be signed in to update your name.');
    if (res.status === 403) return new Error('You don’t have permission to update this profile.');
    if (res.status === 404) return new Error('User not found.');
    if (res.status === 429) return new Error('Too many requests. Try again soon.');
    if (res.status === 409 || res.status === 422) return new Error(body?.error || 'Invalid name. Please check and try again.');
    return new Error(body?.error || 'Request failed. Try again.');
  }
  async function safeJson(res: Response) { try { return await res.json(); } catch { return null; } }
</script>

<section class="card">
  <h2>User profile</h2>
  {#if loading}
    <p>Loading…</p>
  {:else}
    <div class="field">
      <label for="display-name">Name</label>
      <input id="display-name" type="text" bind:value={name} disabled={saving} />
    </div>
    {#if error}<p class="error" aria-live="polite">{error}</p>{/if}
    {#if success}<p class="success" aria-live="polite">{success}</p>{/if}
    <button class="btn" on:click={onSave} disabled={saving || validate(name) !== null || name.trim() === initialName.trim()}>Save</button>
  {/if}
</section>

<style>
  .field { display: grid; gap: 0.35rem; margin-bottom: 0.75rem; max-width: 420px; }
  .error { color: #dc2626; }
  .success { color: #16a34a; }
</style>

