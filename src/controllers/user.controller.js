import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";
import { User } from "../models/user.model.js";
import { Transaction } from "../models/transaction.model.js";
import { Branch } from "../models/branch.model.js";
import moment from "moment";
import { decrypt_number } from "../secrets/decrypt.js";


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





const getDashboardData = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        
        // Input validation
        if (!userId) {
            return returnCode(res, 400, false, "User ID is required");
        }

        // Parallel fetching for better performance
        const [todayTx, weekTx, monthTx,brnch] = await Promise.all([
           
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

        // Validate user and branch
        if (!user) {
            return returnCode(res, 404, false, "User not found");
        }
        
        if (!user.branch) {
            return returnCode(res, 400, false, "User has no branch assigned");
        }

        const branch = await Branch.findById(user.branch);
        if (!branch) {
            return returnCode(res, 404, false, "Branch not found");
        }

        const branchId = user.branch;
        const commission = brnch.commision || 0; // Added fallback

        // Helper function to process transactions
        const processTransactions = (transactions, periodType = 'today') => {
            let sent = 0;
            let received = 0;
            let earnings = 0;
            const history = [];
            const dailyData = periodType === 'week' ? 
                Array(7).fill(0).map((_, i) => ({ 
                    day: moment().day(i).format("ddd"), 
                    amount: 0 
                })) : null;
            
            transactions.forEach(tx => {
                let amount;
                try {
                    amount = decrypt_number(tx.points);
                } catch (error) {
                    console.error("Decryption error:", error);
                    return; // Skip this transaction
                }
                
                // Build history for today only (to reduce memory)
                if (periodType === 'today') {
                    history.push({
                        time: moment(tx.createdAt).format("hh:mm A"),
                        amount,
                        type: tx.receiver_branch?.toString() === branchId.toString() ? "received" : "sent",
                        status: tx.status
                    });
                }
                
                // Update daily data for week
                if (periodType === 'week' && dailyData) {
                    const dayIndex = moment(tx.createdAt).day();
                    dailyData[dayIndex].amount += amount;
                }
                
                // Calculate sent/received
                if (tx.sender_branch?.toString() === branchId.toString()) {
                    sent += amount;
                } else if (tx.receiver_branch?.toString() === branchId.toString()) {
                    received += amount;
                }
                
                // Calculate earnings for approved transactions
                if (tx.status === true) {
                    console.log(amount)
                    console.log(calcEarning(amount, commission))
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

        // Helper for monthly weekly data
        const calculateWeeklyData = (transactions, branchId) => {
            const weeks = [
                { week: "Week 1", amount: 0 },
                { week: "Week 2", amount: 0 },
                { week: "Week 3", amount: 0 },
                { week: "Week 4", amount: 0 },
                { week: "Week 5", amount: 0 } // Added for 5-week months
            ];
            
            transactions.forEach(tx => {
                try {
                    const amount = decrypt_number(tx.points);
                    const txDate = moment(tx.createdAt);
                    const weekOfMonth = Math.floor(txDate.date() / 7);
                    const weekIndex = Math.min(weekOfMonth, 4); // Cap at week 5
                    
                    weeks[weekIndex].amount += amount;
                } catch (error) {
                    console.error("Error processing transaction:", error);
                }
            });
            
            // Remove empty weeks at the end
            while (weeks.length > 0 && weeks[weeks.length - 1].amount === 0) {
                weeks.pop();
            }
            
            return weeks;
        };

        // Process data
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
    getDashboardData
}   