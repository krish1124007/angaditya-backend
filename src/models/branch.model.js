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
 commision:{
   type:Number,
   required:true
 },
 active:{
   type:Boolean,
   default:true
 }
 

},{timestaps:true})

export const Branch = mongoose.model("Branch" , BranchSchema);

