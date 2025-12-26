/**
 * Example usage of the Date Range Report API
 * This file demonstrates how to call the getDateRangeReport endpoint
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/admin';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

/**
 * Example 1: Get report for a specific date range
 */
async function getMonthlyReport() {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/get-date-range-report`,
            {
                start_date: '01/12/24',
                end_date: '31/12/24'
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const report = response.data.data;

        console.log('=== MONTHLY REPORT ===');
        console.log(`Date Range: ${report.date_range.start_date} to ${report.date_range.end_date}`);
        console.log(`Days Covered: ${report.date_range.days_covered}`);
        console.log(`\nTotal Transactions: ${report.transactions.total_count}`);
        console.log(`Approved: ${report.transactions.approved_count}`);
        console.log(`Pending: ${report.transactions.pending_count}`);
        console.log(`Completed: ${report.transactions.completed_count}`);
        console.log(`\nTotal Commission: ₹${report.statistics.total_commission}`);
        console.log(`Transactions per Day: ${report.statistics.transactions_per_day}`);

        return report;
    } catch (error) {
        console.error('Error fetching monthly report:', error.response?.data || error.message);
    }
}

/**
 * Example 2: Get today's report
 */
async function getTodayReport() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    const dateStr = `${dd}/${mm}/${yy}`;

    try {
        const response = await axios.post(
            `${API_BASE_URL}/get-date-range-report`,
            {
                start_date: dateStr,
                end_date: dateStr
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const report = response.data.data;

        console.log('=== TODAY\'S REPORT ===');
        console.log(`Date: ${dateStr}`);
        console.log(`Total Transactions: ${report.transactions.total_count}`);
        console.log(`Total Commission: ₹${report.statistics.total_commission}`);

        return report;
    } catch (error) {
        console.error('Error fetching today\'s report:', error.response?.data || error.message);
    }
}

/**
 * Example 3: Get weekly report
 */
async function getWeeklyReport() {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const formatDate = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };

    try {
        const response = await axios.post(
            `${API_BASE_URL}/get-date-range-report`,
            {
                start_date: formatDate(lastWeek),
                end_date: formatDate(today)
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const report = response.data.data;

        console.log('=== WEEKLY REPORT ===');
        console.log(`Period: ${formatDate(lastWeek)} to ${formatDate(today)}`);
        console.log(`\nBranch Statistics:`);
        report.statistics.branch_statistics.forEach(branch => {
            console.log(`\n${branch.branch_name}:`);
            console.log(`  Sent: ${branch.sent_count}`);
            console.log(`  Received: ${branch.received_count}`);
            console.log(`  Commission: ₹${branch.total_commission}`);
        });

        return report;
    } catch (error) {
        console.error('Error fetching weekly report:', error.response?.data || error.message);
    }
}

/**
 * Example 4: Get branch-specific analysis from report
 */
async function getBranchAnalysis(branchName, startDate, endDate) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/get-date-range-report`,
            {
                start_date: startDate,
                end_date: endDate
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const report = response.data.data;

        // Filter transactions for specific branch
        const branchTransactions = report.transactions.data.filter(
            t => t.sender_branch_name === branchName || t.receiver_branch_name === branchName
        );

        // Get branch snapshots
        const branchSnapshots = report.branch_snapshots.snapshots_by_branch[branchName] || [];

        // Get branch statistics
        const branchStats = report.statistics.branch_statistics.find(
            b => b.branch_name === branchName
        );

        console.log(`=== ${branchName} ANALYSIS ===`);
        console.log(`\nTransactions: ${branchTransactions.length}`);
        console.log(`Sent: ${branchStats?.sent_count || 0}`);
        console.log(`Received: ${branchStats?.received_count || 0}`);
        console.log(`Commission: ₹${branchStats?.total_commission || 0}`);
        console.log(`\nSnapshots: ${branchSnapshots.length}`);

        if (branchSnapshots.length > 0) {
            console.log('\nBalance History:');
            branchSnapshots.forEach(snapshot => {
                console.log(`  ${new Date(snapshot.date).toLocaleDateString()}: ₹${snapshot.opening_balance}`);
            });
        }

        return {
            transactions: branchTransactions,
            snapshots: branchSnapshots,
            statistics: branchStats
        };
    } catch (error) {
        console.error('Error fetching branch analysis:', error.response?.data || error.message);
    }
}

/**
 * Example 5: Export report data to CSV format
 */
async function exportReportToCSV(startDate, endDate) {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/get-date-range-report`,
            {
                start_date: startDate,
                end_date: endDate
            },
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const report = response.data.data;

        // Create CSV header
        let csv = 'Date,Sender Branch,Receiver Branch,Commission,Status,Admin Permission\n';

        // Add transaction rows
        report.transactions.data.forEach(t => {
            const date = new Date(t.createdAt).toLocaleDateString();
            const sender = t.sender_branch_name || 'N/A';
            const receiver = t.receiver_branch_name || 'N/A';
            const commission = t.commission || 0;
            const status = t.status ? 'Completed' : 'Pending';
            const permission = t.admin_permission ? 'Approved' : 'Pending';

            csv += `${date},${sender},${receiver},${commission},${status},${permission}\n`;
        });

        console.log('=== CSV EXPORT ===');
        console.log(csv);

        // In a real application, you would save this to a file
        // const fs = require('fs');
        // fs.writeFileSync(`report_${startDate}_to_${endDate}.csv`, csv);

        return csv;
    } catch (error) {
        console.error('Error exporting report:', error.response?.data || error.message);
    }
}

// Run examples
async function runExamples() {
    console.log('Running Date Range Report Examples...\n');

    // Example 1: Monthly Report
    await getMonthlyReport();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 2: Today's Report
    await getTodayReport();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 3: Weekly Report
    await getWeeklyReport();
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 4: Branch Analysis
    await getBranchAnalysis('Mumbai Branch', '01/12/24', '31/12/24');
    console.log('\n' + '='.repeat(50) + '\n');

    // Example 5: CSV Export
    await exportReportToCSV('01/12/24', '31/12/24');
}

// Uncomment to run examples
// runExamples();

module.exports = {
    getMonthlyReport,
    getTodayReport,
    getWeeklyReport,
    getBranchAnalysis,
    exportReportToCSV
};
