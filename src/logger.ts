// Imports
import { Logger, LogConsoleTransport, LogFileTransport, LogLevel, ILogData, LogRedirectTransport } from "ihacks-log";
import {
	yellowBright as y,
	blueBright as b,
	cyanBright as c,
	magentaBright as m
} from "chalk";

export const logger: Logger = new Logger();
export const customText: string = "Glix";
export default logger;

const fileFormat = (customText: string) => (data: ILogData) => `[${data.timestamp.getDate().toString().padStart(2, "0")}/${(data.timestamp.getMonth() + 1).toString().padStart(2, "0")}/${data.timestamp.getFullYear().toString().padStart(2, "0")} ${data.timestamp.getHours().toString().padStart(2, "0")}:${data.timestamp.getMinutes().toString().padStart(2, "0")}:${data.timestamp.getSeconds().toString().padStart(2, "0")}] ${customText ? "{" + customText + "}" : ""} (${Logger.getLevelName(data.level)}) ${data.message}`;
const consoleFormat = (customText: string) => (data: ILogData) => `[${y(data.timestamp.getDate().toString().padStart(2, "0"))}${b("/")}${y((data.timestamp.getMonth() + 1).toString().padStart(2, "0"))}${b("/")}${y(data.timestamp.getFullYear().toString())} ${y(data.timestamp.getHours().toString().padStart(2, "0"))}${b(":")}${y(data.timestamp.getMinutes().toString().padStart(2, "0"))}${b(":")}${y(data.timestamp.getSeconds().toString().padStart(2, "0"))}] ${customText ? "{" + c(customText) + "}" : ""} (${Logger.getLevelColor(data.level)(Logger.getLevelName(data.level))}) ${data.message}`;

export const consoleTransport = new LogConsoleTransport(data => `${data.message}`, LogLevel.All);
export const fileTransport = new LogFileTransport("logs/default.log", data => `${data.message}`, LogLevel.All);

export const createLogger = (name: string, ip: string): Logger => {
	const logger = new Logger();
	logger.addTransport(
		new LogRedirectTransport(consoleTransport, consoleFormat(name + " (" + m(ip) + ")")),
		new LogRedirectTransport(fileTransport, fileFormat(name + " (" + ip + ")"))
	);
	return logger;
};


const loggers: any = {};
export const getLogger = (name: string): Logger => {
	if (loggers[name]) return loggers[name];
	const logger = createLogger(name, "@");
	loggers[name] = logger;
	return logger;
};
