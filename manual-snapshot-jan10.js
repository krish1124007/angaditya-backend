import mongoose from "mongoose";
import dotenv from "dotenv";
import { Branch } from "./src/models/branch.model.js";
import { BranchSnapshot } from "./src/models/branch-snapshot.model.js";
import { DailyCommission } from "./src/models/daily-commission.model.js";
import { HOLeaderSnapshot } from "./src/models/ho-leader-snapshot.model.js";

dotenv.config();

async function runSnapshotToJan10() {
    try {
        if (!process.env.MONGO_URL) {
            console.error("❌ MONGO_URL not found in .env");
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URL);
        console.log("🚀 Connected to MongoDB");

        // Set target date to 10th January 2026
        const targetDate = new Date("2026-01-11");
        targetDate.setHours(0, 0, 0, 0);

        console.log(`📅 Creating manual snapshot for: ${targetDate.toLocaleDateString('en-IN')}`);

        const branches = await Branch.find({});
        console.log(`📊 Found ${branches.length} branches to process`);

        let totalTodayCommission = 0;
        let posTotalBal = 0;
        let negTotalBal = 0;
        let posTotalComm = 0;
        let negTotalComm = 0;
        let posCount = 0;
        let negCount = 0;

        // 1. Process each branch
        for (const branch of branches) {
            console.log(`🔹 Processing: ${branch.branch_name}`);

            const branchComm = branch.commission || 0;
            const branchTodayComm = branch.today_commission || 0;
            const branchBal = branch.opening_balance || 0;

            // HO Metrics logic from finalizeDailyCommission
            if (!branch.branch_name.toLowerCase().includes('commission')) {
                if (branchBal >= 0) {
                    posTotalBal += branchBal;
                    posTotalComm += branchComm;
                    posCount++;
                } else {
                    negTotalBal += branchBal;
                    negTotalComm += branchComm;
                    negCount++;
                }
            }

            // Save Daily Commission record if there was earnings
            if (branchTodayComm > 0) {
                totalTodayCommission += branchTodayComm;
                try {
                    await DailyCommission.findOneAndUpdate(
                        { branch_id: branch._id, date: targetDate },
                        {
                            branch_name: branch.branch_name,
                            amount: branchTodayComm
                        },
                        { upsert: true, new: true }
                    );
                    console.log(`   ✅ Daily commission record saved: ${branchTodayComm}`);
                } catch (error) {
                    console.error(`   ❌ Failed to save daily commission for ${branch.branch_name}:`, error.message);
                }
            }

            // Create Branch Snapshot record
            try {
                await BranchSnapshot.create({
                    branch_id: branch._id,
                    branch_name: branch.branch_name,
                    opening_balance: branch.opening_balance || 0,
                    total_commission: branch.commission || 0,
                    today_commission: branch.today_commission || 0,
                    snapshot_date: targetDate
                });
                console.log(`   ✅ Branch snapshot created`);
            } catch (error) {
                if (error.code === 11000) {
                    console.log(`   ⚠️ Snapshot already exists for this branch and date`);
                } else {
                    console.error(`   ❌ Branch snapshot failed:`, error.message);
                }
            }
        }

        // 2. Save HO Leader Snapshot
        const hoBalance = (posTotalBal + posTotalComm) + (negTotalBal + negTotalComm) - (posTotalComm + negTotalComm);
        try {
            await HOLeaderSnapshot.findOneAndUpdate(
                { snapshot_date: targetDate },
                {
                    positive_total_balance: posTotalBal,
                    negative_total_balance: negTotalBal,
                    positive_total_commission: posTotalComm,
                    negative_total_commission: negTotalComm,
                    ho_balance: hoBalance,
                    positive_count: posCount,
                    negative_count: negCount
                },
                { upsert: true, new: true }
            );
            console.log(`✅ HO Leader Snapshot saved successfully. HO Balance: ${hoBalance}`);
        } catch (error) {
            console.error("❌ Failed to save HO Leader Snapshot:", error.message);
        }

        // 3. Update COMMISSION branch (Head Office profit)
        if (totalTodayCommission > 0) {
            let commissionBranch = await Branch.findOne({ branch_name: "COMMISSION" });
            if (!commissionBranch) {
                commissionBranch = await Branch.create({
                    branch_name: "COMMISSION",
                    location: "HEAD OFFICE",
                    opening_balance: 0,
                    active: true
                });
            }
            await Branch.findByIdAndUpdate(commissionBranch._id, {
                $inc: { opening_balance: totalTodayCommission }
            });
            console.log(`✅ Transferred total commission ${totalTodayCommission} to COMMISSION branch`);
        }

        // 4. Final step: Sync opening balance for next day and reset today's commission
        console.log("🔄 Syncing all branches (Opening Balance = Transaction Balance)...");
        const syncPromises = branches.map(branch =>
            Branch.findByIdAndUpdate(branch._id, {
                opening_balance: branch.transaction_balance || branch.opening_balance,
                today_commission: 0
            })
        );
        await Promise.all(syncPromises);

        console.log("🏁 FINISHED: All end-of-day performance steps completed for 11-01-2026.");
        process.exit(0);

    } catch (error) {
        console.error("🔥 CRITICAL ERROR:", error);
        process.exit(1);
    }
}

runSnapshotToJan10();
