import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";
import moment from "moment";
import { decrypt_number } from "../secrets/decrypt.js";
import { encrypt_number, encrypt_text } from "../secrets/encrypt.js";
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

    // Update the transaction status only
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

    return returnCode(res, 200, true, "update transaction successfully", transaction);
})

const updateTrsactionDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Validate transaction ID
    if (!id) {
        return returnCode(res, 400, false, "Transaction ID is required", null);
    }

    // Find the transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
        return returnCode(res, 404, false, "Transaction not found", null);
    }

    // Prepare update with encryption for sensitive fields
    const updateFields = { ...updateData };

    // Encrypt fields if they are being updated
    if (updateFields.points) {
        updateFields.points = encrypt_number(updateFields.points);
    }
    if (updateFields.receiver_mobile) {
        updateFields.receiver_mobile = encrypt_number(updateFields.receiver_mobile);
    }
    if (updateFields.sender_mobile) {
        updateFields.sender_mobile = encrypt_number(updateFields.sender_mobile);
    }
    if (updateFields.receiver_name) {
        updateFields.receiver_name = encrypt_text(updateFields.receiver_name);
    }
    if (updateFields.sender_name) {
        updateFields.sender_name = encrypt_text(updateFields.sender_name);
    }

    // Mark transaction as edited
    updateFields.isEdited = true;

    // Update the transaction with new data using $set
    const updatedTransaction = await Transaction.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
    );

    if (!updatedTransaction) {
        return returnCode(res, 500, false, "Failed to update transaction", null);
    }


    // Send notification to admin about the update
    try {
        const { Admin } = await import("../models/admin.model.js");
        const user_admin = await Admin.findOne({ username: 'admin' });

        if (user_admin && user_admin.deviceToken) {
            const { sendFirebaseNotification } = await import("../utils/firebasePush.js");

            const title = "Transaction Updated";
            const body = `Transaction ${id} has been updated by user`;

            await sendFirebaseNotification(user_admin.deviceToken, title, body, {
                transactionId: updatedTransaction._id.toString(),
                action: "transaction_updated",
                updatedAt: updatedTransaction.updatedAt.toString()
            });

            console.log("Admin notification sent successfully for transaction update");
        }
    } catch (notificationError) {
        console.error("Error sending notification to admin:", notificationError);
        // Continue execution even if notification fails
    }

    return returnCode(res, 200, true, "Transaction updated successfully", updatedTransaction);
})



const deleteTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await Transaction.findById(id);

    if (!transaction) {
        return returnCode(res, 400, false, "Transaction not found", null);
    }

    if (transaction.admin_permission) {
        const points = Number(decrypt_number(transaction.points));
        const senderCommission = transaction.sender_commision || 0;
        const receiverCommission = transaction.receiver_commision || 0;

        await Promise.all([
            Branch.findByIdAndUpdate(
                transaction.sender_branch,
                {
                    $inc: {
                        opening_balance: -points - senderCommission
                    }
                }
            ),
            Branch.findByIdAndUpdate(
                transaction.receiver_branch,
                {
                    $inc: {
                        opening_balance: points - receiverCommission
                    }
                }
            )
        ]);
    }

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

const openingBalance = asyncHandler(async (req, res) => {
    const { new_balance } = req.body;


    const user = req.user;

    if (!new_balance) {
        return returnCode(res, 400, false, "new_balance is required", null)
    }
    console.log("updateing the branch balance");
    const updateBranch = await Branch.findByIdAndUpdate(user.branch, {

        opening_balance: new_balance

    })

    return returnCode(res, 200, true, "Branch balance updated successfully", updateBranch)
})

export {
    createUser,
    loginUser,
    createTransaction,
    myAllTransactions,
    allMyReciveTransactions,
    updateTransaction,
    updateTrsactionDetail,
    deleteTransaction,
    isIEnable,
    updateTheUser,
    getDashboardData,
    saveLogs,
    openingBalance
}   