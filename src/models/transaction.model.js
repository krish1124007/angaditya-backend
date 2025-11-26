import mongoose from "mongoose";
import { encrypt_number, encrypt_text } from "../secrets/encrypt.js";
import { Branch } from "./branch.model.js";
import { User } from "./user.model.js";       

const TransactionSchema = new mongoose.Schema(
  {
    create_by:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"User",
      required:true
    },
    receiver_branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    sender_branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    points: {
      type: String,
      required: true,
    },
    receiver_name: {
      type: String,
      required: true,
    },
    receiver_mobile: {
      type: String,
      required: true,
    },
    sender_name: {
      type: String,
      required: true,
    },
    sender_mobile: {
      type: String,
      required: true,
    },
    stauts:{
      type:Boolean,
      default:false
    }
  },
  { timestamps: true }
);

// Encrypt fields before saving
TransactionSchema.pre("save", function (next) {
  const isPointsModified = this.isModified("points");
  const isReceiverMobileModified = this.isModified("receiver_mobile");
  const isSenderMobileModified = this.isModified("sender_mobile");
  const isSenderNameModified = this.isModified("sender_name");
  const isReceiverNameModified = this.isModified("receiver_name");

  // If nothing modified → skip
  if (!isPointsModified && !isReceiverMobileModified && !isSenderMobileModified && !isSenderNameModified && !isReceiverNameModified) {
    return next();
  }

  if (isPointsModified) {
    this.points = encrypt_number(this.points);
  }
  if (isReceiverMobileModified) {
    this.receiver_mobile = encrypt_number(this.receiver_mobile);
  }
  if (isSenderMobileModified) {
    this.sender_mobile = encrypt_number(this.sender_mobile);
  }
  if (isSenderNameModified) {
    this.sender_name = encrypt_text(this.sender_name);
  }
  if (isReceiverNameModified) {
    this.receiver_name = encrypt_text(this.receiver_name);
  }

  next();
});

TransactionSchema.post("save", async function()
{
  const all_users = await User.find({branch:this.receiver_branch});
  console.log(all_users)
  
})

export const Transaction = mongoose.model("Transaction", TransactionSchema);
