export class GlixError extends Error
{
	
	public blame: string;
	public how?: string;
	public why?: string;
	public code: number;
	
	public constructor (options: { message: string, why?: string, how?: string, blame: string, code?: number })
	{
		const { message, why, how, blame } = options;
		super(message);
		this.blame = blame;
		this.why = why;
		this.how = how;
		this.code = typeof options.code === "number" ? options.code : -1;
	}
	
	public json (): { message: string, why?: string, how?: string, blame: string, code: number }
	{
		return {
			message: this.message,
			why: this.why,
			how: this.how,
			blame: this.blame,
			code: this.code
		};
	}
	
}

export class RequestError extends GlixError
{
	public constructor (options: { message: string, why?: string, how?: string, blame?: string, code?: number })
	{
		if (typeof options.blame !== "string") options.blame = "request";
		super(options as any);
	}
}

export class ServerError extends GlixError
{
	public constructor (options: { message: string, why?: string, how?: string, blame?: string, code?: number })
	{
		if (typeof options.blame !== "string") options.blame = "server";
		super(options as any);
	}
	
	public json (): { message: string, why?: string, how?: string, blame: string, code: number }
	{
		const data = super.json();
		data.message = "An unexpected server error occured, please contact system administrator.";
		data.why = undefined;
		data.how = "Contact system administrator regarding server errors.";
		return data;
	}
}

export class InternalError extends ServerError {}

export enum Codes
{
	UnexpectedAuth               = 0x0C0,
	ExpectedAuth                 = 0x0C1,
	AdminAuth                    = 0x0C2,
	InvalidAuth                  = 0x0C3,
	
	UserEmaiInvalid              = 0xA00,
	UserNameInvalid              = 0xA01,
	UserVerificationTokenInvalid = 0xA02,
	
	UserEmpty                    = 0xA10,
	UserIncorrect                = 0xA11,
	UserNotVerified              = 0xA12,
	
	UserMissingUsername          = 0xA20,
	UserMissingPassword          = 0xA21,
	UserMissingEmail             = 0xA22,
	
	UserPasswordTooShort         = 0xA30,
	UserNameTooShort             = 0xA31,
	UserNameTooLong              = 0xA32,
	
	UserIDNotFound               = 0xA40,
	UserNameNotFound             = 0xA41,
	UserEmailNotFound            = 0xA42,
	
	UserNameTaken                = 0xA70,
	UserEmailTaken               = 0xA71,
	
	DomainTooShort               = 0xD0,
	DomainTooLong                = 0xD1,
	DomainDash                   = 0xD2,
	DomainLabelTooLong           = 0xD3,
	DomainLabelTooShort          = 0xD4,
	DomainInvalid                = 0xD5,
	DomainMismatch               = 0xD6,
	
	DomainNotFound               = 0xDC0,
	DomainTaken                  = 0xDC1,
	DomainPending                = 0xDC2,
	DomainVerified               = 0xDC3,
	DomainNonExistant            = 0xDC4,
	
	TargetDomainInvalid          = 0xD70,
	TargetDomainExists           = 0xD71,
}

export const noAuthError = new RequestError({
	blame: "request",
	message: "Unexpected authentication header.",
	code: Codes.UnexpectedAuth,
	how: "Remove the authentication header from the request.",
	why: "An authentication was included in the request whereas the header was not expected."
});
export const authError = new RequestError({
	blame: "request",
	message: "Expected authentication header.",
	code: Codes.ExpectedAuth,
	how: "Receive an authentication token from login route and set that as the authorization header.",
	why: "An authorization header was not included in the request headers."
});
export const adminAuthError = new RequestError({
	blame: "request",
	message: "You are unauthorized to do that.",
	code: Codes.AdminAuth,
	why: "Current user is not allowed to do that, this endpoint requires administrator authentication."
});

export const requestMissingBody = new RequestError({
	blame: "request",
	message: "Missing request body.",
	code: Codes.UserEmpty,
	why: "Missing a request body.",
	how: "Include a valid request body."
});

export const loginRequestMissingUsername = new RequestError({
	blame: "request",
	message: "Missing username.",
	code: Codes.UserMissingUsername,
	why: "Missing a username property in the request body.",
	how: "Include a username in the requesy body."
});

export const loginRequestMissingPassword = new RequestError({
	blame: "request",
	message: "Missing password.",
	code: Codes.UserMissingPassword,
	why: "Missing a password property in the request body.",
	how: "Include a password in the request body."
});

export const loginIncorrect = new RequestError({
	blame: "password",
	message: "Incorrect username and/or password.",
	code: Codes.UserIncorrect,
	why: "The username or password provided could not authenticate user.",
	how: "Send a valid username and password."
});

export const notVerified = new RequestError({
	blame: "request",
	message: "The authenticated user is not verified.",
	code: Codes.UserNotVerified,
	why: "The user has not yet been verified.",
	how: "Verify the user using the link sent to the user's mail address."
});

export const missingUsername = new RequestError({
	blame: "request",
	message: "Missing username property in request.",
	code: Codes.UserMissingUsername,
	why: "A username was not included in the user object.",
	how: "Include a valid username."
});

export const invalidUsername = new RequestError({
	blame: "username",
	message: "Invalid username.",
	code: Codes.UserNameInvalid,
	why: "The username included invalid characters.",
	how: "The username can only include a-z, 0-9 and underscore."
});

export const idNotFound = new InternalError({
	message: `Could not find user with that ID.`,
	blame: "server",
	why: "The user could not be found.",
	code: Codes.UserIDNotFound
});

export const emailTaken = new RequestError({
	blame: "email",
	message: "Email already exists.",
	code: Codes.UserEmailTaken,
	why: "Email has already been taken.",
	how: "Use a different email address."
});

