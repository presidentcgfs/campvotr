import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { recurrenceRules } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface CreateRecurrenceRuleInput {
  organizationId: string;
  fieldId: string;
  frequency: Frequency;
  interval?: number;
  byDay?: string | null; // e.g. "MO,TU"
  windowStartUtc: Date;
  windowEndUtc: Date;
  blackoutDates?: string | null; // JSON string
}

export const recurrenceRuleServiceKey = pbjKey<RecurrenceRuleService>('recurrenceRuleService');
export class RecurrenceRuleService extends BaseService {
  constructor(db = pbj(drizzleKey)) {
    super(db);
  }

  async createRule(input: CreateRecurrenceRuleInput) {
    this.validateRule(input);
    const [row] = await this.db
      .insert(recurrenceRules)
      .values({
        organizationId: input.organizationId,
        fieldId: input.fieldId,
        frequency: input.frequency,
        interval: input.interval ?? 1,
        byDay: input.byDay ?? null,
        windowStartUtc: input.windowStartUtc,
        windowEndUtc: input.windowEndUtc,
        blackoutDates: input.blackoutDates ?? null
      })
      .returning();
    return row;
  }

  async listRules(organizationId: string) {
    const rows = await this.db
      .select()
      .from(recurrenceRules)
      .where(eq(recurrenceRules.organizationId, organizationId));
    return rows;
  }

  validateRule(input: { frequency: Frequency; interval?: number; byDay?: string | null; windowStartUtc: Date; windowEndUtc: Date; }) {
    if (input.windowEndUtc <= input.windowStartUtc) {
      throw new Error('windowEndUtc must be after windowStartUtc');
    }
    if (input.interval !== undefined && input.interval < 1) {
      throw new Error('interval must be >= 1');
    }
    if (input.frequency === 'weekly') {
      if (!input.byDay) throw new Error('byDay is required for weekly frequency');
      const ok = input.byDay.split(',').every((d) => ['MO','TU','WE','TH','FR','SA','SU'].includes(d));
      if (!ok) throw new Error('byDay must be a comma-separated list of MO, TU, WE, TH, FR, SA, SU');
    }
  }

  // Minimal preview: returns an array of { startUtc, endUtc }
  async preview(
    rule: { frequency: Frequency; interval?: number; byDay?: string | null; windowStartUtc: Date; windowEndUtc: Date; },
    slotDurationMinutes: number
  ) {
    this.validateRule(rule);
    const results: { startUtc: Date; endUtc: Date }[] = [];
    const interval = rule.interval ?? 1;

    const addSlot = (start: Date) => {
      const end = new Date(start.getTime() + slotDurationMinutes * 60_000);
      if (end <= rule.windowEndUtc) {
        results.push({ startUtc: start, endUtc: end });
      }
    };

    if (rule.frequency === 'daily') {
      let cur = new Date(rule.windowStartUtc);
      while (cur <= rule.windowEndUtc) {
        addSlot(new Date(cur));
        cur.setUTCDate(cur.getUTCDate() + interval);
      }
    } else if (rule.frequency === 'weekly') {
      const days = (rule.byDay ?? '').split(',').filter(Boolean);
      // Start from windowStart, iterate week by week
      let weekStart = new Date(Date.UTC(
        rule.windowStartUtc.getUTCFullYear(),
        rule.windowStartUtc.getUTCMonth(),
        rule.windowStartUtc.getUTCDate()
      ));
      while (weekStart <= rule.windowEndUtc) {
        for (const d of days) {
          const dayIdx = ['SU','MO','TU','WE','TH','FR','SA'].indexOf(d);
          if (dayIdx < 0) continue;
          // Compute that weekday in the current week (assuming week starts Sunday)
          const candidate = new Date(weekStart);
          const curDow = candidate.getUTCDay();
          const delta = dayIdx - curDow;
          candidate.setUTCDate(candidate.getUTCDate() + delta);
          if (candidate >= rule.windowStartUtc && candidate <= rule.windowEndUtc) {
            addSlot(candidate);
          }
        }
        weekStart.setUTCDate(weekStart.getUTCDate() + 7 * interval);
      }
    } else if (rule.frequency === 'monthly') {
      let cur = new Date(rule.windowStartUtc);
      while (cur <= rule.windowEndUtc) {
        addSlot(new Date(cur));
        cur.setUTCMonth(cur.getUTCMonth() + interval);
      }
    }

    return results;
  }
}

