import { EmailService } from '$lib/server/email';

import { PUBLIC_APP_URL } from '$env/static/public';
import { RESEND_API_KEY } from '$env/static/private';
import { PUBLIC_FROM_EMAIL } from '$env/static/public';

export const emailService = new EmailService(PUBLIC_FROM_EMAIL, PUBLIC_APP_URL, RESEND_API_KEY);
