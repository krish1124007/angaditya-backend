/**
 * Scheduler Diagnostic Script
 * 
 * This script helps diagnose issues with the scheduler by:
 * 1. Checking the latest snapshots
 * 2. Showing when they were created
 * 3. Identifying if the scheduler is running
 * 
 * Usage:
 *   node scheduler-diagnostic.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BranchSnapshot } from './src/models/branch-snapshot.model.js';
import { Branch } from './src/models/branch.model.js';

dotenv.config();

const checkSchedulerStatus = async () => {
    try {
        // Connect to database
        console.log('\n🔍 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Get the most recent snapshot
        const latestSnapshot = await BranchSnapshot.findOne()
            .sort({ createdAt: -1 })
            .populate('branch_id', 'branch_name');

        // Get all snapshots from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const todaySnapshots = await BranchSnapshot.find({
            snapshot_date: { $gte: today, $lte: todayEnd }
        });

        // Get snapshots from the last 5 days
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        fiveDaysAgo.setHours(0, 0, 0, 0);

        const recentSnapshots = await BranchSnapshot.find({
            snapshot_date: { $gte: fiveDaysAgo }
        }).sort({ snapshot_date: -1 });

        // Get total number of active branches
        const activeBranches = await Branch.countDocuments({ active: true });
        const allBranches = await Branch.find({ active: true });

        // Display results
        console.log('═══════════════════════════════════════════════════════════');
        console.log('        📊 SCHEDULER HEALTH CHECK REPORT');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log(`⏰ Current Time: ${new Date().toISOString()}`);
        console.log(`🇮🇳 IST Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`);

        console.log('───────────────────────────────────────────────────────────');
        console.log('📈 LATEST SNAPSHOT INFORMATION');
        console.log('───────────────────────────────────────────────────────────');

        if (latestSnapshot) {
            const hoursSinceLastSnapshot = Math.floor((Date.now() - latestSnapshot.createdAt.getTime()) / (1000 * 60 * 60));
            console.log(`  Branch: ${latestSnapshot.branch_id?.branch_name || 'Unknown'}`);
            console.log(`  Snapshot Date: ${latestSnapshot.snapshot_date}`);
            console.log(`  Created At: ${latestSnapshot.createdAt}`);
            console.log(`  Hours Ago: ${hoursSinceLastSnapshot} hours`);

            if (hoursSinceLastSnapshot > 48) {
                console.log('  ⚠️  WARNING: Last snapshot is more than 2 days old!');
            }
        } else {
            console.log('  ❌ No snapshots found in database!');
        }

        console.log('\n───────────────────────────────────────────────────────────');
        console.log('📅 TODAY\'S SNAPSHOTS');
        console.log('───────────────────────────────────────────────────────────');
        console.log(`  Snapshots Created Today: ${todaySnapshots.length}`);
        console.log(`  Total Active Branches: ${activeBranches}`);

        if (todaySnapshots.length === 0) {
            const currentHour = new Date().getHours();
            if (currentHour >= 1) {
                console.log('  ❌ ERROR: No snapshots created today (scheduler may not be running!)');
            } else {
                console.log('  ℹ️  INFO: It\'s before 1 AM, snapshots haven\'t been created yet today');
            }
        } else if (todaySnapshots.length < activeBranches) {
            console.log(`  ⚠️  WARNING: Only ${todaySnapshots.length} of ${activeBranches} snapshots created`);
        } else {
            console.log('  ✅ All branches have snapshots for today');
        }

        console.log('\n───────────────────────────────────────────────────────────');
        console.log('📜 LAST 5 DAYS SNAPSHOT SUMMARY');
        console.log('───────────────────────────────────────────────────────────');

        // Group snapshots by date
        const snapshotsByDate = {};
        recentSnapshots.forEach(snapshot => {
            const dateKey = snapshot.snapshot_date.toISOString().split('T')[0];
            if (!snapshotsByDate[dateKey]) {
                snapshotsByDate[dateKey] = 0;
            }
            snapshotsByDate[dateKey]++;
        });

        // Display snapshot counts for each day
        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const count = snapshotsByDate[dateKey] || 0;
            const status = count === 0 ? '❌' : count < activeBranches ? '⚠️ ' : '✅';
            console.log(`  ${status} ${dateKey}: ${count}/${activeBranches} snapshots`);
        }

        console.log('\n───────────────────────────────────────────────────────────');
        console.log('🏢 ACTIVE BRANCHES');
        console.log('───────────────────────────────────────────────────────────');

        allBranches.forEach((branch, index) => {
            console.log(`  ${index + 1}. ${branch.branch_name}`);
        });

        console.log('\n───────────────────────────────────────────────────────────');
        console.log('💡 RECOMMENDATIONS');
        console.log('───────────────────────────────────────────────────────────');

        if (recentSnapshots.length === 0) {
            console.log('  ❌ No snapshots in the last 5 days');
            console.log('     → The scheduler has likely never run or hasn\'t run for 5+ days');
            console.log('     → Check if the server is running continuously');
            console.log('     → Check server logs for errors');
        } else if (todaySnapshots.length === 0 && new Date().getHours() >= 1) {
            console.log('  ⚠️  No snapshots today (and it\'s past midnight)');
            console.log('     → The scheduler may have failed to run last night');
            console.log('     → Manually trigger snapshot: POST /api/admin/trigger-snapshot');
            console.log('     → Ensure server was running at midnight IST');
        } else {
            console.log('  ✅ Scheduler appears to be working');
            console.log('     → Continue monitoring through /api/admin/check-scheduler-health');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('        ✅ DIAGNOSTIC COMPLETE');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Error running diagnostic:');
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed\n');
    }
};

// Run the diagnostic
checkSchedulerStatus();
