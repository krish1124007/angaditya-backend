import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { Admin } from "../models/admin.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";
import { User } from "../models/user.model.js";
import { sendExpoNotification } from "../utils/expoPush.js";
import { decrypt_number, decrypt_text } from "../secrets/decrypt.js";
import { UserAccessLog } from "../models/useraccesslog.model.js";

/* ---------------------- AGGREGATION ---------------------- */

const getTransactionWithBranchNames = async (transactionId) => {
    const result = await Transaction.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(transactionId) } },

        // Join sender branch
        {
            $lookup: {
                from: "branches",
                localField: "sender_branch",
                foreignField: "_id",
                as: "senderBranch",
            },
        },
        { $unwind: "$senderBranch" },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: "$receiverBranch" },

        {
            $project: {
                _id: 1,
                points: 1,
                admin_permission: 1,
                date: 1,
                sender_branch: 1,
                receiver_branch: 1,

                // Decrypted values will be attached later
                sender_branch_name: "$senderBranch.branch_name",
                receiver_branch_name: "$receiverBranch.branch_name",
            },
        },
    ]);

    return result[0];
};

/* ---------------------- CONTROLLERS ---------------------- */

const createAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const admin = await Admin.create({ username, password });

    return returnCode(res, 200, true, "Admin created successfully", admin);
});

const loginAdmin = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const admin = await Admin.findOne({ username });
    if (!admin) return returnCode(res, 400, false, "Admin not found");

    const isPasswordMatched = await admin.isPasswordCorrect(password);
    if (!isPasswordMatched) {
        return returnCode(res, 400, false, "Invalid credentials");
    }

    const accessToken = admin.generateAccesstoken();

    return returnCode(res, 200, true, "Admin logged in successfully", {
        admin,
        accessToken,
    });
});

const updateAdmin = asyncHandler(async (req, res) => {
    const { _id, update_body } = req.body;
    if (!_id) {
        return returnCode(res, 400, false, "Admin id is required");
    }

    const admin = await Admin.findByIdAndUpdate(_id, update_body, { new: true });

    return returnCode(res, 200, true, "Admin updated successfully", admin);
});

const getAllTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find();
    return returnCode(res, 200, true, "Transactions fetched successfully", transactions);
});

const getTodayTransactions = asyncHandler(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const transactions = await Transaction.find({ date: { $gte: start } });

    return returnCode(res, 200, true, "Today's transactions fetched", transactions);
});

/* ---------------------- BRANCH OPERATIONS ---------------------- */

const createBranch = asyncHandler(async (req, res) => {
    const { branch_name, location, commision } = req.body;
    if (!branch_name || !location || !commision) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const branch = await Branch.create({ branch_name, location, commision });

    return returnCode(res, 200, true, "Branch created successfully", branch);
});

const updateBranch = asyncHandler(async (req, res) => {
    const { _id, new_data } = req.body;
    if (!_id) return returnCode(res, 400, false, "Branch id is required");

    const branch = await Branch.findByIdAndUpdate(_id, new_data, { new: true });

    return returnCode(res, 200, true, "Branch updated successfully", branch);
});

const deleteBranch = asyncHandler(async (req, res) => {
    const { _id } = req.body;
    if (!_id) return returnCode(res, 400, false, "Branch id is required");

    const branch = await Branch.findByIdAndDelete(_id);

    return returnCode(res, 200, true, "Branch deleted successfully", branch);
});

const getAllBranches = asyncHandler(async (req, res) => {
    const branches = await Branch.find();
    return returnCode(res, 200, true, "Branches fetched successfully", branches);
});

/* ---------------------- ENABLE / DISABLE ---------------------- */

const disableAllbranch = asyncHandler(async (req, res) => {
    const result = await Branch.updateMany({ active: true }, { active: false });
    return returnCode(res, 200, true, "All branches disabled", result);
});

const enableAllbranch = asyncHandler(async (req, res) => {
    const result = await Branch.updateMany({ active: false }, { active: true });
    return returnCode(res, 200, true, "All branches enabled", result);
});

const disableBrach = asyncHandler(async (req, res) => {
    const { _id } = req.body;
    if (!_id) return returnCode(res, 400, false, "Branch id is required");

    const branch = await Branch.findByIdAndUpdate(_id, { active: false });

    return returnCode(res, 200, true, "Branch disabled", branch);
});

const enableBranch = asyncHandler(async (req, res) => {
    const { _id } = req.body;
    if (!_id) return returnCode(res, 400, false, "Branch id is required");

    const branch = await Branch.findByIdAndUpdate(_id, { active: true }, { new: true });

    return returnCode(res, 200, true, "Branch enabled", branch);
});

/* ---------------------- TRANSACTION BY BRANCH ---------------------- */

const getTrasactionBranchWise = asyncHandler(async (req, res) => {
    const { branch_id } = req.body;
    if (!branch_id) return returnCode(res, 400, false, "Branch id is required");

    const list = await Transaction.find({ sender_branch: branch_id });

    return returnCode(res, 200, true, "Transactions fetched", list);
});

/* ---------------------- GIVE PERMISSION + NOTIFY ---------------------- */

const giveTheTractionPermision = asyncHandler(async (req, res) => {
    const { transactions_id } = req.body;

    if (!transactions_id) {
        return returnCode(res, 400, false, "Transaction id is required");
    }

    // Update
    const transaction = await Transaction.findByIdAndUpdate(
        transactions_id,
        { admin_permission: true },
        { new: true }
    );

    if (!transaction) {
        return returnCode(res, 400, false, "Transaction not found");
    }

    // Fetch enriched transaction
    const tx = await getTransactionWithBranchNames(transactions_id);

    /* decrypt fields */
    tx.points = decrypt_number(transaction.points);
    tx.receiver_name = decrypt_text(transaction.receiver_name);
    tx.receiver_mobile = decrypt_number(transaction.receiver_mobile);
    tx.sender_name = decrypt_text(transaction.sender_name);
    tx.sender_mobile = decrypt_number(transaction.sender_mobile);

    /* Notify */
    try {
        const users = await User.find({
            branch: transaction.sender_branch,
            expoToken: { $exists: true, $ne: null },
        });

        const tokens = users.map((u) => u.expoToken);

        if (tokens.length > 0) {
            await sendExpoNotification(
                tokens,
                "Transaction Approved",
                `A transaction of ${tx.points} points was created by ${tx.sender_branch_name} and sent to ${tx.receiver_branch_name}. It has been approved.`,
                { transaction: tx }
            );
        }
    } catch (err) {
        console.log("Notification error:", err);
    }

    return returnCode(res, 200, true, "Permission granted successfully", tx);
});

/* ---------------------- ACCESS LOGS ---------------------- */

const getAllUserLogs = asyncHandler(async (req, res) => {
    const data = await UserAccessLog.find({});
    return returnCode(res, 200, true, "Logs fetched", data);
});

/* ---------------------- EXPORT ---------------------- */

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
    enableBranch,
    getAllUserLogs,
};
