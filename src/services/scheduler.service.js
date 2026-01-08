import cron from "node-cron";
import { Branch } from "../models/branch.model.js";
import { BranchSnapshot } from "../models/branch-snapshot.model.js";

/**
 * Creates daily snapshots of all active branches
 * Snapshot is created for the CURRENT day at 11:59 PM
 */
const createDailyBranchSnapshots = async () => {
  try {
    console.log("🚀 Starting daily branch snapshot creation...");

    const branches = await Branch.find({ active: true });

    if (!branches.length) {
      console.log("⚠️ No active branches found");
      return;
    }

    // ✅ Snapshot date = TODAY (since we run at 11:59 PM, end of day)
    const snapshotDate = new Date();
    snapshotDate.setHours(0, 0, 0, 0);

    let successCount = 0;

    for (const branch of branches) {
      try {
        await BranchSnapshot.create({
          branch_id: branch._id,
          branch_name: branch.branch_name,
          opening_balance: branch.opening_balance || 0,
          total_commission: branch.commission || 0,
          today_commission: branch.today_commission || 0,
          snapshot_date: snapshotDate
        });

        // ✅ Reset today's commission AFTER snapshot
        // ✅ Sync Opening Balance = Transaction Balance (As per client requirement)
        await Branch.updateOne(
          { _id: branch._id },
          {
            $set: {
              today_commission: 0,
              opening_balance: branch.transaction_balance || branch.opening_balance // Fallback to opening if transaction_balance is not set yet
            }
          }
        );

        console.log(`✅ Snapshot created: ${branch.branch_name}`);
        successCount++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(
            `⚠️ Snapshot already exists for ${branch.branch_name} (${snapshotDate.toDateString()})`
          );
        } else {
          console.error(
            `❌ Snapshot failed for ${branch.branch_name}:`,
            error.message
          );
        }
      }
    }

    console.log(
      `📊 Snapshot completed: ${successCount}/${branches.length} branches`
    );
  } catch (error) {
    console.error("🔥 Snapshot job failed:", error);
  }
};

/**
 * Initializes cron scheduler
 * Runs every day at 11:59 PM IST
 */
export const initScheduler = () => {
  const cronExpression = "59 23 * * *"; // Run at 11:59 PM every day

  const dailyTask = cron.schedule(
    cronExpression,
    async () => {
      console.log("\n" + "=".repeat(60));
      console.log("📅 Daily Branch Snapshot Job Triggered");
      console.log(
        "🕒 IST:",
        new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      );
      console.log("=".repeat(60) + "\n");

      await createDailyBranchSnapshots();

      console.log("✅ Daily Snapshot Job Finished\n");
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }
  );

  // ❤️ Heartbeat every hour
  const heartbeatTask = cron.schedule(
    "0 * * * *",
    () => {
      console.log(
        `💚 Scheduler alive at ${new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata"
        })}`
      );
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata"
    }
  );

  console.log("✅ Scheduler initialized successfully");
  console.log("⏰ Runs daily at 11:59 PM IST");
  console.log("❤️ Heartbeat every hour");

  return { dailyTask, heartbeatTask };
};

/**
 * Manual trigger (admin / testing)
 */
export const manualCreateSnapshots = async () => {
  console.log("🧪 Manual snapshot trigger started");
  await createDailyBranchSnapshots();
};
