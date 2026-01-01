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
    // Determine the date filter
    let dateFilter = {};

    if (req?.body?.date) {
        // If date is provided in body, use that date as start
        const start = new Date(req.body.date);
        start.setHours(0, 0, 0, 0);
        dateFilter = { date: { $gte: start } };
    } else {
        // Default: return only today's transactions
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        dateFilter = { date: { $gte: start } };
    }

    const transactions = await Transaction.aggregate([
        // Filter by date (today by default, or specific date if provided)
        { $match: dateFilter },

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
                date: 1,
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

    const message = req?.body?.date
        ? `Transactions from ${req.body.date} fetched successfully`
        : "Today's transactions fetched successfully";

    return returnCode(res, 200, true, message, transactions);
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
    // Expected format: dd/mm/yy or YYYY-MM-DD

    // If date is provided, fetch snapshot data for that day
    if (req?.body?.date) {
        try {
            const date = req.body.date;
            let snapshotDate;

            // Try to parse date in dd/mm/yy format first
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length !== 3) {
                    return returnCode(res, 400, false, "Invalid date format. Use dd/mm/yy or YYYY-MM-DD", null);
                }

                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                const year = parseInt(parts[2]) + 2000; // Assuming 20xx

                // Set to midnight of that day
                snapshotDate = new Date(year, month, day, 0, 0, 0, 0);
            } else {
                // Try parsing as YYYY-MM-DD
                snapshotDate = new Date(date);
                snapshotDate.setHours(0, 0, 0, 0);
            }

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
                commission: snapshot.total_commission,
                today_commission: snapshot.today_commission,
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

    // Default: Return branches with today's transaction data
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const branches = await Branch.find();

    // Get today's transactions for each branch to calculate today's activity
    const todayTransactions = await Transaction.aggregate([
        { $match: { date: { $gte: start } } },
        {
            $group: {
                _id: null,
                senderBranches: { $addToSet: "$sender_branch" },
                receiverBranches: { $addToSet: "$receiver_branch" }
            }
        }
    ]);

    // Mark branches that have today's activity
    const branchesWithTodayFlag = branches.map(branch => {
        const branchObj = branch.toObject();
        const hasTodayActivity = todayTransactions.length > 0 && (
            todayTransactions[0].senderBranches.some(id => id.equals(branch._id)) ||
            todayTransactions[0].receiverBranches.some(id => id.equals(branch._id))
        );
        branchObj.has_today_activity = hasTodayActivity;
        return branchObj;
    });

    return returnCode(res, 200, true, "Today's branch data fetched successfully", branchesWithTodayFlag);
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
    const { branch_id, date } = req.body;
    if (!branch_id) return returnCode(res, 400, false, "Branch id is required");

    // Determine the date filter
    let dateFilter = {};

    if (date) {
        // If date is provided in body, use that date as start
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        dateFilter = { date: { $gte: start } };
    } else {
        // Default: return only today's transactions
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        dateFilter = { date: { $gte: start } };
    }

    const transactions = await Transaction.aggregate([
        {
            $match: {
                ...dateFilter,
                $or: [
                    { sender_branch: new mongoose.Types.ObjectId(branch_id) },
                    { receiver_branch: new mongoose.Types.ObjectId(branch_id) }
                ]
            }
        },

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
                commission: 1,
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
                date: 1,
                createdAt: 1,
                updatedAt: 1,
                sender_commision: 1,
                receiver_commision: 1,
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

    const message = date
        ? `Transactions for branch from ${date} fetched successfully`
        : "Today's transactions for branch fetched successfully";

    return returnCode(res, 200, true, message, transactions);
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

    // Fetch transaction first
    const transaction = await Transaction.findById(transactions_id);

    if (!transaction) {
        return returnCode(res, 400, false, "Transaction not found");
    }

    // Check if already approved
    if (transaction.admin_permission === true) {
        return returnCode(res, 400, false, "Transaction already approved by admin");
    }

    // Calculate commissions based on custom relationship
    const relationship = await CustomRelationship.findOne({
        branch1_id: transaction.sender_branch,
        branch2_id: transaction.receiver_branch
    });

    let c1 = transaction.commission;
    let c2 = 0;

    if (relationship) {
        c1 = c1 * relationship.branch1_commission / 100;
        c2 = transaction.commission * relationship.branch2_commission / 100;
    }

    // Update branch balances and commissions
    const [updateBranchOpeningBalance, updateReceiverOpeningBalance] = await Promise.all([
        Branch.findByIdAndUpdate(
            transaction.sender_branch,
            {
                $inc: {
                    opening_balance: decrypt_number(transaction.points),
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

    // Update transaction with admin permission and commissions
    transaction.admin_permission = true;
    transaction.sender_commision = c1;
    transaction.receiver_commision = c2;
    await transaction.save();

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
    const { branch1_id, branch2_id, branch1_commission, branch2_commission } = req.body;

    if (!branch1_id || !branch2_id || !branch1_commission || !branch2_commission) {
        return returnCode(res, 400, false, "All fields are required");
    }

    const relationship = await CustomRelationship.create({
        branch1_id,
        branch2_id,
        branch1_commission,
        branch2_commission
    })

    return returnCode(res, 200, true, "Relationship created successfully", relationship);
})


const createTransaction = asyncHandler(async (req, res) => {

    const createTrsaction = await Transaction.create(req.body);

    if (!createTrsaction) {
        return returnCode(res, 400, false, "Transaction not created");
    }

    return returnCode(res, 200, true, "Transaction created successfully", createTrsaction);
})




/* ---------------------- DATE RANGE REPORT ---------------------- */

/**
 * Generate comprehensive report between two dates
 * @param {Date} start_date - Start date (format: dd/mm/yy or ISO string)
 * @param {Date} end_date - End date (format: dd/mm/yy or ISO string)
 * @returns {Object} - Complete report with transactions, balances, and statistics
 */
const getDateRangeReport = asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date) {
        return returnCode(res, 400, false, "Both start_date and end_date are required");
    }

    try {
        // Parse dates - support both dd/mm/yy and ISO formats
        let startDateTime, endDateTime;

        // Try to parse as dd/mm/yy format first
        if (start_date.includes('/')) {
            const startParts = start_date.split('/');
            if (startParts.length !== 3) {
                return returnCode(res, 400, false, "Invalid start_date format. Use dd/mm/yy or ISO format");
            }
            const startDay = parseInt(startParts[0]);
            const startMonth = parseInt(startParts[1]) - 1;
            const startYear = parseInt(startParts[2]) + 2000;
            startDateTime = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        } else {
            startDateTime = new Date(start_date);
            startDateTime.setHours(0, 0, 0, 0);
        }

        if (end_date.includes('/')) {
            const endParts = end_date.split('/');
            if (endParts.length !== 3) {
                return returnCode(res, 400, false, "Invalid end_date format. Use dd/mm/yy or ISO format");
            }
            const endDay = parseInt(endParts[0]);
            const endMonth = parseInt(endParts[1]) - 1;
            const endYear = parseInt(endParts[2]) + 2000;
            endDateTime = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);
        } else {
            endDateTime = new Date(end_date);
            endDateTime.setHours(23, 59, 59, 999);
        }

        // Validate dates
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return returnCode(res, 400, false, "Invalid date format");
        }

        if (startDateTime > endDateTime) {
            return returnCode(res, 400, false, "Start date must be before or equal to end date");
        }

        /* ========== 1. GET ALL TRANSACTIONS BETWEEN DATES ========== */
        const transactions = await Transaction.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDateTime,
                        $lte: endDateTime
                    }
                }
            },
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
                    admin_permission: 1,
                    commission: 1,
                    createdAt: 1,
                    updatedAt: 1,
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
            { $sort: { createdAt: -1 } }
        ]);

        /* ========== 2. GET BRANCH SNAPSHOTS BETWEEN DATES ========== */
        const branchSnapshots = await BranchSnapshot.find({
            snapshot_date: {
                $gte: startDateTime,
                $lte: endDateTime
            }
        })
            .populate('branch_id', 'branch_name location active')
            .sort({ snapshot_date: -1 });

        /* ========== 3. GET CURRENT BRANCH BALANCES ========== */
        const currentBranches = await Branch.find({});

        /* ========== 4. CALCULATE STATISTICS ========== */

        // Transaction statistics
        const totalTransactions = transactions.length;
        const approvedTransactions = transactions.filter(t => t.admin_permission === true).length;
        const pendingTransactions = transactions.filter(t => t.admin_permission === false).length;
        const completedTransactions = transactions.filter(t => t.status === true).length;

        // Commission statistics
        const totalCommission = transactions.reduce((sum, t) => sum + (t.commission || 0), 0);

        // Points statistics (encrypted, so we'll just count)
        const transactionsByBranch = {};

        transactions.forEach(t => {
            // Sender branch stats
            const senderName = t.sender_branch_name || 'Unknown';
            if (!transactionsByBranch[senderName]) {
                transactionsByBranch[senderName] = {
                    branch_name: senderName,
                    sent_count: 0,
                    received_count: 0,
                    total_commission: 0
                };
            }
            transactionsByBranch[senderName].sent_count += 1;
            transactionsByBranch[senderName].total_commission += (t.commission || 0);

            // Receiver branch stats
            const receiverName = t.receiver_branch_name || 'Unknown';
            if (!transactionsByBranch[receiverName]) {
                transactionsByBranch[receiverName] = {
                    branch_name: receiverName,
                    sent_count: 0,
                    received_count: 0,
                    total_commission: 0
                };
            }
            transactionsByBranch[receiverName].received_count += 1;
        });

        // Convert to array
        const branchStatistics = Object.values(transactionsByBranch);

        /* ========== 5. ORGANIZE SNAPSHOTS BY BRANCH ========== */
        const snapshotsByBranch = {};
        branchSnapshots.forEach(snapshot => {
            const branchName = snapshot.branch_name;
            if (!snapshotsByBranch[branchName]) {
                snapshotsByBranch[branchName] = [];
            }
            snapshotsByBranch[branchName].push({
                date: snapshot.snapshot_date,
                opening_balance: snapshot.opening_balance,
                total_commission: snapshot.total_commission,
                today_commission: snapshot.today_commission
            });
        });

        /* ========== 6. PREPARE FINAL REPORT ========== */
        const report = {
            date_range: {
                start_date: startDateTime,
                end_date: endDateTime,
                days_covered: Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24)) + 1
            },

            transactions: {
                total_count: totalTransactions,
                approved_count: approvedTransactions,
                pending_count: pendingTransactions,
                completed_count: completedTransactions,
                data: transactions
            },

            branch_snapshots: {
                total_snapshots: branchSnapshots.length,
                snapshots_by_branch: snapshotsByBranch,
                all_snapshots: branchSnapshots
            },

            current_branch_balances: currentBranches.map(branch => ({
                _id: branch._id,
                branch_name: branch.branch_name,
                location: branch.location,
                opening_balance: branch.opening_balance,
                commission: branch.commission,
                today_commission: branch.today_commission,
                active: branch.active
            })),

            statistics: {
                total_commission: totalCommission,
                branch_statistics: branchStatistics,
                transactions_per_day: (totalTransactions / Math.max(1, Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24)))).toFixed(2)
            },

            summary: {
                message: `Report generated for ${Math.ceil((endDateTime - startDateTime) / (1000 * 60 * 60 * 24)) + 1} days`,
                total_transactions: totalTransactions,
                total_branches_with_activity: branchStatistics.length,
                total_snapshots: branchSnapshots.length,
                total_commission: totalCommission
            }
        };

        return returnCode(
            res,
            200,
            true,
            `Report generated successfully from ${start_date} to ${end_date}`,
            report
        );

    } catch (error) {
        console.error("Error generating date range report:", error);
        return returnCode(res, 500, false, "Error generating report: " + error.message);
    }
});


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
    triggerBranchSnapshot,
    getBranchSnapshots,
    getLatestSnapshots,
    createRelationShip,
    createTransaction,
    getDateRangeReport
};