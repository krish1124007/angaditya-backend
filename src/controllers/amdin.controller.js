import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { Admin } from "../models/admin.model.js";
import { Transaction } from "../models/transaction.model.js"
import { Branch } from "../models/branch.model.js";
import { User } from "../models/user.model.js";
import { sendExpoNotification } from "../utils/expoPush.js";



const createAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return returnCode(res, 400, false, "All fields are required")
    }
    const admin = await Admin.create({ username, password });

    if (!admin) {
        return returnCode(res, 400, false, "Admin not created")
    }
    return returnCode(res, 200, true, "Admin created successfully", admin)
})

const loginAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return returnCode(res, 400, false, "All fields are required")
    }
    const admin = await Admin.findOne({ username })
    if (!admin) {
        return returnCode(res, 400, false, "Admin not found")
    }
    const isPasswordMatched = await admin.isPasswordCorrect(password)
    if (!isPasswordMatched) {
        return returnCode(res, 400, false, "Invalid credentials")
    }

    const accesstoken = admin.generateAccesstoken()
    return returnCode(res, 200, true, "Admin logged in successfully", { admin, accesstoken })
})

const updateAdmin = asyncHandler(async (req, res) => {
    const { _id, update_body } = req.body;
    if (!_id) {
        return returnCode(res, 400, false, "Admin id is required")
    }
    const admin = await Admin.findByIdAndUpdate({ _id }, update_body, { new: true })
    if (!admin) {
        return returnCode(res, 400, false, "Admin not found")
    }
    return returnCode(res, 200, true, "Admin updated successfully", admin)
})

const getAllTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find()
    return returnCode(res, 200, true, "Transactions fetched successfully", transactions)
})

const getTodayTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ date: { $gte: new Date() } })
    if (!transactions) {
        return returnCode(res, 400, false, "Transactions not found")
    }
    return returnCode(res, 200, true, "Transactions fetched successfully", transactions)
})

const createBranch = asyncHandler(async (req, res) => {
    const { branch_name, location, commision } = req.body;
    if (!branch_name || !location || !commision) {
        return returnCode(res, 400, false, "All fields are required")
    }
    const branch = await Branch.create({ branch_name, location, commision })
    if (!branch) {
        return returnCode(res, 400, false, "Branch not created")
    }
    return returnCode(res, 200, true, "Branch created successfully", branch)
})

const updateBranch = asyncHandler(async (req, res) => {
    const { _id, new_data } = req.body;
    if (!_id) {
        return returnCode(res, 400, false, "Branch id is required")
    }
    const branch = await Branch.findByIdAndUpdate({ _id }, new_data, { new: true })
    if (!branch) {
        return returnCode(res, 400, false, "Branch not found")
    }
    return returnCode(res, 200, true, "Branch updated successfully", branch)
})

const deleteBranch = asyncHandler(async (req, res) => {
    const { _id } = req.body;
    if (!_id) {
        return returnCode(res, 400, false, "Branch id is required")
    }
    const branch = await Branch.findByIdAndDelete({ _id })
    if (!branch) {
        return returnCode(res, 400, false, "Branch not found")
    }
    return returnCode(res, 200, true, "Branch deleted successfully", branch)
})

const getAllBranches = asyncHandler(async (req, res) => {
    const branches = await Branch.find()
    if (!branches) {
        return returnCode(res, 400, false, "Branches not found")
    }
    return returnCode(res, 200, true, "Branches fetched successfully", branches)
})

const disableAllbranch = asyncHandler(async (req, res) => {
    const branches = await Branch.updateMany({ active: true }, { active: false })
    if (!branches) {
        return returnCode(res, 400, false, "Branches not found")
    }
    return returnCode(res, 200, true, "Branches disabled successfully", branches)
})

const enableAllbranch = asyncHandler(async (req, res) => {
    const branches = await Branch.updateMany({ active: false }, { active: true })
    if (!branches) {
        return returnCode(res, 400, false, "Branches not found")
    }
    return returnCode(res, 200, true, "Branches enabled successfully", branches)
})

const disableBrach = asyncHandler(async (req, res) => {
    const { _id } = req.body;
    if (!_id) {
        return returnCode(res, 400, false, "Branch id is required")
    }
    const branch = await Branch.findByIdAndUpdate({ _id }, { active: false })
    if (!branch) {
        return returnCode(res, 400, false, "Branch not found")
    }
    return returnCode(res, 200, true, "Branch disabled successfully", branch)
})

const enableBranch = asyncHandler(async(req,res)=>{
    const  {_id} = req.body;


    if(!_id)
    {
        return returnCode(res,400,false,"please give the perefect id" ,null )
    }

    const update_branch = await Branch.findByIdAndUpdate(_id,{active:true})

    if(!update_branch)
    {
        return returnCode(res,500,false,"something error to update the branch data",null);
    }

    return returnCode(res,200,true,"branch enable successfully",update_branch)
})
const getTrasactionBranchWise = asyncHandler(async (req, res) => {
    const { branch_id } = req.body;
    if (!branch_id) {
        return returnCode(res, 400, false, "Branch id is required")
    }
    const transactions = await Transaction.find({ sender_branch: branch_id })
    if (!transactions) {
        return returnCode(res, 400, false, "Transactions not found")
    }
    return returnCode(res, 200, true, "Transactions fetched successfully", transactions)
})

const giveTheTractionPermision = asyncHandler(async (req, res) => {
    const { transactions_id } = req.body;

    if (!transactions_id) {
        return returnCode(res, 400, false, "Transactions id is required")
    }
    // Fixed: query by _id
    const transaction = await Transaction.findByIdAndUpdate({ _id: transactions_id }, { admin_permission: true }, { new: true })

    if (!transaction) {
        return returnCode(res, 400, false, "Transaction not found")
    }

    // Send Notification to users of the sender branch
    try {
        const users = await User.find({ branch: transaction.sender_branch, expoToken: { $exists: true, $ne: null } });
        const tokens = users.map(user => user.expoToken);

        if (tokens.length > 0) {
            await sendExpoNotification(
                tokens,
                "Transaction Approved",
                `Transaction of ${transaction.points} points has been approved by admin.`,
                { transactionId: transaction._id.toString() }
            );
        }
    } catch (error) {
        console.error("Error sending notification:", error);
    }

    return returnCode(res, 200, true, "Transaction permission given successfully", transaction)
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
    getTrasactionBranchWise,
    giveTheTractionPermision,
    updateAdmin,
    enableBranch
}