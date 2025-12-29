import mongoose from "mongoose";
import { encrypt_number, encrypt_text } from "../secrets/encrypt.js";
import { Admin } from "./admin.model.js";

const TransactionSchema = new mongoose.Schema(
  {

    receiver_branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    other_receiver:{type:String,default:""},
    sender_branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    other_sender:{type:String,default:""},
    points: { type: String, default: 0 },
    receiver_name: { type: String, required: false, default: "user" },
    receiver_mobile: { type: String, required: false, default: "user" },
    sender_name: { type: String, required: false, default: "user" },
    sender_mobile: { type: String, required: false, default: "user" },
    status: { type: Boolean, default: false },
    admin_permission: { type: Boolean, default: false },
    commission: { type: Number, default: 0 },
    receiver_commision:{type:Number, default:0},
    sender_commision:{type:Number, default:0}
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
TransactionSchema.post("save", async function (doc) {
  try {
    const user_admin = await Admin.findOne({ username: 'admin' });

    if (user_admin && user_admin.deviceToken) {
      const title = "New Transaction Created";
      const body = `Transaction of ${doc.points} points created by ${doc.sender_name}`;

      // Import dynamically to avoid circular dependency issues if any, or just standard import at top if possible. 
      // Since we are in a model, dynamic import or ensuring the utility is independent is good.
      // But we can just use the imported utility if we add the import at the top.
      // For now, let's assume we need to import it.
      const { sendFirebaseNotification } = await import("../utils/firebasePush.js");

      await sendFirebaseNotification(user_admin.deviceToken, title, body, {
        transactionId: doc._id.toString(),
        points: doc.points.toString(),
      });
      console.log("Notification send successfully")
    }
  } catch (error) {
    console.error("Error sending notification:", error);
  }
});

export const Transaction = mongoose.model("Transaction", TransactionSchema);
