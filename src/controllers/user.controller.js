import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";
import moment from "moment";
import { decrypt_number } from "../secrets/decrypt.js";
import { UserAccessLog } from "../models/useraccesslog.model.js"


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
    console.log(id)

    const update = await Transaction.findByIdAndUpdate(id, { status: true }, { new: true });
    console.log(update)

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
    try {
        const userId = req.user._id;
        if (!userId) {
            return returnCode(res, 400, false, "User ID is required");
        }

        const user = await User.findById(userId);
        if (!user) {
            return returnCode(res, 404, false, "User not found");
        }
        if (!user.branch) {
            return returnCode(res, 400, false, "User has no branch assigned");
        }

        // Parallel fetching
        const [todayTx, weekTx, monthTx, brnch] = await Promise.all([
            Transaction.find({
                create_by: userId,
                createdAt: { $gte: moment().startOf("day").toDate() }
            }),
            Transaction.find({
                create_by: userId,
                createdAt: { $gte: moment().startOf("week").toDate() }
            }),
            Transaction.find({
                create_by: userId,
                createdAt: { $gte: moment().startOf("month").toDate() }
            }),
            Branch.findById(user.branch)
        ]);

        if (!brnch) {
            return returnCode(res, 404, false, "Branch not found");
        }

        const branchId = user.branch;
        const commission = (brnch && Number(brnch.commision)) || 0;

        // Helper: process transactions
        const processTransactions = (transactions, periodType = 'today') => {
            let sent = 0;
            let received = 0;
            let earnings = 0;
            const history = [];
            const dailyData = periodType === 'week' ?
                Array.from({ length: 7 }).map((_, i) => ({
                    day: moment().day(i).format("ddd"),
                    amount: 0,
                    earnings: 0
                })) : null;

            transactions.forEach(tx => {
                let amount;
                try {
                    amount = Number(decrypt_number(tx.points));
                    if (Number.isNaN(amount)) throw new Error("Invalid amount");
                } catch (error) {
                    console.error("Decryption/amount error:", error);
                    return; // skip this tx
                }

                // today's history
                if (periodType === 'today') {
                    history.push({
                        time: moment(tx.createdAt).format("hh:mm A"),
                        amount,
                        type: tx.receiver_branch?.toString() === branchId.toString() ? "received" : "sent",
                        status: tx.status
                    });
                }

                // weekly daily aggregation
                if (periodType === 'week' && dailyData) {
                    const dayIndex = moment(tx.createdAt).day(); // 0..6
                    dailyData[dayIndex].amount += amount;
                    if (tx.status === true) {
                        const e = calcEarning(amount, commission);
                        dailyData[dayIndex].earnings += e;
                    }
                }

                // sent / received totals
                if (tx.sender_branch?.toString() === branchId.toString()) {
                    sent += amount;
                } else if (tx.receiver_branch?.toString() === branchId.toString()) {
                    received += amount;
                }

                // overall earnings for this period (only approved)
                if (tx.status === true) {
                    earnings += calcEarning(amount, commission);
                }
            });

            return {
                totalEarnings: earnings,
                sentAmount: sent,
                receivedAmount: received,
                transactions: transactions.length,
                ...(periodType === 'today' && { history }),
                ...(periodType === 'week' && { dailyData }),
                ...(periodType === 'month' && {
                    weeklyData: calculateWeeklyData(transactions, branchId)
                })
            };
        };

        // monthly -> weekly buckets (week 1..5)
        const calculateWeeklyData = (transactions) => {
            const weeks = [
                { week: "Week 1", amount: 0, earnings: 0 },
                { week: "Week 2", amount: 0, earnings: 0 },
                { week: "Week 3", amount: 0, earnings: 0 },
                { week: "Week 4", amount: 0, earnings: 0 },
                { week: "Week 5", amount: 0, earnings: 0 }
            ];

            transactions.forEach(tx => {
                try {
                    const amount = Number(decrypt_number(tx.points));
                    if (Number.isNaN(amount)) throw new Error("Invalid amount");

                    const txDate = moment(tx.createdAt);
                    // 1-7 => week 0, 8-14 => week 1, ...
                    const weekIndex = Math.min(4, Math.max(0, Math.ceil(txDate.date() / 7) - 1));
                    weeks[weekIndex].amount += amount;
                    if (tx.status === true) {
                        weeks[weekIndex].earnings += calcEarning(amount, commission);
                    }
                } catch (error) {
                    console.error("Error processing transaction for monthly weeks:", error);
                }
            });

            // trim trailing empty weeks
            while (weeks.length > 0 && weeks[weeks.length - 1].amount === 0 && weeks[weeks.length - 1].earnings === 0) {
                weeks.pop();
            }

            return weeks;
        };

        const todayData = processTransactions(todayTx, 'today');
        const weeklyData = processTransactions(weekTx, 'week');
        const monthlyData = processTransactions(monthTx, 'month');

        return returnCode(res, 200, true, "Dashboard fetched successfully", {
            today: todayData,
            week: weeklyData,
            month: monthlyData
        });

    } catch (error) {
        console.error("Dashboard error:", error);
        return returnCode(res, 500, false, "Internal server error");
    }
});

const saveLogs = asyncHandler(async(req,res)=>{
    const  {ip_address, device_info} = req.body;
    const username = req.user.username;

    const save_log = await UserAccessLog.create({username , ip_address,device_info})

    if(!save_log){
        return returnCode(res,500,false,"something error to save the logs",null)
    }

    return returnCode(res,200,true,"Data save successfully",save_log)

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