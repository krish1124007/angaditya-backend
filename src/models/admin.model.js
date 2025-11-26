import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const AdminSchema = new mongoose.Schema({
    username:{
        type:String,
        uniqe:true
    },
    password:{
        type:String,
        required:true
    }
},{timestamps:true})

AdminSchema.pre("save",async function(next)
{
    if(!this.isModified("password"))
    {
        return next()
    }

    this.password = await bcrypt.hash(this.password,10);

    next();
})

AdminSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password , this.password);
}

AdminSchema.methods.generateAccesstoken = function()
{
    return jwt.sign(
        {
            _id:this._id
        },
        process.env.JWT_SEC,
        {
            expiresIn:process.env.JWT_EXP
        }
    )
}


export const Admin = mongoose.model("Admin",AdminSchema);