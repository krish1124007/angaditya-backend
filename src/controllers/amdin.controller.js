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
import { CustomRelationship } from "../models/custom_relationship.js";
import { BranchSnapshot } from "../models/branch-snapshot.model.js";
import { manualCreateSnapshots } from "../services/scheduler.service.js";


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
        { $unwind: { path: "$senderBranch", preserveNullAndEmptyArrays: true } },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: { path: "$receiverBranch", preserveNullAndEmptyArrays: true } },

        // Join user who created the transaction
        {
            $lookup: {
                from: "users",
                localField: "create_by",
                foreignField: "_id",
                as: "creator",
            },
        },
        { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                // Original fields
                _id: 1,
                create_by: 1,
                receiver_branch: 1,
                sender_branch: 1,
                points: 1,
                receiver_name: 1,
                receiver_mobile: 1,
                sender_name: 1,
                sender_mobile: 1,
                status: 1,
                stauts: 1,
                admin_permission: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,

                // Additional calculated fields
                receiver_branch_name: "$receiverBranch.branch_name",
                sender_branch_name: "$senderBranch.branch_name",
                created_by_name: {
                    $cond: {
                        if: { $and: ["$creator", "$creator.username"] },
                        then: "$creator.username",
                        else: null
                    }
                }
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
    const transactions = await Transaction.aggregate([
        // Join sender branch
        {
            $lookup: {
                from: "branches",
                localField: "sender_branch",
                foreignField: "_id",
                as: "senderBranch",
            },
        },
        { $unwind: { path: "$senderBranch", preserveNullAndEmptyArrays: true } },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: { path: "$receiverBranch", preserveNullAndEmptyArrays: true } },

        // Join user who created the transaction
        {
            $lookup: {
                from: "users",
                localField: "create_by",
                foreignField: "_id",
                as: "creator",
            },
        },
        { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                // Original fields
                _id: 1,
                create_by: 1,
                receiver_branch: 1,
                sender_branch: 1,
                points: 1,
                receiver_name: 1,
                receiver_mobile: 1,
                sender_name: 1,
                sender_mobile: 1,
                status: 1,
                stauts: 1,
                admin_permission: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,

                // Additional calculated fields
                receiver_branch_name: "$receiverBranch.branch_name",
                sender_branch_name: "$senderBranch.branch_name",
                created_by_name: {
                    $cond: {
                        if: { $and: ["$creator", "$creator.username"] },
                        then: "$creator.username",
                        else: null
                    }
                }
            },
        },
    ]);

    return returnCode(res, 200, true, "Transactions fetched successfully", transactions);
});

const getTodayTransactions = asyncHandler(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const transactions = await Transaction.aggregate([
        { $match: { date: { $gte: start } } },

        // Join sender branch
        {
            $lookup: {
                from: "branches",
                localField: "sender_branch",
                foreignField: "_id",
                as: "senderBranch",
            },
        },
        { $unwind: { path: "$senderBranch", preserveNullAndEmptyArrays: true } },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: { path: "$receiverBranch", preserveNullAndEmptyArrays: true } },

        // Join user who created the transaction
        {
            $lookup: {
                from: "users",
                localField: "create_by",
                foreignField: "_id",
                as: "creator",
            },
        },
        { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                // Original fields
                _id: 1,
                create_by: 1,
                receiver_branch: 1,
                sender_branch: 1,
                points: 1,
                receiver_name: 1,
                receiver_mobile: 1,
                sender_name: 1,
                sender_mobile: 1,
                status: 1,
                stauts: 1,
                admin_permission: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,

                // Additional calculated fields
                receiver_branch_name: "$receiverBranch.branch_name",
                sender_branch_name: "$senderBranch.branch_name",
                created_by_name: {
                    $cond: {
                        if: { $and: ["$creator", "$creator.username"] },
                        then: "$creator.username",
                        else: null
                    }
                }
            },
        },
    ]);

    return returnCode(res, 200, true, "Today's transactions fetched", transactions);
});

/* ---------------------- BRANCH OPERATIONS ---------------------- */

