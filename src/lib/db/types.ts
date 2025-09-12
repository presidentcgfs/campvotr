import { drawSessions, fields, participants, timeSlots } from './schema';
export type Participant = typeof participants.$inferSelect;
export type ParticipantCreate = typeof participants.$inferInsert;
export type TimeSlotCreate = typeof timeSlots.$inferInsert;
export type Field = typeof fields.$inferSelect;
export type DrawSession = typeof drawSessions.$inferSelect;
