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
import { BranchSnapshot } from "../models/branch-snapshot.model.js";

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
    const update_data = req.body;

    // Validate update data
    if (!update_data || Object.keys(update_data).length === 0) {
        return returnCode(res, 400, false, "Update data is required", null);
    }

    // Validate transaction ID
    if (!id) {
        return returnCode(res, 400, false, "Transaction ID is required", null);
    }

    // Find the transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
        return returnCode(res, 404, false, "Transaction not found", null);
    }

    // Check if transaction is from today
    const txDate = new Date(transaction.date);
    const today = new Date();
    const isToday = txDate.getDate() === today.getDate() &&
        txDate.getMonth() === today.getMonth() &&
        txDate.getFullYear() === today.getFullYear();

    const promises = [];

    // ==================== HANDLE POINTS CHANGE ====================
    if (update_data.points && transaction.admin_permission) {
        const oldPoints = Number(decrypt_number(transaction.points));
        const newPoints = Number(update_data.points);
        const pointsDifference = newPoints - oldPoints;

        if (pointsDifference !== 0) {
            // Update Sender Branch: Add the difference to transaction_balance (and opening_balance if not today)
            promises.push(Branch.findByIdAndUpdate(transaction.sender_branch, {
                $inc: {
                    transaction_balance: pointsDifference,
                    opening_balance: isToday ? 0 : pointsDifference
                }
            }));

            // Update Receiver Branch: Subtract the difference from transaction_balance (and opening_balance if not today)
            promises.push(Branch.findByIdAndUpdate(transaction.receiver_branch, {
                $inc: {
                    transaction_balance: -pointsDifference,
                    opening_balance: isToday ? 0 : -pointsDifference
                }
            }));
        }
    }

    // ==================== HANDLE COMMISSION CHANGE ====================
    if (update_data.commission !== undefined && transaction.admin_permission) {
        const oldCommission = transaction.commission || 0;
        const newCommission = Number(update_data.commission);
        const commissionDifference = newCommission - oldCommission;

        if (commissionDifference !== 0) {
            // Check if there's a relationship between sender and receiver branches
            const relationship = await CustomRelationship.findOne({
                $or: [
                    { branch1_id: transaction.sender_branch, branch2_id: transaction.receiver_branch },
                    { branch1_id: transaction.receiver_branch, branch2_id: transaction.sender_branch }
                ]
            });

            if (relationship) {
                // Relationship exists - split commission
                let senderCommissionDiff = 0;
                let receiverCommissionDiff = 0;

                // Determine which branch is which in the relationship
                if (relationship.branch1_id.toString() === transaction.sender_branch.toString()) {
                    // Sender is branch1, Receiver is branch2
                    const totalRelCommission = relationship.branch1_commission + relationship.branch2_commission;
                    if (totalRelCommission > 0) {
                        senderCommissionDiff = (commissionDifference * relationship.branch1_commission) / totalRelCommission;
                        receiverCommissionDiff = (commissionDifference * relationship.branch2_commission) / totalRelCommission;
                    } else {
                        // Equal split if no commission defined
                        senderCommissionDiff = commissionDifference / 2;
                        receiverCommissionDiff = commissionDifference / 2;
                    }
                } else {
                    // Sender is branch2, Receiver is branch1
                    const totalRelCommission = relationship.branch1_commission + relationship.branch2_commission;
                    if (totalRelCommission > 0) {
                        senderCommissionDiff = (commissionDifference * relationship.branch2_commission) / totalRelCommission;
                        receiverCommissionDiff = (commissionDifference * relationship.branch1_commission) / totalRelCommission;
                    } else {
                        // Equal split if no commission defined
                        senderCommissionDiff = commissionDifference / 2;
                        receiverCommissionDiff = commissionDifference / 2;
                    }
                }

                // Update sender branch commission
                promises.push(Branch.findByIdAndUpdate(transaction.sender_branch, {
                    $inc: {
                        commission: senderCommissionDiff,
                        today_commission: isToday ? senderCommissionDiff : 0,
                        remaining_transfer_commission: senderCommissionDiff
                    }
                }));

                // Update receiver branch commission
                promises.push(Branch.findByIdAndUpdate(transaction.receiver_branch, {
                    $inc: {
                        commission: receiverCommissionDiff,
                        today_commission: isToday ? receiverCommissionDiff : 0,
                        remaining_transfer_commission: receiverCommissionDiff
                    }
                }));

                // Update transaction's sender and receiver commission fields
                const oldSenderCommission = transaction.sender_commision || 0;
                const oldReceiverCommission = transaction.receiver_commision || 0;

                update_data.sender_commision = oldSenderCommission + senderCommissionDiff;
                update_data.receiver_commision = oldReceiverCommission + receiverCommissionDiff;
            } else {
                // No relationship - commission goes entirely to sender branch
                promises.push(Branch.findByIdAndUpdate(transaction.sender_branch, {
                    $inc: {
                        commission: commissionDifference,
                        today_commission: isToday ? commissionDifference : 0,
                        remaining_transfer_commission: commissionDifference
                    }
                }));

                // Update transaction's sender commission
                const oldSenderCommission = transaction.sender_commision || 0;
                update_data.sender_commision = oldSenderCommission + commissionDifference;
            }
        }
    }

    // ==================== HANDLE BRANCH CHANGES ====================
    if (transaction.admin_permission && (update_data.receiver_branch || update_data.sender_branch)) {
        const points = Number(decrypt_number(transaction.points));
        const senderCommission = transaction.sender_commision || 0;
        const receiverCommission = transaction.receiver_commision || 0;

        // Handle Sender Change
        if (update_data.sender_branch && update_data.sender_branch.toString() !== transaction.sender_branch.toString()) {
            // Revert Old Sender
            promises.push(Branch.findByIdAndUpdate(transaction.sender_branch, {
                $inc: {
                    opening_balance: isToday ? 0 : -points,
                    transaction_balance: -points,
                    commission: -senderCommission,
                    today_commission: isToday ? -senderCommission : 0,
                    remaining_transfer_commission: -senderCommission
                }
            }));

            // Apply New Sender
            promises.push(Branch.findByIdAndUpdate(update_data.sender_branch, {
                $inc: {
                    opening_balance: isToday ? 0 : points,
                    transaction_balance: points,
                    commission: senderCommission,
                    today_commission: isToday ? senderCommission : 0,
                    remaining_transfer_commission: senderCommission
                }
            }));
        }

        // Handle Receiver Change
        if (update_data.receiver_branch && update_data.receiver_branch.toString() !== transaction.receiver_branch.toString()) {
            // Revert Old Receiver
            promises.push(Branch.findByIdAndUpdate(transaction.receiver_branch, {
                $inc: {
                    opening_balance: isToday ? 0 : points,
                    transaction_balance: points,
                    commission: -receiverCommission,
                    today_commission: isToday ? -receiverCommission : 0,
                    remaining_transfer_commission: -receiverCommission
                }
            }));

            // Apply New Receiver
            promises.push(Branch.findByIdAndUpdate(update_data.receiver_branch, {
                $inc: {
                    opening_balance: isToday ? 0 : -points,
                    transaction_balance: -points,
                    commission: receiverCommission,
                    today_commission: isToday ? receiverCommission : 0,
                    remaining_transfer_commission: receiverCommission
                }
            }));
        }
    }

    // Execute all branch updates
    if (promises.length > 0) {
        await Promise.all(promises);
    }

    // ==================== UPDATE SNAPSHOTS FOR PAST TRANSACTIONS ====================
    if (!isToday && transaction.admin_permission) {
        // Get the transaction date for snapshot lookup
        const snapshotDate = new Date(transaction.date);
        snapshotDate.setHours(0, 0, 0, 0);

        // Track which branches need snapshot updates
        const branchesToUpdate = new Set();

        // Determine which branches were affected
        if (update_data.points || update_data.commission) {
            branchesToUpdate.add(transaction.sender_branch.toString());
            branchesToUpdate.add(transaction.receiver_branch.toString());
        }

        if (update_data.sender_branch && update_data.sender_branch.toString() !== transaction.sender_branch.toString()) {
            branchesToUpdate.add(transaction.sender_branch.toString()); // Old sender
            branchesToUpdate.add(update_data.sender_branch.toString()); // New sender
        }

        if (update_data.receiver_branch && update_data.receiver_branch.toString() !== transaction.receiver_branch.toString()) {
            branchesToUpdate.add(transaction.receiver_branch.toString()); // Old receiver
            branchesToUpdate.add(update_data.receiver_branch.toString()); // New receiver
        }

        // Update snapshots for all affected branches
        for (const branchId of branchesToUpdate) {
            try {
                // Find the snapshot for this branch on the transaction date
                const snapshot = await BranchSnapshot.findOne({
                    branch_id: branchId,
                    snapshot_date: snapshotDate
                });

                if (snapshot) {
                    const snapshotUpdates = {};

                    // POINTS CHANGE: Update opening_balance in snapshot
                    if (update_data.points) {
                        const oldPoints = Number(decrypt_number(transaction.points));
                        const newPoints = Number(update_data.points);
                        const pointsDifference = newPoints - oldPoints;

                        if (pointsDifference !== 0) {
                            // Sender branch: increase opening_balance
                            if (branchId === transaction.sender_branch.toString()) {
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) + pointsDifference;
                            }
                            // Receiver branch: decrease opening_balance
                            if (branchId === transaction.receiver_branch.toString()) {
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) - pointsDifference;
                            }
                        }
                    }

                    // COMMISSION CHANGE: Update total_commission in snapshot
                    if (update_data.commission !== undefined) {
                        const oldCommission = transaction.commission || 0;
                        const newCommission = Number(update_data.commission);
                        const commissionDifference = newCommission - oldCommission;

                        if (commissionDifference !== 0) {
                            // Check for relationship to determine commission split
                            const relationship = await CustomRelationship.findOne({
                                $or: [
                                    { branch1_id: transaction.sender_branch, branch2_id: transaction.receiver_branch },
                                    { branch1_id: transaction.receiver_branch, branch2_id: transaction.sender_branch }
                                ]
                            });

                            if (relationship) {
                                let senderCommissionDiff = 0;
                                let receiverCommissionDiff = 0;

                                if (relationship.branch1_id.toString() === transaction.sender_branch.toString()) {
                                    const totalRelCommission = relationship.branch1_commission + relationship.branch2_commission;
                                    if (totalRelCommission > 0) {
                                        senderCommissionDiff = (commissionDifference * relationship.branch1_commission) / totalRelCommission;
                                        receiverCommissionDiff = (commissionDifference * relationship.branch2_commission) / totalRelCommission;
                                    } else {
                                        senderCommissionDiff = commissionDifference / 2;
                                        receiverCommissionDiff = commissionDifference / 2;
                                    }
                                } else {
                                    const totalRelCommission = relationship.branch1_commission + relationship.branch2_commission;
                                    if (totalRelCommission > 0) {
                                        senderCommissionDiff = (commissionDifference * relationship.branch2_commission) / totalRelCommission;
                                        receiverCommissionDiff = (commissionDifference * relationship.branch1_commission) / totalRelCommission;
                                    } else {
                                        senderCommissionDiff = commissionDifference / 2;
                                        receiverCommissionDiff = commissionDifference / 2;
                                    }
                                }

                                if (branchId === transaction.sender_branch.toString()) {
                                    snapshotUpdates.total_commission = (snapshot.total_commission || 0) + senderCommissionDiff;
                                }
                                if (branchId === transaction.receiver_branch.toString()) {
                                    snapshotUpdates.total_commission = (snapshot.total_commission || 0) + receiverCommissionDiff;
                                }
                            } else {
                                // No relationship - all commission to sender
                                if (branchId === transaction.sender_branch.toString()) {
                                    snapshotUpdates.total_commission = (snapshot.total_commission || 0) + commissionDifference;
                                }
                            }
                        }
                    }

                    // BRANCH CHANGE: Update opening_balance in snapshots
                    if (update_data.sender_branch || update_data.receiver_branch) {
                        const points = Number(decrypt_number(transaction.points));
                        const senderCommission = transaction.sender_commision || 0;
                        const receiverCommission = transaction.receiver_commision || 0;

                        // Handle sender branch change
                        if (update_data.sender_branch && update_data.sender_branch.toString() !== transaction.sender_branch.toString()) {
                            if (branchId === transaction.sender_branch.toString()) {
                                // Revert old sender
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) - points;
                                snapshotUpdates.total_commission = (snapshot.total_commission || 0) - senderCommission;
                            }
                            if (branchId === update_data.sender_branch.toString()) {
                                // Apply new sender
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) + points;
                                snapshotUpdates.total_commission = (snapshot.total_commission || 0) + senderCommission;
                            }
                        }

                        // Handle receiver branch change
                        if (update_data.receiver_branch && update_data.receiver_branch.toString() !== transaction.receiver_branch.toString()) {
                            if (branchId === transaction.receiver_branch.toString()) {
                                // Revert old receiver
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) + points;
                                snapshotUpdates.total_commission = (snapshot.total_commission || 0) - receiverCommission;
                            }
                            if (branchId === update_data.receiver_branch.toString()) {
                                // Apply new receiver
                                snapshotUpdates.opening_balance = (snapshot.opening_balance || 0) - points;
                                snapshotUpdates.total_commission = (snapshot.total_commission || 0) + receiverCommission;
                            }
                        }
                    }

                    // Apply snapshot updates if any
                    if (Object.keys(snapshotUpdates).length > 0) {
                        await BranchSnapshot.findByIdAndUpdate(snapshot._id, snapshotUpdates);
                        console.log(`Updated snapshot for branch ${branchId} on date ${snapshotDate.toISOString()}`);
                    }
                } else {
                    console.warn(`No snapshot found for branch ${branchId} on date ${snapshotDate.toISOString()}`);
                }
            } catch (snapshotError) {
                console.error(`Error updating snapshot for branch ${branchId}:`, snapshotError);
                // Continue execution even if snapshot update fails
            }
        }
    }


    // Prepare update with encryption for sensitive fields
    const updateFields = { ...update_data };

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

    // Update the transaction using $set
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

        // Check if transaction is from today or past
        const txDate = new Date(transaction.date);
        const today = new Date();
        const isToday = txDate.getDate() === today.getDate() &&
            txDate.getMonth() === today.getMonth() &&
            txDate.getFullYear() === today.getFullYear();

        await Promise.all([
            Branch.findByIdAndUpdate(
                transaction.sender_branch,
                {
                    $inc: {
                        opening_balance: isToday ? 0 : -points,
                        transaction_balance: -points,
                        commission: -senderCommission,
                        today_commission: -senderCommission,
                        remaining_transfer_commission: -senderCommission
                    }
                }
            ),
            Branch.findByIdAndUpdate(
                transaction.receiver_branch,
                {
                    $inc: {
                        opening_balance: isToday ? 0 : points,
                        transaction_balance: points,
                        commission: -receiverCommission,
                        today_commission: -receiverCommission,
                        remaining_transfer_commission: -receiverCommission
                    }
                }
            )
        ]);

        // ==================== UPDATE SNAPSHOTS FOR PAST TRANSACTIONS ====================
        if (!isToday) {
            // Get the transaction date for snapshot lookup
            const snapshotDate = new Date(transaction.date);
            snapshotDate.setHours(0, 0, 0, 0);

            // Update snapshots for both sender and receiver branches
            const snapshotPromises = [];

            // Update sender branch snapshot
            snapshotPromises.push(
                BranchSnapshot.findOneAndUpdate(
                    {
                        branch_id: transaction.sender_branch,
                        snapshot_date: snapshotDate
                    },
                    {
                        $inc: {
                            opening_balance: -points,
                            total_commission: -senderCommission
                        }
                    }
                ).catch(err => {
                    console.error(`Error updating sender snapshot on delete:`, err);
                })
            );

            // Update receiver branch snapshot
            snapshotPromises.push(
                BranchSnapshot.findOneAndUpdate(
                    {
                        branch_id: transaction.receiver_branch,
                        snapshot_date: snapshotDate
                    },
                    {
                        $inc: {
                            opening_balance: points,
                            total_commission: -receiverCommission
                        }
                    }
                ).catch(err => {
                    console.error(`Error updating receiver snapshot on delete:`, err);
                })
            );

            await Promise.all(snapshotPromises);
            console.log(`Updated snapshots for transaction deletion on date ${snapshotDate.toISOString()}`);
        }
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