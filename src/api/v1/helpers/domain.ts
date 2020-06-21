// Imports
import { parse } from "psl";
import { Document } from "mongoose";
import { ObjectId } from "bson";
import { promises } from "dns";
import { encode, test } from "ihacks-hash";
import {
	Codes,
	InternalError,
	domainTooLong,
	domainTooShort,
	domainInvalid,
	domainMismatch,
	domainStartsOrEndsWithDash,
	labelTooLong,
	labelTooShort,
	domainTaken,
	domainNotFound,
	domainNonExistant
} from "../../../error/GlixError";
import * as User from "./user";
import DomainModel from "../../../models/Domain.model";


export const isValid = (domainName: string) => new Promise<void>(async (resolve, reject) => {
	const output = parse(domainName);
	if (output.error)
	{
		const { code } = output.error;
		if (code === "DOMAIN_TOO_LONG") return reject(domainTooLong);
		if (code === "DOMAIN_TOO_SHORT") return reject(domainTooShort);
		if (code === "LABEL_ENDS_WITH_DASH") return reject(domainStartsOrEndsWithDash);
		if (code === "LABEL_STARTS_WITH_DASH") return reject(domainStartsOrEndsWithDash);
		if (code === "LABEL_INVALID_CHARS") return reject(domainInvalid);
		if (code === "LABEL_TOO_LONG") return reject(labelTooLong);
		if (code === "LABEL_TOO_SHORT") return reject(labelTooShort);
	}
	resolve();
});

export const isValidSLD = (domainName: string) => new Promise<void>(async (resolve, reject) => {
	try
	{
		await isValid(domainName);
		const output = parse(domainName);
		const { input, domain } = (output as any as {[key: string]: string});
		if (input !== domain) return reject(domainMismatch);
		resolve();
	} catch (error)
	{
		reject(error);
	}
});

export const getSLD = (domainName: string) => new Promise<string>(async (resolve, reject) => {
	try
	{
		await isValid(domainName);
		const { domain } = parse(domainName) as any as { [key: string]: string };
		resolve(domain);
	} catch (error)
	{
		reject(error);
	}
});

export const hasSLD = (domainName: string) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		await isValid(domainName);
		const domain = await getSLD(domainName);
		const entry = await DomainModel.findOne({ domain });
		if (!entry) return resolve(false);
		resolve(true);
	} catch (error)
	{
		reject(error);
	}
});

export const getBySLD = (domainName: string) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		await isValid(domainName);
		const domain = await getSLD(domainName);
		const entry = await DomainModel.findOne({ domain });
		if (!entry) return reject(new InternalError({
			blame: "server",
			message: `Could not find entry with domain '${domainName}'.`,
			why: "The domain entry could not be found.",
			how: "Add a new domain to an account with that domain name.",
			code: Codes.DomainNotFound
		}));
		resolve(entry);
	} catch (error)
	{
		reject(error);
	}
});

export const by = (owner: string) => new Promise<Document[]>(async (resolve, reject) => {
	try
	{
		const entry = await DomainModel.find({ owner });
		resolve(entry);
	} catch (error)
	{
		reject(error);
	}
});

export const domainExists = (domain: string) => new Promise<void>(async (resolve, reject) => {
	promises.resolveAny(domain)
		.then(async () => resolve())
		.catch(async error => {
			if (error.code === "ENOTFOUND") reject(domainNonExistant);
			else reject(error);
		});
});

export const createDomain = (domain: string, user: User.UserObject) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		await isValidSLD(domain);
		await domainExists(domain);
		if (await hasSLD(domain)) return reject(domainTaken);
		new DomainModel({
			owner: user._id.toString(),
			domain,
			pending: true
		}).save().then(resolve).catch(reject);
	} catch (error)
	{
		reject(error);
	}
});

export const removeDomain = (domain: string) => new Promise<void>(async (resolve, reject) => {
	try
	{
		await isValidSLD(domain);
		if (!await hasSLD(domain)) return reject(domainNotFound);
		DomainModel.findOneAndRemove({ domain })
			.then(async () => resolve())
			.catch(reject);
	} catch (error)
	{
		reject(error);
	}
});

export const getPending = () => new Promise<Document[]>(async (resolve, reject) => {
	try
	{
		const entries = await DomainModel.find({ pending: true });
		resolve(entries);
	} catch (error)
	{
		reject(error);
	}
});

export const verifyDomain = (domain: string) => new Promise<void>(async (resolve, reject) => {
	try
	{
		const entry = await getBySLD(domain);
		(entry as any).pending = false;
		entry.save().then(async () => resolve()).catch(reject);
	} catch (error)
	{
		reject(error);
	}
});

export const _checkDomain = (domain: string, username: string) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		const addresses = await promises.resolveTxt(domain);
		for (let e of addresses)
		{
			const text = e.join();
			if (!/^(GLIX-VERIFICATION)(\s+)([a-f0-9]+)$/gi.test(text)) continue;
			else
			{
				const txt = encode(text.replace(/(GLIX-VERIFICATION)(\s+)/gi, ""), "hex", "base64");
				const isValid = test(txt, username + ":" + domain, process.env.MAILGUN_API_KEY);
				if (isValid) return resolve(true);
			}
		}
		resolve(false);
	} catch (error)
	{
		reject(error);
	}
});

export const checkDomain = (domain: string, username: string, attempts: number = 5) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		for (let i = 0; i < attempts; i++)
		{
			try
			{
				const isVerified = await _checkDomain(domain, username);
				if (isVerified) return resolve(true);
			} catch (error)
			{
				return reject(error);
			}
		}
		resolve(false);
	} catch (error)
	{
		reject(error);
	}
});

export interface DomainEntry
{
	owner: string;
	domain: string;
	pending: boolean;
}

export interface DomainEntryObject extends DomainEntry
{
	_id: ObjectId;
}
