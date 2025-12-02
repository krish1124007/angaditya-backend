import mongoose from "mongoose";
import { encrypt_number, encrypt_text } from "../secrets/encrypt.js";
import { Admin } from "mongodb";

const TransactionSchema = new mongoose.Schema(
  {
    create_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver_branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    sender_branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    points: { type: String, required: true },
    receiver_name: { type: String, required: true },
    receiver_mobile: { type: String, required: true },
    sender_name: { type: String, required: true },
    sender_mobile: { type: String, required: true },
    status: { type: Boolean, default: false }
  },
  { timestamps: true }
);

TransactionSchema.pre("save", function (next) {
  if (this.isModified("points")) this.points = encrypt_number(this.points);
  if (this.isModified("receiver_mobile")) this.receiver_mobile = encrypt_number(this.receiver_mobile);
  if (this.isModified("sender_mobile")) this.sender_mobile = encrypt_number(this.sender_mobile);
  if (this.isModified("sender_name")) this.sender_name = encrypt_text(this.sender_name);
  if (this.isModified("receiver_name")) this.receiver_name = encrypt_text(this.receiver_name);

  next();
});

// 🔥 SEND SOCKET + PUSH AFTER SAVE
TransactionSchema.post("save", async function () {
  
  const user_admin = await Admin.findOne({username:'admin'});

  

  // Fetch all users in receiver branch
  
});

export const Transaction = mongoose.model("Transaction", TransactionSchema);
