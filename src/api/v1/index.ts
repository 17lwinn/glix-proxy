// Imports
import { Router, Request, Response, NextFunction } from "express";
import { test, hash, encode } from "ihacks-hash";
import Collection from "@discordjs/collection";
import { Logger } from "ihacks-log";
import { createHmac, randomBytes } from "crypto";
import { setServers } from "dns";
import {
	GlixError,
	ServerError,
	InternalError,
	requestMissingBody,
	loginRequestMissingUsername,
	loginRequestMissingPassword,
	adminAuthError,
	authError,
	noAuthError,
	Codes,
	loginIncorrect,
	notVerified,
	verificationTokenInvalid,
	usernameNotFound,
	idNotFound,
	domainNotFound,
	domainPending,
	targetDomainInvalid
} from "../../error/GlixError";
import { createLogger } from "../../logger";
import * as User from "./helpers/user";
import * as Domain from "./helpers/domain";
import * as Proxy from "./helpers/proxy";
import {
	sendVerificationEmail,
	sendDomainPendingEmail,
	sendDomainVerifiedEmail
} from "../../other/Mailer";

type Middleware = (logger: Logger, req: Request & { _ip: string }, res: Response, resolve: () => void, reject: (error: Error) => void) => void;
type Endpoint = (logger: Logger, req: Request & { user: User.UserObject, _ip: string }, resolve: (data: any) => void, reject: (error: Error) => void) => void;

setServers([ "208.67.222.222", "208.67.220.220" ]);

// Middlewares

export interface Session
{
	since: number;
	id: string;
	user: User.UserObject;
}

const emailVerificationTokens = new class extends Collection<string, { since: number, id: string }>
{
	public lifetime: number = 1000 * 60 * 60 * 2;
	
	public create (user: User.UserObject): string
	{
		const salt = randomBytes(4).toString("utf8");
		const token = encode(salt, "utf8", "hex") + createHmac("sha256", process.env.MAILGUN_API_KEY as string).update(salt + user.username).digest("hex");
		this.sweep(tokens => tokens.id === user._id.toString());
		this.set(token, { since: Date.now(), id: user._id.toString() });
		return token;
	}
}

const sessions = new class extends Collection<string, Session>
{
	public lifetime: number = 1000 * 60 * 60 * 2;
	
	public reliveSession (id: string): Session | void
	{
		if (this.has(id))
		{
			const session = this.get(id) as Session;
			session.since = Date.now();
			this.set(session.id, session);
		}
		return this.get(id);
	}
	
	public getSessionUser (id: string): User.UserObject | void
	{
		const session = this.reliveSession(id)
		if (session) return session.user;
	}
	
	public loadSessions ()
	{
		
	}
	
	public saveSessions ()
	{
		
	}
};

setInterval(() => {
	sessions.sweep(s => s.since + sessions.lifetime <= Date.now());
	emailVerificationTokens.sweep(t => t.since + emailVerificationTokens.lifetime <= Date.now());
}, 300_000);

// API Middleware
export const expressify = (name: string, endpoint: Endpoint) => async (req: Request, res: Response) => {
	const logger = createLogger(name, (req as any as Request&{_ip:string})._ip);
	const now = Date.now();
	new Promise<any>(async (resolve, reject) => {
		try
		{
			logger.debug("Incoming request.");
			endpoint(logger, req as any, resolve, reject);
		} catch (error)
		{
			reject(error);
		}
	}).then(async data => {
		res.json({ data, error: null });
	}).catch(async error => {
		logger.warn("Received error from endpoint.");
		if (error instanceof GlixError)
		{
			res.set("Content-Type", "application/json").json({ data: null, error: error.json() });
			logger.error(error.message);
		} else
		{
			logger.error(error.stack);
			res.set("Content-Type", "application/json").json({ data: null, error: new ServerError({ blame: "server", message: error.message, why: "Unexpected error was thrown on server." }) });
		}
	}).finally(async () => {
		logger.info("Request used %d ms", Date.now() - now);
	});
};

