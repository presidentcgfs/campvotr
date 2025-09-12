import { createSelectSchema, createSchemaFactory } from 'drizzle-zod';
import {
	fields,
	timeSlots,
	drawSessions,
	participants,
	drawSchedules,
	drawScheduleFields,
	drawSessionStatusEnum,
	timeSlotStatusEnum,
	recurrenceFrequencyEnum,
	turnStrategyEnum,
	drawScheduleRules
} from './schema';
import { z } from 'zod/v4';

const { createInsertSchema } = createSchemaFactory({ coerce: true });

export const fieldSelectSchema = createSelectSchema(fields);
export const fieldInsertSchema = createInsertSchema(fields);

export const timeSlotSelectSchema = createSelectSchema(timeSlots);
export const timeSlotInsertSchema = createInsertSchema(timeSlots);
export type TimeSlotInsert = z.infer<typeof timeSlotInsertSchema>;
export const drawSessionSelectSchema = createSelectSchema(drawSessions);
export const drawSessionInsertSchema = createInsertSchema(drawSessions);

export const participantSelectSchema = createSelectSchema(participants);
export const participantInsertSchema = createInsertSchema(participants);

export const drawScheduleSelectSchema = createSelectSchema(drawSchedules);
export const drawScheduleInsertSchema = createInsertSchema(drawSchedules);

export const scheduleFieldSelectSchema = createSelectSchema(drawScheduleFields);
export const scheduleFieldInsertSchema = createInsertSchema(drawScheduleFields);

export const drawScheduleRulesSelectSchema = createSelectSchema(drawScheduleRules);
export const drawScheduleRulesInsertSchema = createInsertSchema(drawScheduleRules);

export const drawSessionStatusEnumSchema = createSelectSchema(drawSessionStatusEnum);
export const timeSlotStatusEnumSchema = createSelectSchema(timeSlotStatusEnum);
export const recurrenceFrequencyEnumSchema = createSelectSchema(recurrenceFrequencyEnum);
export const turnStrategyEnumSchema = createSelectSchema(turnStrategyEnum);
