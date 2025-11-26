import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";

const createUser = asyncHandler(async (req, res) => {

    console.log(req.body)
    const create = await User.create(req.body);

    return returnCode(res, 200, true, "create successfully", create);

})


const loginUser = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return returnCode(res, 400, false, "Please enter all fields", null);
    }

    const user = await User.findOne({ username }).select("+password");

    if (!user) {
        return returnCode(res, 400, false, "Account not found", null);
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        return returnCode(res, 400, false, "Incorrect password", null);
    }

    const accessToken = user.generateAccesstoken();

    if (!accessToken) {
        return returnCode(res, 500, false, "Error generating access token", null);
    }

    // Branch lookup
    const branchDetails = await Branch.findById(user.branch);

    // Remove sensitive fields
    const safeUser = {
        _id: user._id,
        username: user.username,
        role: user.role,
        branch: user.branch,
    };

    return returnCode(res, 200, true, "User logged in successfully", {
        user: safeUser,
        accessToken,
        branchDetails
    });
});


const isIEnable = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        return returnCode(res, 400, false, "your account can't find by the syste", null);
    }

    const userBranch = await Branch.findById(user.branch);

    if (!userBranch) {
        return returnCode(res, 400, false, "your branch can't find by the syste", null);
    }

    if (!userBranch.active) {
        return returnCode(res, 400, false, "your branch is  disable", null);
    }



    return returnCode(res, 200, true, "your account is enable successfully", null);
})

const createTransaction = asyncHandler(async (req, res) => {

    const user = req.user;
    console.log(user)

    const user_branch = await User.findById(user._id);

    const create = await Transaction.create({ ...req.body, sender_branch: user_branch.branch, create_by: user._id });

    if (!create) {
        return returnCode(res, 500, false, "somthing problem to create transaction", null);
    }

    return returnCode(res, 200, true, "create transaction successfully", create);

})

const myAllTransactions = asyncHandler(async (req, res) => {
    const user = req.user;
    console.log("fetched")

    const allMyTransactions = await Transaction.find({ create_by: user._id });

    if (!allMyTransactions) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "all my transactions successfully", allMyTransactions);
})

const allMyReciveTransactions = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    const allMyReciveTransactions = await Transaction.find({ receiver_branch: user.branch });

    if (!allMyReciveTransactions) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "all my recive transactions successfully", allMyReciveTransactions);
})

const updateTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const update = await Transaction.findByIdAndUpdate(id, { stauts: true }, { new: true });

    if (!update) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "update transaction successfully", update);
})

const deleteTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deleteT = await Transaction.findByIdAndDelete(id);

    if (!deleteT) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "delete transaction successfully", deleteT);
})

const updateTheUser = asyncHandler(async(req,res)=>{
    const {_id,updateobj} = req.body;

    if(!id)
    {
        return returnCode(res,400,false,"please enter all feilds",null)
    }

    const updateuser = await User.findByIdAndUpdate(_id,updateobj)

    if(!updateuser)
    {

    }

    return returnCode(res,200,true,"update user successfully",null)
})

export {
    createUser,
    loginUser,
    createTransaction,
    myAllTransactions,
    allMyReciveTransactions,
    updateTransaction,
    deleteTransaction,
    isIEnable,
    updateTheUser
}   