export const middleware = (name: string, endpoint: Middleware) => async (req: Request, res: Response, next: NextFunction) => {
	const logger = createLogger(name, (req as any as Request&{_ip:string})._ip);
	new Promise<any>(async (resolve, reject) => {
		try
		{
			endpoint(logger, req as any, res as any, resolve, reject);
		} catch (error)
		{
			reject(error);
		}
	}).then(async () => next()).catch(async error => {
		logger.warn("Received error from middleware.");
		if (error instanceof GlixError)
		{
			res.set("Content-Type", "application/json").json({ data: null, error: error.json() });
			logger.error(error.message);
		} else
		{
			logger.error(error.stack);
			res.set("Content-Type", "application/json").json({ data: null, error: new ServerError({ blame: "server", message: error.message, why: "Unexpected error was thrown on server." }) });
		}
	});
};

// Middlewares
export const noauthMiddleware: Middleware = async (logger, req, res, resolve, reject) => {
	if (typeof req.headers.authorization === "string") reject(noAuthError);
	else resolve();
};
export const noauth = middleware("mwNoAuth", noauthMiddleware);

export const authMiddleware: Middleware = async (logger, req, res, resolve, reject) => {
	if (typeof req.headers.authorization === "string")
		if (!sessions.has(req.headers.authorization))
			reject(authError);
		else
		{
			(req as any).user = sessions.getSessionUser(req.headers.authorization);
			resolve();
		}
	else reject(authError);
};
export const auth = middleware("mwAuth", authMiddleware);

export const adminAuthMiddleware: Middleware = async (logger, req, res, resolve, reject) => {
	if (typeof req.headers.authorization === "string")
		if (!sessions.has(req.headers.authorization))
			reject(authError);
		else
		{
			const r = (req as Request & { user: User.UserObject, _ip: string });
			r.user = sessions.getSessionUser(req.headers.authorization) as any;
			if (!r.user.admin) reject(adminAuthError);
			else resolve();
		}
	else reject(authError);
};
export const adminAuth = middleware("mwAdminAuth", adminAuthMiddleware);

// API
export const register: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("Beginning user registration.");
	User.create(req.body).then(data => {
		const d = data.toObject() as User.UserObject;
		logger.info("Created user %s, %s", d.email, d.username);
		const token = emailVerificationTokens.create(d);
		logger.info("Sending mail to user %s on email %s", d.username, d.email);
		sendVerificationEmail(d.email, d.username, token)
			.then(async () => {
				resolve(true);
			}).catch(async error => {
				reject(error);
			});
	}).catch(reject);
};

export const login: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("Beginning login process.");
	if (!req.body) return reject(requestMissingBody);
	if (!req.body.username) return reject(loginRequestMissingUsername);
	if (!req.body.password) return reject(loginRequestMissingPassword);
	let user!: User.UserObject;
	try
	{
		user = (await User.fetch(req.body)).toObject();
	} catch (error)
	{
		if (error instanceof InternalError && ( error.code === Codes.UserIDNotFound || error.code === Codes.UserEmailNotFound || error.code === Codes.UserNameNotFound ))
			return reject(loginIncorrect);
		return reject(error);
	}
	if (!test(user.hash, req.body.password)) return reject(loginIncorrect);
	if (!user.verified) return reject(notVerified);
	const s = {
		since: Date.now(),
		user,
		id: hash("sha512", user._id.toString())
	};
	(s.user as any).token = s.id;
	sessions.set(s.id, s);
	resolve(s.id);
};

export const verify: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("Starting verification for user %s", req.params.user);
	try
	{
		if (!(await User.has({ username: req.params.user }))) return reject(usernameNotFound);
		if (!emailVerificationTokens.has(req.params.token)) return reject(verificationTokenInvalid);
		emailVerificationTokens.delete(req.params.token);
		await User.verifyUser({ username: req.params.user });
		resolve(true);
	} catch (error)
	{
		reject(error);
	}
};

