import cron from "node-cron";
import { Branch } from "../models/branch.model.js";
import { BranchSnapshot } from "../models/branch-snapshot.model.js";

/**
 * Creates daily snapshots of all branches
 * Saves branch name, opening balance, total commission, and today's commission
 * Resets today_commision to 0 for the new day
 */
const createDailyBranchSnapshots = async () => {
    try {
        console.log("Starting daily branch snapshot creation...");

        // Get all active branches
        const branches = await Branch.find({ active: true });

        if (!branches || branches.length === 0) {
            console.log("No active branches found for snapshot creation");
            return;
        }

        // Set snapshot date to start of current day
        const snapshotDate = new Date();
        snapshotDate.setHours(0, 0, 0, 0);

        const snapshotPromises = branches.map(async (branch) => {
            try {
                // Create snapshot for this branch
                const snapshot = await BranchSnapshot.create({
                    branch_id: branch._id,
                    branch_name: branch.branch_name,
                    opening_balance: branch.opening_balance || 0,
                    total_commision: branch.commision || 0,
                    today_commision: branch.today_commision || 0,
                    snapshot_date: snapshotDate
                });

                // Reset today's commission for the new day
                await Branch.findByIdAndUpdate(
                    branch._id,
                    { today_commision: 0 }
                );

                console.log(`Snapshot created for branch: ${branch.branch_name}`);
                return snapshot;
            } catch (error) {
                // Handle duplicate snapshot error (if scheduler runs twice on same day)
                if (error.code === 11000) {
                    console.log(`Snapshot already exists for branch: ${branch.branch_name} on ${snapshotDate.toDateString()}`);
                } else {
                    console.error(`Error creating snapshot for branch ${branch.branch_name}:`, error.message);
                }
                return null;
            }
        });

        const results = await Promise.all(snapshotPromises);
        const successCount = results.filter(r => r !== null).length;

        console.log(`Daily branch snapshot creation completed. ${successCount}/${branches.length} snapshots created.`);
    } catch (error) {
        console.error("Error in daily branch snapshot creation:", error);
    }
};

/**
 * Initialize the scheduler
 * Runs every day at midnight (12:00 AM) India Standard Time
 */
export const initScheduler = () => {
    // Schedule for midnight (00:00) IST every day
    // Cron format: second minute hour day month weekday
    // "0 0 * * *" means at 00:00 (midnight) every day
    const cronExpression = "0 0 * * *";

    cron.schedule(cronExpression,
        () => {
            console.log("=== Daily Branch Snapshot Scheduler Triggered ===");
            createDailyBranchSnapshots();
        },
        {
            scheduled: true,
            timezone: "Asia/Kolkata" // India Standard Time (IST)
        }
    );

    console.log("✅ Daily branch snapshot scheduler initialized (Runs at 12:00 AM IST)");
};

/**
 * Manual trigger function for testing purposes
 * Export this to allow admin to manually trigger snapshot creation
 */
export const manualCreateSnapshots = async () => {
    console.log("Manual snapshot creation triggered");
    await createDailyBranchSnapshots();
};
