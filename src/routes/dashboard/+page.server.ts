import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.session) {
    throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return {};
};

