import { toTemporalInstant } from '@js-temporal/polyfill';
if (typeof Date.prototype.toTemporalInstant !== 'function') {
	Date.prototype.toTemporalInstant = toTemporalInstant;
}
