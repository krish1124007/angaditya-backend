import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { Admin } from "../models/admin.model.js";
import { Transaction } from "../models/transaction.model.js"
import { Branch } from "../models/branch.model.js";



const createAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username  || !password) {
        return returnCode(res,400,false,"All fields are required")
    }
    const admin = await Admin.create({ username, password });
    
    if(!admin)
    {
        return returnCode(res,400,false,"Admin not created")
    }
    return returnCode(res,200,true,"Admin created successfully",admin)
})

const loginAdmin = asyncHandler(async(req,res)=>{
    const {username,password} = req.body;
    if(!username || !password)
    {
        return returnCode(res,400,false,"All fields are required")
    }
    const admin = await Admin.findOne({username})
    if(!admin)
    {
        return returnCode(res,400,false,"Admin not found")
    }
    const isPasswordMatched = await admin.isPasswordCorrect(password)
    if(!isPasswordMatched)
    {
        return returnCode(res,400,false,"Invalid credentials")
    }

    const accesstoken = admin.generateAccesstoken()
    return returnCode(res,200,true,"Admin logged in successfully",{admin,accesstoken})
})

const getAllTransactions = asyncHandler(async(req,res)=>{
    const transactions = await Transaction.find()
    return returnCode(res,200,true,"Transactions fetched successfully",transactions)
})

const getTodayTransactions = asyncHandler(async(req,res)=>{
    const transactions = await Transaction.find({date:{$gte:new Date()}})
    if(!transactions)
    {
        return returnCode(res,400,false,"Transactions not found")
    }
    return returnCode(res,200,true,"Transactions fetched successfully",transactions)
})

const createBranch = asyncHandler(async(req,res)=>{
    const  {branch_name,location,commision} = req.body;
    if(!branch_name || !location || !commision)
    {
        return returnCode(res,400,false,"All fields are required")
    }
    const branch = await Branch.create({branch_name,location,commision})
    if(!branch)
    {
        return returnCode(res,400,false,"Branch not created")
    }
    return returnCode(res,200,true,"Branch created successfully",branch)
})

const updateBranch = asyncHandler(async(req,res)=>{
    const {_id,new_data} = req.body;
    if(!_id)
    {
        return returnCode(res,400,false,"Branch id is required")
    }
    const branch = await Branch.findByIdAndUpdate({_id},new_data,{new:true})
    if(!branch)
    {
        return returnCode(res,400,false,"Branch not found")
    }
    return returnCode(res,200,true,"Branch updated successfully",branch)
})

const deleteBranch = asyncHandler(async(req,res)=>{
    const {_id} = req.body;
    if(!_id)
    {
        return returnCode(res,400,false,"Branch id is required")
    }
    const branch = await Branch.findByIdAndDelete({_id})
    if(!branch)
    {
        return returnCode(res,400,false,"Branch not found")
    }
    return returnCode(res,200,true,"Branch deleted successfully",branch)
})

const getAllBranches = asyncHandler(async(req,res)=>{
    const branches = await Branch.find()
    if(!branches)
    {
        return returnCode(res,400,false,"Branches not found")
    }
    return returnCode(res,200,true,"Branches fetched successfully",branches)
})

const disableAllbranch = asyncHandler(async(req,res)=>{
    const branches = await Branch.updateMany({active:true},{active:false})
    if(!branches)
    {
        return returnCode(res,400,false,"Branches not found")
    }
    return returnCode(res,200,true,"Branches disabled successfully",branches)
})

const enableAllbranch = asyncHandler(async(req,res)=>{
    const branches = await Branch.updateMany({active:false},{active:true})
    if(!branches)
    {
        return returnCode(res,400,false,"Branches not found")
    }
    return returnCode(res,200,true,"Branches enabled successfully",branches)
})

const disableBrach = asyncHandler(async(req,res)=>{
    const {_id} = req.body;
    if(!_id)
    {
        return returnCode(res,400,false,"Branch id is required")
    }
    const branch = await Branch.findByIdAndUpdate({_id},{active:false})
    if(!branch)
    {
        return returnCode(res,400,false,"Branch not found")
    }
    return returnCode(res,200,true,"Branch disabled successfully",branch)
})
const getTrasactionBranchWise = asyncHandler(async(req,res)=>{
    const {branch_id} = req.body;
    if(!branch_id)
    {
        return returnCode(res,400,false,"Branch id is required")
    }
    const transactions = await Transaction.find({sender_branch:branch_id})
    if(!transactions)
    {
        return returnCode(res,400,false,"Transactions not found")
    }
    return returnCode(res,200,true,"Transactions fetched successfully",transactions)
})

export {
    createAdmin,
    loginAdmin,
    getAllTransactions,
    getTodayTransactions,
    createBranch,
    updateBranch,
    deleteBranch,
    getAllBranches,
    disableAllbranch,
    enableAllbranch,
    disableBrach,
    getTrasactionBranchWise
}