<script lang="ts">
  import type { PageData } from '../../../routes/admin/recurrence/$types';
  export let data: PageData;

  // Create form state
  let fieldId = data.fields[0]?.id ?? '';
  let frequency: 'daily' | 'weekly' | 'monthly' = 'daily';
  let interval = 1;
  let byDay = ''; // e.g. MO,TU
  let windowStart = '';
  let windowEnd = '';
  let blackoutDates = '';

  // Preview state
  let previewLoading = false;
  let slotDurationMinutes = 60;
  let previewError: string | null = null;
  let previewSlots: { startUtc: string; endUtc: string }[] = [];

  function toIsoUtc(value: string): string | null {
    if (!value) return null;
    // value from <input type="datetime-local"> is local time without timezone
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  async function preview() {
    previewError = null;
    previewSlots = [];
    previewLoading = true;
    try {
      const body = {
        organizationId: data.orgId,
        fieldId,
        frequency,
        interval,
        byDay: byDay || null,
        windowStartUtc: toIsoUtc(windowStart),
        windowEndUtc: toIsoUtc(windowEnd),
        slotDurationMinutes
      };
      const res = await fetch('/api/recurrence/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Preview failed');
      }
      const j = await res.json();
      previewSlots = (j.slots || []).map((s: any) => ({
        startUtc: s.startUtc,
        endUtc: s.endUtc
      }));
    } catch (e: any) {
      previewError = e?.message ?? 'Preview failed';
    } finally {
      previewLoading = false;
    }
  }
</script>

<div class="container space-y-6">
  <div class="card">
    <h2 class="text-xl font-semibold mb-4">Create Recurrence Rule</h2>
    <form method="post" action="?/create" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium mb-1" for="fieldId">Field</label>
        <select id="fieldId" name="fieldId" bind:value={fieldId} class="w-full border rounded px-3 py-2">
          {#each data.fields as f}
            <option value={f.id}>{f.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="frequency">Frequency</label>
        <select id="frequency" name="frequency" bind:value={frequency} class="w-full border rounded px-3 py-2">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="interval">Interval</label>
        <input id="interval" name="interval" type="number" min="1" bind:value={interval} class="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="byDay">By Day (weekly, e.g. MO,TU)</label>
        <input id="byDay" name="byDay" placeholder="MO,TU" bind:value={byDay} class="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="windowStartUtc">Window Start (UTC)</label>
        <input id="windowStartUtc" name="windowStartUtc" type="datetime-local" bind:value={windowStart} class="w-full border rounded px-3 py-2" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="windowEndUtc">Window End (UTC)</label>
        <input id="windowEndUtc" name="windowEndUtc" type="datetime-local" bind:value={windowEnd} class="w-full border rounded px-3 py-2" />
      </div>

      <div class="md:col-span-2">
        <label class="block text-sm font-medium mb-1" for="blackoutDates">Blackout Dates (JSON)</label>
        <textarea id="blackoutDates" name="blackoutDates" bind:value={blackoutDates} class="w-full border rounded px-3 py-2" rows="3"></textarea>
      </div>

      <div class="md:col-span-2 flex gap-2">
        <button type="submit" class="btn">Save Rule</button>
      </div>
    </form>
  </div>

  <div class="card">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Preview</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <div>
        <label class="block text-sm font-medium mb-1" for="slotMins">Slot Duration (minutes)</label>
        <input id="slotMins" type="number" min="1" bind:value={slotDurationMinutes} class="w-full border rounded px-3 py-2" />
      </div>
      <div class="md:col-span-2 flex items-end">
        <button class="btn" on:click|preventDefault={preview} disabled={previewLoading}>
          {previewLoading ? 'Loading…' : 'Preview Slots'}
        </button>
      </div>
    </div>

    {#if previewError}
      <div class="error">{previewError}</div>
    {/if}

    {#if previewSlots.length}
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2 pr-4">Start (UTC)</th>
              <th class="py-2 pr-4">End (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {#each previewSlots as s}
              <tr class="border-b">
                <td class="py-2 pr-4">{new Date(s.startUtc).toUTCString()}</td>
                <td class="py-2 pr-4">{new Date(s.endUtc).toUTCString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-gray-600">No preview yet.</p>
    {/if}
  </div>

  <div class="card">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Existing Rules</h2>
      <span class="text-sm text-gray-500">{data.rules?.length ?? 0} total</span>
    </div>

    {#if data.rules && data.rules.length}
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2 pr-4">Field</th>
              <th class="py-2 pr-4">Frequency</th>
              <th class="py-2 pr-4">Interval</th>
              <th class="py-2 pr-4">By Day</th>
              <th class="py-2 pr-4">Window</th>
            </tr>
          </thead>
          <tbody>
            {#each data.rules as r}
              <tr class="border-b">
                <td class="py-2 pr-4">{data.fields.find((f) => f.id === r.fieldId)?.name ?? r.fieldId}</td>
                <td class="py-2 pr-4">{r.frequency}</td>
                <td class="py-2 pr-4">{r.interval}</td>
                <td class="py-2 pr-4">{r.byDay}</td>
                <td class="py-2 pr-4">{new Date(r.windowStartUtc).toUTCString()} → {new Date(r.windowEndUtc).toUTCString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-gray-600">No rules yet.</p>
    {/if}
  </div>
</div>

