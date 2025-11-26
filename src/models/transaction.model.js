import mongoose from "mongoose";
import { encrypt_number, encrypt_text } from "../secrets/encrypt.js";
import { Branch } from "./branch.model.js";
import { User } from "./user.model.js";
import { getSocketServer } from "../socket/socket.js";
import { sendPushNotification } from "../utils/push.js";

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
  const io = getSocketServer();

  // Fetch all users in receiver branch
  const users = await User.find({ branch: this.receiver_branch });

  if (!users || users.length === 0) return;

  for (const user of users) {
    // Socket notification
    io.to(user._id.toString()).emit("new_transaction", {
      id: this._id,
      points: this.points,
      receiver_name: this.receiver_name,
      sender_name: this.sender_name
    });

    // Push notification (Expo)
    if (user.expoToken) {
      await sendPushNotification(
        user.expoToken,
        "New Transaction",
        `New transaction received for ${user.username}`,
        {
          page: "/transaction",
          id: this._id.toString()
        }
      );
    }
  }
});

export const Transaction = mongoose.model("Transaction", TransactionSchema);