const createBranch = asyncHandler(async (req, res) => {
    const { branch_name, location } = req.body;
    if (!branch_name || !location) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const branch = await Branch.create({ branch_name, location });

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
    const { date } = req.body; // Expected format: dd/mm/yy

    // If date is provided, fetch snapshot data for that day
    if (date) {
        try {
            // Parse date in dd/mm/yy format
            const parts = date.split('/');
            if (parts.length !== 3) {
                return returnCode(res, 400, false, "Invalid date format. Use dd/mm/yy", null);
            }

            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parseInt(parts[2]) + 2000; // Assuming 20xx

            // Set to midnight of that day
            const snapshotDate = new Date(year, month, day, 0, 0, 0, 0);

            // Fetch snapshots for that specific date
            const snapshots = await BranchSnapshot.find({
                snapshot_date: snapshotDate
            }).populate('branch_id', 'branch_name location active');

            if (!snapshots || snapshots.length === 0) {
                return returnCode(res, 404, false, `No snapshot data found for ${date}`, null);
            }

            // Format response to match branch structure
            const formattedData = snapshots.map(snapshot => ({
                _id: snapshot.branch_id?._id || snapshot.branch_id,
                branch_name: snapshot.branch_name,
                location: snapshot.branch_id?.location || "N/A",
                opening_balance: snapshot.opening_balance,
                commision: snapshot.total_commision,
                today_commision: snapshot.today_commision,
                active: snapshot.branch_id?.active || true,
                snapshot_date: snapshot.snapshot_date,
                is_snapshot: true // Flag to indicate this is historical data
            }));

            return returnCode(res, 200, true, `Branch snapshots for ${date} fetched successfully`, formattedData);
        } catch (error) {
            console.error("Error fetching branch snapshots:", error);
            return returnCode(res, 400, false, "Error parsing date or fetching snapshots", null);
        }
    }

    // If no date provided, return current branch data
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

    const transactions = await Transaction.aggregate([
        { $match: { sender_branch: new mongoose.Types.ObjectId(branch_id) } },

        // Join sender branch
        {
            $lookup: {
                from: "branches",
                localField: "sender_branch",
                foreignField: "_id",
                as: "senderBranch",
            },
        },
        { $unwind: { path: "$senderBranch", preserveNullAndEmptyArrays: true } },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: { path: "$receiverBranch", preserveNullAndEmptyArrays: true } },

        // Join user who created the transaction
        {
            $lookup: {
                from: "users",
                localField: "create_by",
                foreignField: "_id",
                as: "creator",
            },
        },
        { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                // Original fields
                _id: 1,
                commision: 1,
                receiver_branch: 1,
                sender_branch: 1,
                points: 1,
                receiver_name: 1,
                receiver_mobile: 1,
                sender_name: 1,
                sender_mobile: 1,
                status: 1,
                stauts: 1,
                admin_permission: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,

                // Additional calculated fields
                receiver_branch_name: "$receiverBranch.branch_name",
                sender_branch_name: "$senderBranch.branch_name",
                created_by_name: {
                    $cond: {
                        if: { $and: ["$creator", "$creator.username"] },
                        then: "$creator.username",
                        else: null
                    }
                }
            },
        },
    ]);

    return returnCode(res, 200, true, "Transactions fetched", transactions);
});

const deleteAllTransactions = asyncHandler(async (req, res) => {
    await Transaction.deleteMany({});
    return returnCode(res, 200, true, "All transactions deleted");
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

    // Fetch enriched transaction with all fields including created_by_name
    const tx = await Transaction.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(transactions_id) } },

        // Join sender branch
        {
            $lookup: {
                from: "branches",
                localField: "sender_branch",
                foreignField: "_id",
                as: "senderBranch",
            },
        },
        { $unwind: { path: "$senderBranch", preserveNullAndEmptyArrays: true } },

        // Join receiver branch
        {
            $lookup: {
                from: "branches",
                localField: "receiver_branch",
                foreignField: "_id",
                as: "receiverBranch",
            },
        },
        { $unwind: { path: "$receiverBranch", preserveNullAndEmptyArrays: true } },

        // Join user who created the transaction
        {
            $lookup: {
                from: "users",
                localField: "create_by",
                foreignField: "_id",
                as: "creator",
            },
        },
        { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

        {
            $project: {
                // Original fields
                _id: 1,
                create_by: 1,
                receiver_branch: 1,
                sender_branch: 1,
                points: 1,
                receiver_name: 1,
                receiver_mobile: 1,
                sender_name: 1,
                sender_mobile: 1,
                status: 1,
                stauts: 1,
                admin_permission: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,

                // Additional calculated fields
                receiver_branch_name: "$receiverBranch.branch_name",
                sender_branch_name: "$senderBranch.branch_name",
                created_by_name: {
                    $cond: {
                        if: { $and: ["$creator", "$creator.username"] },
                        then: "$creator.username",
                        else: null
                    }
                }
            },
        },
    ]);

    const enrichedTx = tx[0];

    /* decrypt fields */
    enrichedTx.points = decrypt_number(transaction.points);
    enrichedTx.receiver_name = decrypt_text(transaction.receiver_name);
    enrichedTx.receiver_mobile = decrypt_number(transaction.receiver_mobile);
    enrichedTx.sender_name = decrypt_text(transaction.sender_name);
    enrichedTx.sender_mobile = decrypt_number(transaction.sender_mobile);

    /* Notify */
    try {
        const users = await User.find({
            branch: transaction.receiver_branch,
            expoToken: { $exists: true, $ne: null },
        });

        const tokens = users.map((u) => u.expoToken);

        if (tokens.length > 0) {
            await sendExpoNotification(
                tokens,
                "Transaction Approved",
                `A transaction of ${enrichedTx.points} points was created by ${enrichedTx.sender_branch_name} and sent to ${enrichedTx.receiver_branch_name}. It has been approved.`,
                { transaction: enrichedTx }
            );
        }
    } catch (err) {
        console.log("Notification error:", err);
    }

    return returnCode(res, 200, true, "Permission granted successfully", enrichedTx);
});

