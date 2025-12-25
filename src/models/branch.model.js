import mongoose from "mongoose"



const BranchSchema = new mongoose.Schema({

 branch_name:{
    type:String,
    required:true
 },
 location:{
    type:String,
    required:true
 },
 opening_balance:{
   type:Number,
   default:0,
 },
 active:{
   type:Boolean,
   default:true
 },
 commission:{
   type:Number,
   default:0
 },
 today_commission:{
  type:Number,
  default:0
 }
 

},{timestaps:true})

export const Branch = mongoose.model("Branch" , BranchSchema);

