import { type RecurrenceMulti } from '$lib/components/recurrence/recurrence-utils.js';
export type ScheduleUI = {
	recurrence: RecurrenceMulti;
	fieldIds: string[];
	fields?: { id: string }[];
	collapsed?: boolean;
};
export type Field = {
	id: string;
	name: string;
};
