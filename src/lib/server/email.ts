import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';
import { PUBLIC_APP_URL } from '$env/static/public';
import { fileURLToPath } from 'url';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface VoterInvitationData {
	voterEmail: string;
	voterName?: string | null;
	ballotTitle: string;
	ballotDescription: string;
	votingOpensAt: Date;
	votingClosesAt: Date;
	ballotId: string;
	isRegisteredUser: boolean;
	votingThreshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';
	thresholdPercentage?: number;
}

export interface ballotNotificationData {
	voterEmail: string;
	voterName?: string;
	ballotTitle: string;
	ballotDescription: string;
	votingOpensAt: Date;
	votingClosesAt: Date;
	ballotId: string;
	votingThreshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';
	thresholdPercentage?: number;
}

type ReminderType = 'open' | 'close';
export interface BallotReminderEmailData {
	type: ReminderType;
	ballotId: string;
	ballotTitle: string;
	voterEmail: string;
	voterName?: string;
	when: Date; // opensAt or closesAt
	minutes: number;
}
export interface BallotOpenedEmailData {
	ballotId: string;
	ballotTitle: string;
	voterEmail: string;
	voterName?: string;
	closesAt: Date;
}
export interface BallotClosedEmailData {
	ballotId: string;
	ballotTitle: string;
	voterEmail: string;
	voterName?: string;
}

export class EmailService {
	private static fromEmail = 'Vote <noreply@vote.campbellsoftball.com>';

	private static getThresholdLabel(threshold: string, customPercentage?: number): string {
		switch (threshold) {
			case 'simple_majority':
				return 'Simple Majority (50% + 1)';
			case 'supermajority':
				return 'Supermajority (2/3)';
			case 'unanimous':
				return 'Unanimous (100%)';
			case 'custom':
				return `Custom (${customPercentage || 50}%)`;
			default:
				return 'Simple Majority (50% + 1)';
		}
	}

	static async sendVoterInvitation(data: VoterInvitationData): Promise<boolean> {
		if (!resend) {
			console.warn('Email service not configured - RESEND_API_KEY missing');
			return false;
		}

		try {
			const subject = `You've been invited to vote on this ballot: ${data.ballotTitle}`;
			const ballotUrl = `${PUBLIC_APP_URL}/ballots/${data.ballotId}`;
			const authUrl = `${PUBLIC_APP_URL}/auth`;

			const html = this.generateVoterInvitationHTML(data, ballotUrl, authUrl);
			const text = this.generateVoterInvitationText(data, ballotUrl, authUrl);

			const result = await resend.emails.send({
				from: this.fromEmail,
				to: data.voterEmail,
				subject,
				html,
				text
			});

			return !!result.data;
		} catch (error) {
			console.error('Failed to send voter invitation:', error);
			return false;
		}
	}

	static async sendBallotNotification(data: ballotNotificationData): Promise<boolean> {
		if (!resend) {
			console.warn('Email service not configured - RESEND_API_KEY missing');
			return false;
		}

		try {
			const subject = `New ballot available: ${data.ballotTitle}`;
			const ballotUrl = `${PUBLIC_APP_URL}/ballots/${data.ballotId}`;

			const html = this.generateBallotNotificationHTML(data, ballotUrl);
			const text = this.generateBallotNotificationText(data, ballotUrl);

			const result = await resend.emails.send({
				from: this.fromEmail,
				to: data.voterEmail,
				subject,
				html,
				text
			});

			return !!result.data;
		} catch (error) {
			console.error('Failed to send ballot notification:', error);
			return false;
		}
	}

