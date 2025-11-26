import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";


const userSchema = new mongoose.Schema({

    username:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    branch:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Branch",
        required:true
    },
    expoToken:{
        type:String,
        required:false
    }

},{timestamps:true})

userSchema.pre("save", async function(next)
{
    if(!this.isModified("password"))
    {
        return next();
    }

    this.password = await bcrypt.hash(this.password , 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function(password)
{
    return bcrypt.compare(password , this.password);
}

userSchema.methods.generateAccesstoken = function()
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

export const User = mongoose.model("User" , userSchema);