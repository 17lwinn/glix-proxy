// Imports
import { createServer, Server } from "http";
import * as Express from "express";
import * as Mongoose from "mongoose";
import * as Bp from "body-parser";
import { config } from "dotenv";
config();
import { AddressInfo } from "net";
import { getLogger } from "./logger";
import { router as v1 } from "./api/v1";

const log = getLogger("Glix");


Mongoose.connect((process.env as any).MONGO, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true })
	.then(() => log.debug("Connected to database."))
	.catch(error => (log.error(error), process.exit(1)));

// Create an application.
const app = Express();
const server: Server = createServer(app);

// Include middlewares.
app.use((req, res, next) => {
	(req as any as Express.Request&{_ip:string})._ip = (req.headers['x-forwarded-for'] || req.headers["x-real-api"] || req.connection.remoteAddress) as string;
	next();
});
app.use(Bp.urlencoded({ extended: true }));
app.use(Bp.json());

// Include the website.
app.use("/api/v1", v1);

// Listen to port.
server.listen(3000, process.env.HOST || "127.0.0.1", () => {
	const addr = server.address() as AddressInfo;
	if (addr.family === "IPv6")
		log.debug("[%s]:%d Started!", addr.address, addr.port);
	else if (addr.family === "IPv4")
		log.debug("%s:%d Started!", addr.address, addr.port);
	else
		log.debug("The server has started.");
});