	static async sendBulkVoterInvitations(invitations: VoterInvitationData[]): Promise<number> {
		let successCount = 0;

		// Send emails in batches to avoid rate limiting
		const batchSize = 10;
		for (let i = 0; i < invitations.length; i += batchSize) {
			const batch = invitations.slice(i, i + batchSize);
			const results = await Promise.all(
				batch.map((invitation) => this.sendVoterInvitation(invitation))
			);
			successCount += results.filter((success) => success).length;

			// Small delay between batches
			if (i + batchSize < invitations.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		return successCount;
	}

	private static generateVoterInvitationHTML(
		data: VoterInvitationData,
		ballotUrl: string,
		authUrl: string
	): string {
		const greeting = data.voterName ? `Hello ${data.voterName}` : 'Hello';
		const votingPeriod = `${data.votingOpensAt.toLocaleDateString()} - ${data.votingClosesAt.toLocaleDateString()}`;
		const thresholdLabel = this.getThresholdLabel(data.votingThreshold, data.thresholdPercentage);

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>Voting Invitation - CampVotr</title>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background: #007bff; color: white; padding: 20px; text-align: center; }
					.content { padding: 20px; background: #f9f9f9; }
					.button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
					.footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
					.warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 4px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>CampVotr</h1>
						<p>You've been invited to vote!</p>
					</div>
					<div class="content">
						<p>${greeting},</p>
						<p>You have been invited to vote on the following ballot:</p>

						<h2>${data.ballotTitle}</h2>
						<p>${data.ballotDescription}</p>

						<p><strong>Voting Period:</strong> ${votingPeriod}</p>
						<p><strong>Voting Threshold:</strong> ${thresholdLabel}</p>
						<p><em>This ballot requires ${thresholdLabel.toLowerCase()} of eligible voters to vote "yes" in order to pass.</em></p>

						${
							!data.isRegisteredUser
								? `
							<div class="warning">
								<p><strong>Account Required:</strong> You'll need to create a free account to vote. Click the link below to get started.</p>
							</div>
						`
								: ''
						}

						<p>
							<a href="${ballotUrl}" class="button">View Ballot & Vote</a>
						</p>

						${
							!data.isRegisteredUser
								? `
							<p>If you don't have an account yet, <a href="${authUrl}">create one here</a> using this email address (${data.voterEmail}).</p>
						`
								: ''
						}
					</div>
					<div class="footer">
						<p>This email was sent by CampVotr. If you believe you received this in error, please ignore this message.</p>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	private static generateVoterInvitationText(
		data: VoterInvitationData,
		ballotUrl: string,
		authUrl: string
	): string {
		const greeting = data.voterName ? `Hello ${data.voterName}` : 'Hello';
		const votingPeriod = `${data.votingOpensAt.toLocaleDateString()} - ${data.votingClosesAt.toLocaleDateString()}`;
		const thresholdLabel = this.getThresholdLabel(data.votingThreshold, data.thresholdPercentage);

		return `
${greeting},

You have been invited to vote on the following ballot:

${data.ballotTitle}
${data.ballotDescription}

Voting Period: ${votingPeriod}
Voting Threshold: ${thresholdLabel}

This ballot requires ${thresholdLabel.toLowerCase()} of eligible voters to vote "yes" in order to pass.

${
	!data.isRegisteredUser
		? "ACCOUNT REQUIRED: You'll need to create a free account to vote.\n\n"
		: ''
}

View Ballot & Vote: ${ballotUrl}

${
	!data.isRegisteredUser
		? `If you don't have an account yet, create one here: ${authUrl}\nUse this email address: ${data.voterEmail}\n\n`
		: ''
}

---
This email was sent by CampVotr. If you believe you received this in error, please ignore this message.
		`.trim();
	}

	private static generateBallotNotificationHTML(
		data: ballotNotificationData,
		ballotUrl: string
	): string {
		const greeting = data.voterName ? `Hello ${data.voterName}` : 'Hello';
		const votingPeriod = `${data.votingOpensAt.toLocaleDateString()} - ${data.votingClosesAt.toLocaleDateString()}`;
		const thresholdLabel = this.getThresholdLabel(data.votingThreshold, data.thresholdPercentage);

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>New Ballot Available - CampVotr</title>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background: #28a745; color: white; padding: 20px; text-align: center; }
					.content { padding: 20px; background: #f9f9f9; }
					.button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
					.footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>CampVotr</h1>
						<p>New Ballot Available</p>
					</div>
					<div class="content">
						<p>${greeting},</p>
						<p>A new ballot is now available:</p>

						<h2>${data.ballotTitle}</h2>
						<p>${data.ballotDescription}</p>

						<p><strong>Voting Period:</strong> ${votingPeriod}</p>
						<p><strong>Voting Threshold:</strong> ${thresholdLabel}</p>
						<p><em>This ballot requires ${thresholdLabel.toLowerCase()} of eligible voters to vote "yes" in order to pass.</em></p>

						<p>
							<a href="${ballotUrl}" class="button">View Ballot & Vote</a>
						</p>
					</div>
					<div class="footer">
						<p>This email was sent by CampVotr. You can manage your notification preferences in your account settings.</p>
					</div>
				</div>
			</body>
			</html>
		`;
	}

	private static generateBallotNotificationText(
		data: ballotNotificationData,
		ballotUrl: string
	): string {
		const greeting = data.voterName ? `Hello ${data.voterName}` : 'Hello';
		const votingPeriod = `${data.votingOpensAt.toLocaleDateString()} - ${data.votingClosesAt.toLocaleDateString()}`;
		const thresholdLabel = this.getThresholdLabel(data.votingThreshold, data.thresholdPercentage);

		return `
	${greeting},

	A new ballot is now available:

	${data.ballotTitle}
	${data.ballotDescription}

	Voting Period: ${votingPeriod}
	Voting Threshold: ${thresholdLabel}

	This ballot requires ${thresholdLabel.toLowerCase()} of eligible voters to vote "yes" in order to pass.

	View Ballot & Vote: ${ballotUrl}

	---
	This email was sent by CampVotr. You can manage your notification preferences in your account settings.
			`.trim();
	}

	static async sendBallotReminderEmail(data: BallotReminderEmailData): Promise<boolean> {
		if (!resend) {
			console.warn('Email service not configured - RESEND_API_KEY missing');
			return false;
		}
		try {
			const noun = data.type === 'open' ? 'opens' : 'closes';
			const subject = `Ballot ${noun} in ${data.minutes} min: ${data.ballotTitle}`;
			const ballotUrl = `${PUBLIC_APP_URL}/ballots/${data.ballotId}`;
			const whenStr = data.when.toUTCString();
			const html = `
				<!DOCTYPE html>
				<html><body>
					<p>${data.voterName ? `Hello ${data.voterName},` : 'Hello,'}</p>
					<p>Reminder: <strong>${data.ballotTitle}</strong> ${noun} in ${data.minutes} minute$${'{data.minutes === 1 ? "" : "s"}'} (${whenStr} UTC).</p>
					<p><a href="${ballotUrl}">View ballot</a></p>
				</body></html>`;
			const text = `Reminder: ${data.ballotTitle} ${noun} in ${data.minutes} minutes (${whenStr} UTC).\n${ballotUrl}`;
			const result = await resend.emails.send({
				from: this.fromEmail,
				to: data.voterEmail,
				subject,
				html,
				text
			});
			return !!result.data;
		} catch (error) {
			console.error('Failed to send ballot reminder email:', error);
			return false;
		}
	}

	static async sendBallotOpenedEmail(data: BallotOpenedEmailData): Promise<boolean> {
		if (!resend) {
			console.warn('Email service not configured - RESEND_API_KEY missing');
			return false;
		}
		try {
			const subject = `Voting is now open: ${data.ballotTitle}`;
			const ballotUrl = `${PUBLIC_APP_URL}/ballots/${data.ballotId}`;
			const html = `<!DOCTYPE html><html><body>
				<p>${data.voterName ? `Hello ${data.voterName},` : 'Hello,'}</p>
				<p>Voting is now open for <strong>${data.ballotTitle}</strong>.</p>
				<p>Voting closes at ${data.closesAt.toUTCString()} UTC.</p>
				<p><a href="${ballotUrl}">Cast your vote</a></p>
			</body></html>`;
			const text = `Voting is now open for ${data.ballotTitle}. Closes at ${data.closesAt.toUTCString()} UTC.\n${ballotUrl}`;
			const result = await resend.emails.send({
				from: this.fromEmail,
				to: data.voterEmail,
				subject,
				html,
				text
			});
			return !!result.data;
		} catch (error) {
			console.error('Failed to send ballot opened email:', error);
			return false;
		}
	}

	static async sendBallotClosedEmail(data: BallotClosedEmailData): Promise<boolean> {
		if (!resend) {
			console.warn('Email service not configured - RESEND_API_KEY missing');
			return false;
		}
		try {
			const subject = `Voting is now closed: ${data.ballotTitle}`;
			const ballotUrl = `${PUBLIC_APP_URL}/ballots/${data.ballotId}`;
			const html = `<!DOCTYPE html><html><body>
				<p>${data.voterName ? `Hello ${data.voterName},` : 'Hello,'}</p>
				<p>Voting is now closed for <strong>${data.ballotTitle}</strong>.</p>
				<p>You can view the ballot here: <a href="${ballotUrl}">${ballotUrl}</a></p>
			</body></html>`;
			const text = `Voting is now closed for ${data.ballotTitle}. View ballot: ${ballotUrl}`;
			const result = await resend.emails.send({
				from: this.fromEmail,
				to: data.voterEmail,
				subject,
				html,
				text
			});
			return !!result.data;
		} catch (error) {
			console.error('Failed to send ballot closed email:', error);
			return false;
		}
	}
}

async function main() {
	return EmailService.sendBallotClosedEmail({
		ballotId: '1',
		ballotTitle: 'Test Ballot',
		voterEmail: 'test@example.com',
		voterName: 'Test User'
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	// This code runs only when the module is executed directly
	console.log('This is the main module!');
}