export const adminVerify: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("Admin %s is attempting to send a verification token to user ID: %s", req.user.username, req.params.id);
	try
	{
		if (!await User.has({ _id: req.params.id })) return reject(idNotFound);
		const user = (await User.get(req.params.id as any)).toObject() as User.UserObject;
		const token = emailVerificationTokens.create(user);
		logger.info("Admin %s is sending a verification email to %s on email %s.", req.user.username, user.username, user.email);
		sendVerificationEmail(user.email, user.username, token)
			.then(async () => resolve(true))
			.catch(async error => reject(error));
	} catch (error)
	{
		reject(error);
	}
};

export const userGet: Endpoint = async (logger, req, resolve, reject) => resolve(req.user);

export const userLogout: Endpoint = async (logger, req, resolve, reject) => (sessions.delete((req.user as any).token), resolve(true));

export const domainAdd: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("Attempting to add domain %s to the database as pending.", req.params.domain);
	try
	{
		const entry = (await Domain.createDomain(req.params.domain, req.user)).toObject() as any as Domain.DomainEntryObject;
		logger.info("Successfully added domain %s to the database under the account of %s.", req.params.domain, req.user.username);
		const token = encode(hash("sha512", req.user.username + ":" + entry.domain, process.env.MAILGUN_API_KEY), "base64", "hex");
		logger.info("Sending email verification to user %s", req.user.username);
		await sendDomainPendingEmail(req.user.email, req.user.username, req.params.domain, token);
		resolve(true);
	} catch (error)
	{
		reject(error);
	}
};

export const domainGetAll: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("User %s is attempting to retrieve all of their domains.", req.user.username);
	try
	{
		const entries = await Domain.by(req.user._id.toString());
		const e = entries.map(doc => doc.toObject());
		resolve(e);
	} catch (error)
	{
		reject(error);
	}
};

