// Dependencies
import * as Mailgun from "mailgun-js";
import { getLogger } from "../logger";

const logger = getLogger("Mailgun");
const e: any = process.env;

logger.debug("Initializing the mailgun client.");

/** The mailgun client. */
export let mailer: Mailgun.Mailgun = Mailgun({
	domain: e.MAILGUN_DOMAIN,
	apiKey: e.MAILGUN_API_KEY,
	endpoint: "https://api.eu.mailgun.net/v3",
	host: "api.eu.mailgun.net"
});

/** The messages. */
export const messages: Mailgun.Messages = mailer.messages();

/** The sender. */
let from: string = e.MAILGUN_SENDER;

const yn = (s: any) => !!s ? "Yes" : "No";

/**
 * Send a mail to someone.
 * @param to The person to send a mail to.
 * @param content The content to send.
 * @param content.subject The subject of the email.
 * @param content.text The text content to send.
 * @param content.html The html content to send.
 */
export const sendMail = (to: string, { text, html, subject }: { text?: string, html?: string, subject: string }) => new Promise<Mailgun.messages.SendResponse>(async (resolve, reject) => {
	if (!from || !mailer || !messages)
	{
		logger.error("Mailgun has not been initialized.");
		return reject(new Error("Mailgun has not been initialized."));
	}
	logger.debug("Sending a mail to %s, includes text: %s, includes html: %s", to, yn(text), yn(html));
	messages.send({
		from,
		to,
		subject,
		text,
		html,
	}).then(async res => {
		logger.success("Successfully sent an email to %s.", to);
		resolve(res);
	}).catch(async error => {
		logger.error("Failed to send mail to %s", to);
		logger.error(error);
		reject(error);
	});
});

/**
 * Send a verification email to a user.
 * @param to The email address to send the email to.
 * @param username The user's username.
 * @param token The verification token.
 */
export const sendVerificationEmail = (to: string, username: string, token: string) => sendMail(to, {
	subject: "Glix: Please verify your email address.",
	text: `Hello ${username},\nPlease verify your account with Glix by using the link below.\nhttps://g.ihacks.dev/#/verify/${username}/${token}`,
	html: `<h1>Hello ${username},</h1><p>Please verify your account with Glix by using the link below.</p><p><a href="https://g.ihacks.dev/#/verify/${username}/${token}">https://g.ihacks.dev/#/verify/${username}/${token}</a></p>`
});

/**
 * Send a domain verification email to a user.
 * @param to The email address to send the email to.
 * @param username The user's username.
 * @param domain The domain name the user have added.
 * @param token The domain's token.
 */
export const sendDomainPendingEmail = (to: string, username: string, domain: string, token: string) => sendMail(to, {
	subject: "Glix: Verify your domain.",
	text: `Hello ${username},\nPlease verify your domain ${domain} by adding a txt record on your DNS provider for the given domain.\n\nTXT Record Host: ${domain}\n\nTXT Record Content:\nGLIX-VERIFICATION ${token}\n\nYou'll receive an email when the domain has been verified, if the domain is not verified within a week it will be removed from the database.`,
	html: `<h1>Hello ${username},</h1><p>Please verify your domain ${domain} by adding a txt record on your DNS provider for the given domain.</p> <p></p> <p></p> <p>TXT Record Host: ${domain}</p> <p></p> <p>TXT Record Content:</p><p>GLIX-VERIFICATION ${token}</p><p></p> <p>You'll receive an email when the domain has been verified, if the domain is not verified within a week it will be removed from the database.</p>`
});

/**
 * Send a domain verified email to a user.
 * @param to The email address to send the email to.
 * @param username The user's username.
 * @param domain The domain name that has been verified.
 */
export const sendDomainVerifiedEmail = (to: string, username: string, domain: string) => sendMail(to, {
	subject: "Glix: Domain has been verified.",
	text: `Hello ${username},\nWe're happy to tell you that your domain ${domain} has now been verified!`,
	html: `<h1>Hello ${username},</h1><p>We're happy to tell you that your domain ${domain} has now been verified!</p>`
});
