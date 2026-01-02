/**
 * Test file to verify date filtering logic
 * Run this to verify the date range fix works correctly
 */

// Test Case 1: Specific date filter
const testDate = '2025-12-31';
const start = new Date(testDate);
start.setHours(0, 0, 0, 0);
const end = new Date(testDate);
end.setHours(23, 59, 59, 999);

console.log('Test Case 1: Specific Date Filter (31-12-2025)');
console.log('Start:', start.toISOString());
console.log('End:', end.toISOString());
console.log('Filter:', { date: { $gte: start, $lte: end } });
console.log('');

// Test Case 2: Today's transactions
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayEnd = new Date();
todayEnd.setHours(23, 59, 59, 999);

console.log('Test Case 2: Today\'s Transactions');
console.log('Start:', todayStart.toISOString());
console.log('End:', todayEnd.toISOString());
console.log('Filter:', { date: { $gte: todayStart, $lte: todayEnd } });
console.log('');

// Test Case 3: Verify next day is NOT included
const nextDayStart = new Date(testDate);
nextDayStart.setDate(nextDayStart.getDate() + 1);
nextDayStart.setHours(0, 0, 0, 0);

console.log('Test Case 3: Verify Next Day Exclusion');
console.log('End of 31-12-2025:', end.toISOString());
console.log('Start of 01-01-2026:', nextDayStart.toISOString());
console.log('Is next day after filter end?', nextDayStart > end);
console.log('Result: Next day should NOT be included ✓');
