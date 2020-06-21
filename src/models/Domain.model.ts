// Imports
import { Schema, model, Types } from "mongoose";

// Schema
export const schema: Schema = new Schema({
	owner: { type: Types.ObjectId, required: true, unique: false },
	domain: { type: String, required: true, unique: true },
	pending: { type: Boolean, required: false, unique: false, default: true }
});

// Model
export default model("Domains", schema);
