// Imports
import { Schema, model, Types } from "mongoose";

// Schema
export const schema: Schema = new Schema({
	owner: { type: Types.ObjectId, required: true, unique: false },
	domain: { type: Types.ObjectId, required: true, unique: false },
	entry: { type: String, required: true, unique: true },
	host: { type: String, required: true, unique: false },
	port: { type: Number, required: true, unique: false, default: 443 }
});

// Model
export default model("ReverseProxy", schema);