/* ---------------------- ACCESS LOGS ---------------------- */

const getAllUserLogs = asyncHandler(async (req, res) => {
    const data = await UserAccessLog.find({});
    return returnCode(res, 200, true, "Logs fetched", data);
});

const getUser = asyncHandler(async (req, res) => {

    const data = await User.find({});
    return returnCode(res, 200, true, "Users fetched", data);
})

const deleteAllUser = asyncHandler(async (req, res) => {
    await User.deleteMany({});
    return returnCode(res, 200, true, "All users deleted");
})

const deleteUser = asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return returnCode(res, 400, false, "User id is required");
    }
    await User.findByIdAndDelete(user_id);
    return returnCode(res, 200, true, "User deleted successfully");
});

const updateUser = asyncHandler(async (req, res) => {
    const { user_id, update_body } = req.body;
    if (!user_id) {
        return returnCode(res, 400, false, "User id is required");
    }
    await User.findByIdAndUpdate(user_id, update_body);
    return returnCode(res, 200, true, "User updated successfully");
});


/* ---------------------- BRANCH SNAPSHOT OPERATIONS ---------------------- */

const triggerBranchSnapshot = asyncHandler(async (req, res) => {
    console.log("Manual branch snapshot triggered by admin");
    await manualCreateSnapshots();
    return returnCode(res, 200, true, "Branch snapshots created successfully");
});

const getBranchSnapshots = asyncHandler(async (req, res) => {
    const { branch_id, start_date, end_date, limit } = req.body;

    const query = {};

    if (branch_id) {
        query.branch_id = new mongoose.Types.ObjectId(branch_id);
    }

    if (start_date || end_date) {
        query.snapshot_date = {};
        if (start_date) {
            query.snapshot_date.$gte = new Date(start_date);
        }
        if (end_date) {
            query.snapshot_date.$lte = new Date(end_date);
        }
    }

    const snapshots = await BranchSnapshot.find(query)
        .sort({ snapshot_date: -1 })
        .limit(limit || 100)
        .populate('branch_id', 'branch_name location');

    return returnCode(res, 200, true, "Snapshots fetched successfully", snapshots);
});

const getLatestSnapshots = asyncHandler(async (req, res) => {
    // Get the most recent snapshot for each branch
    const snapshots = await BranchSnapshot.aggregate([
        {
            $sort: { snapshot_date: -1 }
        },
        {
            $group: {
                _id: "$branch_id",
                latestSnapshot: { $first: "$$ROOT" }
            }
        },
        {
            $replaceRoot: { newRoot: "$latestSnapshot" }
        },
        {
            $lookup: {
                from: "branches",
                localField: "branch_id",
                foreignField: "_id",
                as: "branchInfo"
            }
        },
        {
            $unwind: { path: "$branchInfo", preserveNullAndEmptyArrays: true }
        }
    ]);

    return returnCode(res, 200, true, "Latest snapshots fetched successfully", snapshots);
});


const createRelationShip = asyncHandler(async (req, res) => {
    const { branch1, branch2, commision1, commision2 } = req.body;

    if (!branch1 || !branch2 || !commision1 || !commision2) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const relationship = await CustomRelationship.create({
        branch1,
        branch2,
        commision1,
        commision2
    })

    return returnCode(res, 200, true, "Relationship created successfully", relationship);
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
    enableBranch,
    getAllUserLogs,
    getUser,
    deleteAllUser,
    deleteUser,
    updateUser,
    deleteAllTransactions,
    createRelationShip,
    triggerBranchSnapshot,
    getBranchSnapshots,
    getLatestSnapshots
    // getDailyStats
};