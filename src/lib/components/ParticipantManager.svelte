<script lang="ts">
	import { Button, Input, Badge, Alert, Select, Label } from 'flowbite-svelte';
	import { UserAddOutline, UserRemoveOutline } from 'flowbite-svelte-icons';
	import AlertHide from './AlertHide.svelte';

	interface Participant {
		id: string;
		email: string;
		displayName: string;
		role: string;
		type: 'member' | 'email';
		createdAt: string;
	}

	let {
		participants: _participants = $bindable([]),
		successMessage,
		errorMessage,
		path
	} = $props<{
		participants: Participant[];
		successMessage?: string;
		errorMessage?: string;
		path: string;
	}>();

	function createEmptyParticipant() {
		return { email: '', role: 'member', id: `new:${crypto.randomUUID()}` };
	}
	let newParticipant = $state(createEmptyParticipant());

	let isSubmitting = $state(false);
	let participants = $state(_participants);
	$effect(() => {
		_participants = participants;
	});
	function getParticipantTypeLabel(type: 'member' | 'email') {
		return type === 'member' ? 'Organization Member' : 'Email Invitation';
	}

	function getParticipantTypeBadgeColor(type: 'member' | 'email') {
		return type === 'member' ? 'green' : 'blue';
	}
	function removeParticipant(id: string) {
		participants = participants.filter((p) => p.id !== id);
	}
	async function addParticipant() {
		if (!newParticipant.email?.trim()) return;
		participants = [
			...participants,
			await createParticipant(newParticipant.email, newParticipant.role)
		];
		newParticipant = createEmptyParticipant();
	}
	async function handlePaste(event: ClipboardEvent) {
		console.log('Paste event:', event);
		const clipboardData = event.clipboardData;
		if (!clipboardData) return;

		const pastedText = clipboardData.getData('text/plain');
		if (!pastedText.trim()) return;

		const emailStrings = pastedText
			.split(/\r?\n|,|;/)
			.map((s) => s.trim())
			.filter(Boolean);

		if (!emailStrings.length) {
			// Single email - let the default paste behavior handle it
			return;
		}

		// Prevent default paste behavior for multiple emails
		event.preventDefault();

		const newParticipants: Participant[] = [];
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		for (const emailStr of emailStrings) {
			// Parse email:role format or just email
			const [email, role = 'member'] = emailStr.split(':').map((s) => s.trim());

			// Validate email format
			if (!emailRegex.test(email)) {
				console.warn(`Invalid email format: ${email}`);
				continue;
			}

			// Check if email already exists
			const emailExists =
				participants.some((p) => p.email.toLowerCase() === email.toLowerCase()) ||
				newParticipants.some((p) => p.email.toLowerCase() === email.toLowerCase());

			if (emailExists) {
				console.warn(`Email already exists: ${email}`);
				continue;
			}
			newParticipants.push(await createParticipant(email, role));
		}

		// Add all valid new participants
		if (newParticipants.length > 0) {
			participants = [...participants, ...newParticipants];
			successMessage = `Added ${newParticipants.length} participants from paste`;
		}
	}

	async function createParticipant(email: string, role: string) {
		// Create new participant
		return {
			id: `new:${crypto.randomUUID()}`,
			email: email.toLowerCase(),
			role: (ROLES.includes(role as any) ? role : 'member') as any,
			type: 'email',
			createdAt: new Date().toISOString()
		} as Participant;
	}

	const ROLES = ['member', 'admin'] as const;
</script>

<div class="card gap-3">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
			Participants ({participants.length})
		</h3>
	</div>
	<div class="flex flex-col gap-3">
		<AlertHide color="green" class="mb-4" message={successMessage} />

		{#if errorMessage}
			<Alert color="red" class="mb-4">
				{errorMessage}
			</Alert>
		{/if}
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			Tip: You can paste multiple emails separated by commas, semicolons, or new lines. Use
			email:role format for specific roles.
		</p>

		<!-- Add Participant Form -->
		<div class="flex items-end gap-3">
			<div class="flex-1">
				<Label for="email">Email Address</Label>
				<Input
					id="email"
					type="email"
					bind:value={newParticipant.email}
					placeholder="Enter participant email or paste multiple emails"
					disabled={isSubmitting}
					onpaste={handlePaste}
				/>
			</div>
			<div class="w-32">
				<Label for="role">Role</Label>
				<Select
					id="role"
					bind:value={newParticipant.role}
					items={[
						{ value: 'member', name: 'Member' },
						{ value: 'admin', name: 'Admin' }
					]}
					disabled={isSubmitting}
				/>
			</div>
			<Button
				type="submit"
				color="primary"
				size="xs"
				outline
				pill
				onclick={addParticipant}
				disabled={isSubmitting || !newParticipant.email?.trim()}
			>
				<UserAddOutline /> Add
			</Button>
		</div>
		<!-- Participants List -->
		{#if participants.length === 0}
			<div class="py-8 text-center text-gray-500 dark:text-gray-400">
				<p>No participants yet. Add participants using the form above.</p>
			</div>
		{:else}
			<div class="y-3">
				{#each participants as participant, index (participant.id)}
					<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<div>
									<p class="font-medium text-gray-900 dark:text-white">
										{participant.displayName}
									</p>
									{#if participant.displayName !== participant.email}
										<p class="text-sm text-gray-500 dark:text-gray-400">
											{participant.email}
										</p>
									{/if}
								</div>
								<Badge color={getParticipantTypeBadgeColor(participant.type)}>
									{getParticipantTypeLabel(participant.type)}
								</Badge>
								<Badge color={participant.role === 'admin' ? 'red' : 'purple'}
									>{participant.role}</Badge
								>
							</div>
						</div>
						<input type="hidden" name="{path}[{index}].email" value={participant.email} />
						<input type="hidden" name="{path}[{index}].role" value={participant.role} />
						<Button
							type="submit"
							color="red"
							size="xs"
							outline
							pill
							name="removeParticipant"
							onclick={() => removeParticipant(participant.id)}
						>
							<UserRemoveOutline />
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