export const usernameTaken = new RequestError({
	blame: "username",
	message: "Username already exists.",
	code: Codes.UserNameTaken,
	why: "Username has already been taken.",
	how: "Use a different username."
});

export const passwordTooShort = new RequestError({
	blame: "password",
	message: "Invalid password.",
	code: Codes.UserPasswordTooShort,
	why: "Password is than 8 characters long.",
	how: "Use a longer password."
});

export const missingPassword = new RequestError({
	blame: "request",
	message: "Missing password in request.",
	code: Codes.UserMissingPassword,
	why: "The email was not included in the user object.",
	how: "Include a valid password in the user request."
});

export const invalidEmail = new RequestError({
	blame: "email",
	message: "Invalid email address.",
	code: Codes.UserEmaiInvalid,
	why: "The email was invalid.",
	how: "Include a valid email in the user object."
});

export const missingEmail = new RequestError({
	blame: "request",
	message: "Missing email property in request.",
	code: Codes.UserMissingEmail,
	why: "An email was not included in the user object.",
	how: "Include a valid email."
});

export const usernameTooLong = new RequestError({
	blame: "username",
	message: "Username is too long.",
	code: Codes.UserNameTooLong,
	why: "The username was longer than 16 characters.",
	how: "Use a username that is shorter than 16 characters."
});

export const usernameTooShort = new RequestError({
	blame: "username",
	message: "Username is too short.",
	code: Codes.UserNameTooShort,
	why: "The username was shorter than 3 characters.",
	how: "Use a username that is longer than 3 characters."
});

export const verificationTokenInvalid = new RequestError({
	blame: "token",
	message: "Token is either invalid or has expired.",
	code: Codes.UserVerificationTokenInvalid,
	why: "The user's verification token is either invalid or has expired.",
	how: "Contact an administrator to receive a new token."
});

export const usernameNotFound = new RequestError({
	blame: "username",
	message: "Username not found.",
	code: Codes.UserNameNotFound,
	why: "The username could not be found in the database.",
	how: "Correct the username to an existing user, or create a new user with that username."
});

export const domainTooShort = new RequestError({
	blame: "domain",
	message: "Domain name too short.",
	code: Codes.DomainTooShort,
	why: "The given domain name is too short.",
	how: "Choose a longer domain name."
});

export const domainTooLong = new RequestError({
	blame: "domain",
	message: "Domain name too long.",
	code: Codes.DomainTooLong,
	why: "The given domain is longer than 255 characters.",
	how: "Choose a shorter domain name."
});

export const domainStartsOrEndsWithDash = new RequestError({
	blame: "domain",
	message: "Domain name starts or ends with dash.",
	code: Codes.DomainDash,
	why: "The given domain either starts and/or ends with a dash.",
	how: "Choose a domain that doesn't start and end with a dash."
});

export const labelTooLong = new RequestError({
	blame: "domain",
	message: "Domain name label is too long.",
	code: Codes.DomainLabelTooLong,
	why: "The given domain name label is longer than 63 characters.",
	how: "Choose a domain label that is shorter than 64 characters."
});

export const labelTooShort = new RequestError({
	blame: "domain",
	message: "Domain name label is too short.",
	code: Codes.DomainLabelTooShort,
	why: "The given domain label is shorter than 1 character.",
	how: "Include a domain label (SLD)."
});

export const domainInvalid = new RequestError({
	blame: "domain",
	message: "Domain name contains invalid characters.",
	code: Codes.DomainInvalid,
	why: "The given domain name contains invalid characters.",
	how: "Only include alphanumeric characters, dashes or punctations."
});

export const targetDomainInvalid = new RequestError({
	blame: "target",
	message: "Target domain name contains invalid characters.",
	code: Codes.TargetDomainInvalid,
	why: "The given target domain name contains invalid characters.",
	how: "Only include alphanumeric characters, dashes or punctations."
});

export const domainMismatch = new RequestError({
	blame: "domain",
	message: "Domain name contains more than suffix and label.",
	code: Codes.DomainMismatch,
	why: "The given domain contains a sub-domain.",
	how: "Do not include a sub-domain."
});

export const domainTaken = new RequestError({
	blame: "domain",
	message: "That domain name is already taken.",
	code: Codes.DomainTaken,
	why: "The given domain name has already been used.",
	how: "Choose a different domain name or contact system administrator."
});

export const domainNotFound = new RequestError({
	blame: "domain",
	message: "That domain name could not be found.",
	code: Codes.DomainNotFound,
	why: "The given domain name could not be found.",
	how: "Add that domain name to your account."
});

export const domainPending = new RequestError({
	blame: "domain",
	message: "That domain is still pending for dns verification.",
	code: Codes.DomainPending,
	why: "The domain has not yet finished its verification through DNS.",
	how: "Follow the instructions sent to your email."
});

export const domainVerified = new RequestError({
	blame: "domain",
	message: "That domain is already verified.",
	code: Codes.DomainVerified,
	why: "The given domain is already a verified domain and owned by a user.",
	how: "Choose a different domain name. If you believe this to be incorrect, contact a system administrator."
});

export const domainNonExistant = new RequestError({
	blame: "domain",
	message: "That domain could not be resolved.",
	code: Codes.DomainNonExistant,
	why: "The given domain doesn't appear to exist.",
	how: "Buy the given domain. If you believe this to be incorrect, contact a system administrator."
});

export const targetDomainExists = new RequestError({
	blame: "target",
	message: "There is already an entry in the proxy that uses that domain.",
	code: Codes.TargetDomainExists,
	why: "The given target domain already exists.",
	how: "Use a subdomain or a different one or a different domain."
});
