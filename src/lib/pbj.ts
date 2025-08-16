import { pbjKey } from '@pbinj/pbj';
import type { User } from './types';

export const userKey = pbjKey<User>('user');
export * from './db/pbj';
