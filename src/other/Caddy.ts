// Imports
import fetch from "node-fetch";

export class Caddy
{
	
	public static fetch (url: string, method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE" = "GET", data?: any): Promise<void>
	{
		return new Promise<void>(async (resolve, reject) => {
			try
			{
				const response = await fetch(url, {
					method,
					...(() => typeof data !== "undefined" && method !== "GET" ? { body: JSON.stringify(data) } : {})(),
					headers: {
						"Content-Type": "application/json"
					}
				});
				const text = await response.text();
				if (text.trim().length > 0) reject(new Error(JSON.parse(text).error));
				resolve();
			} catch (error)
			{
				reject(error);
			}
		});
	}
	
	/**
	 * Initiate the caddy api.
	 * @param host The protocol, host and port of the caddy api. I.e. http://api.my-reverse-proxy.com
	 */
	public constructor (public host: string){}
	
	/**
	 * Combine the host and the URL.
	 * @param url The url.
	 */
	public url (url: string): string
	{
		return this.host + "/" + url;
	}
	
	/**
	 * Send a request to the Caddy api.
	 * @param url The pathame.
	 * @param method The http method.
	 * @param data The body to send in the request.
	 */
	public fetch (url: string, method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE" = "GET", data?: any): Promise<void>
	{
		return Caddy.fetch(this.url(url), method, data);
	}
	
	/**
	 * Add a domain to the reverse-proxy.
	 * @param domain The domain.
	 * @param dial The host and port to proxy to.
	 * @param port The port number that should be appended to the dial.
	 */
	public add (domain: string, dial: string, port: number): Promise<void>
	{
		return new Promise<void>(async (resolve, reject) => {
			try
			{
				const has = await this.has(domain);
				if (has) return resolve();
				await this.fetch("config/apps/http/servers/srv0/routes/0", "PUT", {
					"@id": domain,
					match: [{ host: [ domain ]}],
					handle: [{
						handler: "subroute",
						routes: [{
							handle: [{
								handler: "reverse_proxy",
								transport: {
									protocol: "http",
									tls: {}
								},
								upstreams: [{ dial: dial + ":" + port }],
								headers: {
									request: {
										set: {
											Host: [ dial ]
										}
									},
									response: {
										set: {
											"Strict-Transport-Security": [ "max-age=31536000;" ]
										}
									}
								}
							}]
						}]
					}],
					terminal: true
				});
				resolve();
			} catch (error)
			{
				reject(error);
			}
		});
	}
	
	/**
	 * Delete a domain from the reverse-proxy.
	 * @param domain The domain to delete from the proxies list.
	 */
	public delete (domain: string): Promise<void>
	{
		return new Promise<void>(async (resolve, reject) => {
			this.fetch("id/" + domain).then(resolve).catch(reject);
		});
	}
	
	/**
	 * Check if a domain is stored in caddy.
	 * @param domain The domain name.
	 */
	public has (domain: string): Promise<boolean>
	{
		return new Promise<boolean>(async (resolve, reject) => {
			try
			{
				await this.fetch("/id/" + domain);
				resolve(true);
			} catch (error)
			{
				if (error.message === "unknown object ID '" + domain + "'") resolve(false);
				else reject(error);
			}
		});
	}
	
}
