import { drizzle } from 'drizzle-orm/postgres-js';
import { envRequired } from '@pbinj/pbj/env';
import { pbj, context, pbjKey } from '@pbinj/pbj';
import * as _schema from './schema';
import postgres from 'postgres';

export const schema = _schema;

export class ClientConfig {
	constructor(
		private _url = envRequired('DATABASE_URL'),
		public _authToken = envRequired('DATABASE_AUTH_TOKEN')
	) {}
	//These eventually get passed into  rust, and rust really doesn't seem to like proxied strings, so we need to force them to be real strings.
	//Otherwise in the downstream libsql code we get "TypeError: failed to downcast any to string"
	get url() {
		return this._url + '';
	}
	get authToken() {
		return this._authToken + '';
	}
}

const drizzleFactory = (drizzleConfig = pbj(ClientConfig)) => {
	return drizzle(postgres(drizzleConfig.url), { schema });
};

export const drizzleKey = pbjKey<ReturnType<typeof drizzleFactory>>('drizzle');

export function register(ctx = context, drizzleConfig = new ClientConfig()) {
	ctx.register(drizzleKey, drizzleFactory, drizzleConfig);
}