export const domainDelete: Endpoint = async (logger, req, resolve, reject) => {
	logger.info("User %s attempts to delete domain %s.", req.user.username, req.params.domain);
	try
	{
		const entry = await Domain.getBySLD(req.params.domain);
		if ((entry as any).owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		entry.remove().then(async () => resolve("ok")).catch(reject);
	} catch (error)
	{
		reject(error);
	}
};

export const domainCheck: Endpoint = async (logger, req, resolve, reject) => { // DEBUG
	logger.info("User %s is attempting to perform a domain check for %s.", req.user.username, req.params.domain);
	try
	{
		logger.debug("Fetching domain entry %s", req.params.domain);
		const entry = await Domain.getBySLD(req.params.domain) as any as Domain.DomainEntryObject;
		logger.debug("Fetching user entry.");
		const user = await User.get((entry as any).owner) as any as User.UserObject;
		logger.debug("Checking user access for %s regarding %s.", req.user.username, entry.domain);
		if (entry.owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		if (entry.owner.toString() !== req.user._id.toString()) logger.debug("User %s is an admin!", req.user.username);
		else logger.debug("User %s owns the domain %s.", req.user.username, entry.domain);
		const isVerified = await Domain.checkDomain(entry.domain, user.username);
		if (isVerified)
		{
			logger.debug("Domain %s has a valid text record.", entry.domain);
			logger.debug("Attempting to verify in database.");
			await Domain.verifyDomain(entry.domain);
			logger.success("Domain %s is verified, sending email now.", entry.domain);
			sendDomainVerifiedEmail(user.email, user.username, entry.domain)
				.then(async () => {
					logger.success("Send domain verification email to %s regarding domain %s", user.username, entry.domain);
				}).catch(async error => {
					logger.error("Failed to send domain verification email to %s regarding domain %s", user.username, entry.domain);
					logger.error(error);
				});
		}
	} catch (error)
	{
		reject(error);
	}
};

export const reverseProxyAdd: Endpoint = async (logger, req, resolve, reject) => {
	try
	{
		if (!Domain.isValid(req.body.target)) return reject(targetDomainInvalid);
		logger.debug("Fetching domain entry %s", req.params.domain);
		const entry = await Domain.getBySLD(req.params.domain) as any as Domain.DomainEntryObject;
		logger.debug("Fetching user entry.");
		logger.debug("Checking user access for %s regarding %s.", req.user.username, entry.domain);
		if (entry.owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		if (entry.owner.toString() !== req.user._id.toString()) logger.debug("User %s is an admin!", req.user.username);
		else logger.debug("User %s owns the domain %s.", req.user.username, entry.domain);
		if (entry.pending) return reject(domainPending);
		logger.debug("Attempting to add domain %s to point to %s.", entry.domain, )
		await Proxy.create({
			domainID: entry._id.toString(),
			ownerID: entry._id.toString(),
			entry: req.params.domain,
			host: req.body.target,
			port: 443
		});
		resolve(true);
	} catch (error)
	{
		reject(error);
	}
};

export const reverseProxyDelete: Endpoint = async (logger, req, resolve, reject) => {
	try
	{
		logger.debug("Fetching domain entry %s", req.params.domain);
		const entry = await Domain.getBySLD(req.params.domain) as any as Domain.DomainEntryObject;
		logger.debug("Fetching user entry.");
		logger.debug("Checking user access for %s regarding %s.", req.user.username, entry.domain);
		if (entry.owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		if (entry.owner.toString() !== req.user._id.toString()) logger.debug("User %s is an admin!", req.user.username);
		else logger.debug("User %s owns the domain %s.", req.user.username, entry.domain);
		await Proxy.del(req.params.domain);
		resolve(true);
	} catch (error)
	{
		reject(error);
	}
};

export const reverseProxyUpdate: Endpoint = async (logger, req, resolve, reject) => {
	try
	{
		logger.debug("Fetching domain entry %s", req.params.domain);
		const entry = await Domain.getBySLD(req.params.domain) as any as Domain.DomainEntryObject;
		logger.debug("Fetching user entry.");
		logger.debug("Checking user access for %s regarding %s.", req.user.username, entry.domain);
		if (entry.owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		if (entry.owner.toString() !== req.user._id.toString()) logger.debug("User %s is an admin!", req.user.username);
		else logger.debug("User %s owns the domain %s.", req.user.username, entry.domain);
		reject(new Error("Not implemented!"));
	} catch (error)
	{
		reject(error);
	}
};

export const reverseProxyPresent: Endpoint = async (logger, req, resolve, reject) => {
	try
	{
		logger.debug("Fetching domain entry %s", req.params.domain);
		const entry = await Domain.getBySLD(req.params.domain) as any as Domain.DomainEntryObject;
		logger.debug("Fetching user entry.");
		logger.debug("Checking user access for %s regarding %s.", req.user.username, entry.domain);
		if (entry.owner.toString() !== req.user._id.toString() && !req.user.admin) return reject(domainNotFound);
		if (entry.owner.toString() !== req.user._id.toString()) logger.debug("User %s is an admin!", req.user.username);
		else logger.debug("User %s owns the domain %s.", req.user.username, entry.domain);
		if (await Proxy.has({ entry: req.params.domain })) return resolve(true);
		resolve(false);
	} catch (error)
	{
		reject(error);
	}
};

// Router

export const router: Router = Router();

// Routes
router.put("/user", noauth, expressify("user.regster", register));
router.post("/user", noauth, expressify("user.login", login));
router.get("/user", auth, expressify("user.get", userGet));
router.get("/user/logout", auth, expressify("user.logout", userLogout));

router.get("/user/:user/:token", expressify("user.verify", verify));

router.get("/user/admin/:id/verify", adminAuth, expressify("user.admin.verify", adminVerify));

router.put("/domain/:domain", auth, expressify("domain.add", domainAdd));
router.get("/domain", auth, expressify("domain.getAll", domainGetAll));
//router.get("/domain/:domain", auth, expressify("domain.getAll", domainGet));
router.delete("/domain/:domain", auth, expressify("domain.delete", domainDelete));
router.post("/domain/:domain", auth, expressify("domain.check", domainCheck)); // DEBUGGER

router.put("/proxy/:domain", auth, expressify("proxy.add", reverseProxyAdd));
router.post("/proxy/:domain", auth, expressify("proxy.set", reverseProxyUpdate));
router.delete("/proxy/:domain", auth, expressify("proxy.delete", reverseProxyDelete));
router.get("/proxy/:domain", auth, expressify("proxy.get", reverseProxyPresent));
