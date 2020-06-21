// Imports
import { Document } from "mongoose";
import UserModel from "../../../models/User.model";
import {
	Codes,
	InternalError,
	emailTaken,
	usernameTaken,
	passwordTooShort,
	missingPassword,
	invalidEmail,
	missingEmail,
	usernameTooLong,
	usernameTooShort,
	missingUsername,
	invalidUsername,
	requestMissingBody,
	idNotFound
} from "../../../error/GlixError";
import { ObjectId } from "bson";
import { hash } from "ihacks-hash";

export const usernameSyntax: RegExp = /^[a-z0-9_]+$/gi;
export const emailSyntax: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const verificationTokenTime: number = 1000 * 60 * 60 * 24;

export const getByUsername = (username: string) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		const user = await UserModel.findOne({ username });
		if (!user) return reject(new InternalError({
			message: `Could not find user with username '${username}'.`,
			blame: "server",
			why: "The user could not be found.",
			how: `Register a new account with the username '${username}'.`,
			code: Codes.UserNameNotFound
		}));
		resolve(user);
	} catch (error)
	{
		reject(error);
	}
});

export const getByEmail = (email: string) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		const user = await UserModel.findOne({ email });
		if (!user) return reject(new InternalError({
			message: `Could not find user with email '${email}'.`,
			blame: "server",
			why: "The user could not be found.",
			how: `Register a new account with the email '${email}'.`,
			code: Codes.UserEmailNotFound
		}));
		resolve(user);
	} catch (error)
	{
		reject(error);
	}
});

export const get = (_id: ObjectId) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		const user = await UserModel.findById(_id);
		if (!user) return reject(idNotFound);
		resolve(user);
	} catch (error)
	{
		reject(error);
	}
});

export const fetch = ({ _id, username, email }: UserQuery) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		let user;
		if (_id) user = await get(_id as any);
		if (username) user = await getByUsername(username);
		if (email) user = await getByEmail(email);
		resolve(user);
	} catch (error)
	{
		reject(error);
	}
});

export const has = ({ _id, username, email }: { _id?: string, username?: string, email?: string }) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		await fetch({ _id, username, email });
		resolve(true);
	} catch (error)
	{
		if (error instanceof InternalError && ( error.code === Codes.UserIDNotFound || error.code === Codes.UserEmailNotFound || error.code === Codes.UserNameNotFound ))
			resolve(false);
	}
});

export const create = (user: { username: string, email: string, password: string }) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		if (!user) return reject(requestMissingBody);
		if (!user.username) return reject(missingUsername);
		if (!usernameSyntax.test(user.username)) return reject(invalidUsername);
		if (user.username.length < 3) return reject(usernameTooShort);
		if (user.username.length > 16) return reject(usernameTooLong);
		if (!user.email) return reject(missingEmail);
		if (!emailSyntax.test(user.email)) return reject(invalidEmail);
		if (!user.password) return reject(missingPassword);
		if (user.password.length < 8) return reject(passwordTooShort);
		if (await has({ username: user.username })) return reject(usernameTaken);
		if (await has({ email: user.email })) return reject(emailTaken);
		const password = user.password;
		(user as any).password = undefined;
		const u: UserInfo = user as any;
		u.hash = hash("sha512", password);
		u.admin = false;
		u.banned = false;
		u.beta = false;
		u.verified = null;
		new UserModel(u).save().then(async doc => resolve(doc)).catch(error => reject(error));
	} catch (error)
	{
		reject(error);
	}
});

export const verifyUser = (u: UserQuery) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		const user = await fetch(u);
		if (!(user as any).verified)
		{
			(user as any).verified = Date.now();
			user.save().then(resolve).catch(reject);
		}
		resolve(user);
	} catch (error)
	{
		reject(error);
	}
});

export interface UserQuery
{
	_id?: string;
	email?: string;
	username?: string;
}

export interface UserInfo
{
	email: string;
	username: string;
	hash: string;
	admin: boolean;
	beta: boolean;
	banned: boolean;
	verified: number | null;
}

export interface UserObject extends UserInfo
{
	_id: ObjectId;
}
