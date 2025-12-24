import mongoose from "mongoose";



const CustomRelationshipSchema = new mongoose.Schema({
    branch1_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Branch"
    },
    branch2_id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Branch"
    },
    branch1_commission:{
        type:Number,
        default:0
    },
    branch2_commission:{
        type:Number,
        default:0
    }
},{timestamps:true})

export const CustomRelationship = mongoose.model("CustomRelationship" , CustomRelationshipSchema);
