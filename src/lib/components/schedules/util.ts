import { getRecurrenceMultiDescription } from '../recurrence/recurrence-utils';
import type { Field, ScheduleUI } from './types';

export const dayOrder = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
export const dayNames = {
	MO: 'Mon',
	TU: 'Tue',
	WE: 'Wed',
	TH: 'Thu',
	FR: 'Fri',
	SA: 'Sat',
	SU: 'Sun'
};

// Title helpers (top-level) for schedule-centric UI
export function labelFields(ids: string[], fieldMap: Map<string, Field>): string {
	const names = ids.map((id) => fieldMap.get(id)?.name);
	if (names.length === 0) return '';
	if (names.length <= 2) return names.join(', ');
	return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}
export function deriveScheduleTitle(sch: ScheduleUI, fieldMap: Map<string, Field>): string {
	const f = labelFields(sch.fieldIds, fieldMap);
	const description = getRecurrenceMultiDescription(sch.recurrence);

	// Enhanced description with weekend/multi-day logic
	let enhancedDescription = description;
	if (sch.recurrence.frequency === 'weekly' && sch.recurrence.weekdays) {
		const weekdays = sch.recurrence.weekdays;

		// Check for weekend (Saturday + Sunday)
		if (weekdays.length === 2 && weekdays.includes('SA') && weekdays.includes('SU')) {
			enhancedDescription = description.replace(/on .+/, 'on weekends');
		}
		// Check for consecutive weekdays
		else if (weekdays.length > 2) {
			const sortedDays = weekdays.toSorted((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

			// Check if days are consecutive
			const isConsecutive = sortedDays.every((day, i) => {
				if (i === 0) return true;
				const prevIndex = dayOrder.indexOf(sortedDays[i - 1]);
				const currIndex = dayOrder.indexOf(day);
				return currIndex === prevIndex + 1;
			});

			if (isConsecutive && sortedDays.length > 1) {
				const firstDay = dayNames[sortedDays[0]];
				const lastDay = dayNames[sortedDays[sortedDays.length - 1]];
				enhancedDescription = description.replace(/on .+/, `on ${firstDay}-${lastDay}`);
			}
		}
	}

	return [f, enhancedDescription].filter(Boolean).join(' - ');
}
