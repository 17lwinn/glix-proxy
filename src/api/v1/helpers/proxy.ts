// Imports
import { ObjectId } from "bson";
import { Document } from "mongoose";
import { Caddy } from "../../../other/Caddy";
import ProxyModel from "../../../models/ReverseProxy.model";
import { targetDomainExists } from "../../../error/GlixError";

const caddy = new Caddy(process.env.CADDY as string);

export const has = (query: ProxySearchQuery) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		const result = ProxyModel.findOne(query);
		resolve(!!result);
	} catch (error)
	{
		reject(error);
	}
});

export const create = (info: ProxyEntry) => new Promise<Document>(async (resolve, reject) => {
	try
	{
		if (await has({ entry: info.entry })) return reject(targetDomainExists);
		const e = await (new ProxyModel(info)).save();
		await link(info.entry, info.host, info.port);
		resolve(e);
	} catch (error)
	{
		reject(error);
	}
});

export const del = (target: string) => new Promise<void>(async (resolve, reject) => {
	try
	{
		await ProxyModel.deleteOne({ entry: target });
		await unlink(target);
	} catch (error)
	{
		reject(error);
	}
});

export const isLinked = (target: string) => new Promise<boolean>(async (resolve, reject) => {
	try
	{
		const has = await caddy.has(target);
		resolve(has);
	} catch (error)
	{
		reject(error);
	}
});

export const link = (target: string, dial: string, port: number) => new Promise<void>(async (resolve, reject) => {
	try
	{
		await caddy.add(target, dial, port);
		resolve();
	} catch (error)
	{
		reject(error);
	}
});

export const unlink = (target: string) => new Promise<void>(async (resolve, reject) => {
	try
	{
		await caddy.delete(target);
		resolve();
	} catch (error)
	{
		reject(error);
	}
});

export const getBy = (query: ProxySearchQuery) => new Promise<Document[]>(async (resolve, reject) => {
	try
	{
		const entry = await ProxyModel.find(query);
		resolve(entry);
	} catch (error)
	{
		reject(error);
	}
});

export interface ProxySearchQuery
{
	_id?: string;
	ownerID?: string;
	domainID?: string;
	entry?: string;
	host?: string;
	port?: number;
}

export interface ProxyEntry
{
	ownerID: string;
	domainID: string;
	entry: string;
	host: string;
	port: number;
}

export interface ProxyEntryObject extends ProxyEntry
{
	_id: ObjectId;
}
