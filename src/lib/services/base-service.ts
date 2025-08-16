import { drizzleKey } from '$lib/pbj';
import { pbj } from '@pbinj/pbj';

export class BaseService {
	constructor(protected db = pbj(drizzleKey)) {}
}
