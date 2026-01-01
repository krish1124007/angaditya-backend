# Admin API Quick Reference Guide

## Overview
All admin APIs now default to returning **today's data**. To fetch historical data, include a `date` parameter in the request body.

---

## 1. Get All Transactions

### Endpoint
```
POST /api/v1/admin/get-all-transactions
```
**Note:** Changed from GET to POST to support optional `date` parameter in request body.

### Default Behavior
Returns only today's transactions

### Request Body (Optional)
```json
{
  "date": "2026-01-01"
}
```

### Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Today's transactions fetched successfully",
  "data": [
    {
      "_id": "...",
      "sender_branch": "...",
      "receiver_branch": "...",
      "points": "...",
      "sender_branch_name": "Branch A",
      "receiver_branch_name": "Branch B",
      "created_by_name": "user1",
      "date": "2026-01-01T00:00:00.000Z",
      "createdAt": "2026-01-01T10:30:00.000Z",
      ...
    }
  ]
}
```

---

## 2. Get All Branches

### Endpoint
```
GET /api/v1/admin/get-all-branches
```

### Behavior
Returns all branches from the database.

### Request Body
Not required (GET request).

### Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Branches fetched successfully",
  "data": [
    {
      "_id": "...",
      "branch_name": "Branch A",
      "location": "Mumbai",
      "opening_balance": 50000,
      "commission": 1500,
      "today_commission": 200,
      "active": true
    },
    {
      "_id": "...",
      "branch_name": "Branch B",
      "location": "Delhi",
      "opening_balance": 35000,
      "commission": 1200,
      "today_commission": 150,
      "active": true
    }
  ]
}
```

---

## 3. Get Transactions by Branch

### Endpoint
```
POST /api/v1/admin/get-transaction-branch-wise
```

### Default Behavior
Returns only today's transactions for the specified branch

### Request Body (Required)
```json
{
  "branch_id": "507f1f77bcf86cd799439011"
}
```

### Request Body (With Date Filter)
```json
{
  "branch_id": "507f1f77bcf86cd799439011",
  "date": "2026-01-01"
}
```

### Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Today's transactions for branch fetched successfully",
  "data": [
    {
      "_id": "...",
      "sender_branch": "...",
      "receiver_branch": "...",
      "points": "...",
      "sender_branch_name": "Branch A",
      "receiver_branch_name": "Branch B",
      "commission": 50,
      "sender_commision": 30,
      "receiver_commision": 20,
      "date": "2026-01-01T00:00:00.000Z",
      ...
    }
  ]
}
```

---

## 4. Get Today's Transactions (Specific Endpoint)

### Endpoint
```
GET /api/v1/admin/get-today-transactions
```

### Behavior
Always returns only today's transactions (no date filtering available)

### Request Body
```json
{}
```

### Response
Same format as "Get All Transactions"

---

## 5. Trigger Manual Snapshot (Testing)

### Endpoint
```
POST /api/v1/admin/trigger-snapshot
```

### Behavior
Manually creates branch snapshots (useful for testing before midnight)

### Request Body
```json
{}
```

### Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Branch snapshots created successfully",
  "data": null
}
```

---

## Date Formats Supported

### For `getAllBranches`:
- `dd/mm/yy` format: `"01/01/26"`
- `YYYY-MM-DD` format: `"2026-01-01"`

### For All Other APIs:
- `YYYY-MM-DD` format: `"2026-01-01"`
- ISO 8601 format: `"2026-01-01T00:00:00.000Z"`

---

## Key Points

✅ **Default = Today**: All APIs return today's data by default
✅ **Optional Filtering**: Add `date` parameter to fetch historical data
✅ **Consistent Format**: All APIs use the same `date` field
✅ **Clear Messages**: Response messages indicate what data was fetched
✅ **Backwards Compatible**: Existing API calls without `date` parameter will work (showing today's data)

---

## Migration Notes

If you were previously expecting **all** transactions/branches, you now need to:
1. Either remove the date filter to get today's data
2. Or provide a specific date to fetch historical data
3. Or use the date range report API for comprehensive reports

**Before:**
```json
POST /admin/transactions
{}
// Returned ALL transactions
```

**Now:**
```json
POST /admin/transactions
{}
// Returns ONLY today's transactions

// To get all from a specific date:
POST /admin/transactions
{ "date": "2025-01-01" }
```

---

## Scheduler Status

The automatic snapshot scheduler:
- Runs every day at **12:00 AM IST**
- Creates snapshots for all active branches
- Resets `today_commission` to 0
- Check server logs for scheduler status and execution times
