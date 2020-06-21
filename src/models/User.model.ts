// Imports
import { Schema, model } from "mongoose";

// Schema
export const schema: Schema = new Schema({
	email: { type: String, unique: true, required: true },
	username: { type: String, unique: true, required: true },
	hash: { type: String, unique: false, required: false },
	verified: { type: Number, unique: false, default: null, required: false },
	banned: { type: Boolean, unique: false, default: false, required: false },
	admin: { type: Boolean, unique: false, default: false, required: false },
	beta: { type: Boolean, unique: false, default: false, required: false }
});

// Model
export default model("User", schema);
