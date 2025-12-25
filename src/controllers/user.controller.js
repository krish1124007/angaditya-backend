import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";
import moment from "moment";
import { decrypt_number } from "../secrets/decrypt.js";
import { UserAccessLog } from "../models/useraccesslog.model.js"
import { CustomRelationship } from "../models/custom_relationship.js";

const getPoints = (p) => Number(decrypt_number(p));

const calcEarning = (amount, commission) => {
    return (commission / 100) * amount;
};

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

    const create = await Transaction.create({ ...req.body, sender_branch: user_branch.branch });

    if (!create) {
        return returnCode(res, 500, false, "somthing problem to create transaction", null);
    }

    return returnCode(res, 200, true, "create transaction successfully", create);

})

const myAllTransactions = asyncHandler(async (req, res) => {
    const user = req.user;
     // Expected format: dd/mm/yy
    console.log("fetched")

    let query = { sender_branch: user.branch };

    // If date is provided, filter transactions for that specific day
    if (req?.body?.date) {
        try {
            // Parse date in dd/mm/yy format
            const parts = req.body.date.split('/');
            if (parts.length !== 3) {
                return returnCode(res, 400, false, "Invalid date format. Use dd/mm/yy", null);
            }

            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parseInt(parts[2]) + 2000; // Assuming 20xx

            const startDate = new Date(year, month, day, 0, 0, 0, 0);
            const endDate = new Date(year, month, day, 23, 59, 59, 999);

            query.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        } catch (error) {
            return returnCode(res, 400, false, "Error parsing date", null);
        }
    }

    const allMyTransactions = await Transaction.find(query);

    if (!allMyTransactions) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "all my transactions successfully", allMyTransactions);
})

const allMyReciveTransactions = asyncHandler(async (req, res) => {
    const allMyReciveTransactions = await Transaction.find({ receiver_branch: req.user.branch });

    if (!allMyReciveTransactions) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "all my recive transactions successfully", allMyReciveTransactions);
})

const updateTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log("code arrvied here")

    // Update the transaction status
    const transaction = await Transaction.findByIdAndUpdate(
        id,
        { status: true },
        { new: true }
    );

    console.log("transaction is outer : ", transaction)

    if (!transaction) {
        console.log("trsaction is: ", transaction)
        return returnCode(res, 500, false, "trsaction is not complete", null);
    }

    const relationship = await CustomRelationship.findOne({
        branch1_id: transaction.sender_branch,
        branch2_id: transaction.receiver_branch
    })

    let c1 = transaction.commission;
    let c2 = 0;

    if (relationship) {
        c1 = c1 * relationship.branch1_commission / 100;
        c2 = transaction.commission * relationship.branch2_commission / 100;
    }


    const [updateBranchOpeningBalance, updateReceiverOpeningBalance] = await Promise.all([
        Branch.findByIdAndUpdate(
            transaction.sender_branch,
            {
                $inc: {
                    commission: c1,
                    today_commission: c1
                }
            },
            { new: true }
        ),
        Branch.findByIdAndUpdate(
            transaction.receiver_branch,
            {
                $inc: {
                    opening_balance: -decrypt_number(transaction.points),
                    commission: c2,
                    today_commission: c2
                }
            },
            { new: true }
        )
    ]);





    return returnCode(res, 200, true, "update transaction successfully", transaction);
})



const deleteTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deleteT = await Transaction.findByIdAndDelete(id);

    if (!deleteT) {
        return returnCode(res, 400, false, "your transaction can't find by the syste", null);
    }

    return returnCode(res, 200, true, "delete transaction successfully", deleteT);
})

const updateTheUser = asyncHandler(async (req, res) => {
    const { updateobj } = req.body;

    if (!updateobj) {
        return returnCode(res, 400, false, "updateobj is required", null);
    }

    if (!req.user?._id) {
        return returnCode(res, 400, false, "Invalid user", null);
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updateobj,
        { new: true }
    );

    if (!updatedUser) {
        return returnCode(res, 404, false, "User not found", null);
    }

    return returnCode(res, 200, true, "User updated successfully", updatedUser);
});



const getDashboardData = asyncHandler(async (req, res) => {
    const user = req.user;

    const branchDetails = await Branch.findById(user.branch);

    if (!branchDetails) {
        return returnCode(res, 400, false, "your branch can't find by the syste", null);
    }

    return returnCode(res, 200, true, "Branch details successfully", branchDetails);
});


const saveLogs = asyncHandler(async (req, res) => {
    const { ip_address, device_info } = req.body;
    const username = req.user.username;

    const save_log = await UserAccessLog.create({ username, ip_address, device_info })

    if (!save_log) {
        return returnCode(res, 500, false, "something error to save the logs", null)
    }

    return returnCode(res, 200, true, "Data save successfully", save_log)

})

const openingBalance = asyncHandler(async(req,res)=>{
    const {new_balance} = req.body;
    const user = req.user;

    const updateBranch = await Branch.findByIdAndUpdate(user.branch,{
        
            opening_balance:new_balance
        
    })
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
    updateTheUser,
    getDashboardData,
    saveLogs
}   