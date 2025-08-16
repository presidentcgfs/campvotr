<script lang="ts">
	import UserSettings from '$lib/components/UserSettings.svelte';
	import type { Organization } from '../../model.types';
	export let data: { org: Organization };
</script>

<UserSettings selected={data.org} items={data.orgs} />
