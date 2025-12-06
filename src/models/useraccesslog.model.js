// models/UserAccessLog.js
import mongoose from "mongoose";

const userAccessLogSchema = new mongoose.Schema({
  username: { type: String, required: true },
  ip_address: { type: String, required: true },
  device_info: { type: String },
  timestamp: { type: Date, default: Date.now },
});

export const UserAccessLog = mongoose.model("UserAccessLog", userAccessLogSchema);
