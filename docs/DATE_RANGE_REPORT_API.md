# Date Range Report API Documentation

## Overview
The `getDateRangeReport` function generates a comprehensive report between two dates, including:
- All transactions with branch names
- Branch balance snapshots (historical data)
- Current branch balances
- Transaction statistics
- Commission summaries
- Branch-wise activity statistics

## Endpoint
**POST** `/api/admin/get-date-range-report`

## Authentication
Requires admin authentication token in the request headers.

## Request Body

```json
{
  "start_date": "25/12/24",  // Format: dd/mm/yy or ISO date string
  "end_date": "26/12/25"     // Format: dd/mm/yy or ISO date string
}
```

### Supported Date Formats
1. **dd/mm/yy** - Example: `"25/12/24"` (December 25, 2024)
2. **ISO String** - Example: `"2024-12-25T00:00:00.000Z"`

## Response Structure

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Report generated successfully from 25/12/24 to 26/12/25",
  "data": {
    "date_range": {
      "start_date": "2024-12-25T00:00:00.000Z",
      "end_date": "2024-12-26T23:59:59.999Z",
      "days_covered": 2
    },
    
    "transactions": {
      "total_count": 150,
      "approved_count": 120,
      "pending_count": 30,
      "completed_count": 100,
      "data": [
        {
          "_id": "...",
          "sender_branch": "...",
          "receiver_branch": "...",
          "sender_branch_name": "Mumbai Branch",
          "receiver_branch_name": "Delhi Branch",
          "points": "encrypted_value",
          "commission": 50,
          "admin_permission": true,
          "status": true,
          "created_by_name": "john_doe",
          "createdAt": "2024-12-25T10:30:00.000Z",
          "updatedAt": "2024-12-25T10:35:00.000Z"
        }
        // ... more transactions
      ]
    },

    "branch_snapshots": {
      "total_snapshots": 20,
      "snapshots_by_branch": {
        "Mumbai Branch": [
          {
            "date": "2024-12-25T00:00:00.000Z",
            "opening_balance": 10000,
            "total_commission": 5000,
            "today_commission": 500
          }
          // ... more snapshots for this branch
        ],
        "Delhi Branch": [
          // ... snapshots for Delhi Branch
        ]
      },
      "all_snapshots": [
        // Array of all snapshot objects with full details
      ]
    },

    "current_branch_balances": [
      {
        "_id": "...",
        "branch_name": "Mumbai Branch",
        "location": "Mumbai, Maharashtra",
        "opening_balance": 15000,
        "commission": 6000,
        "today_commission": 800,
        "active": true
      }
      // ... more branches
    ],

    "statistics": {
      "total_commission": 25000,
      "branch_statistics": [
        {
          "branch_name": "Mumbai Branch",
          "sent_count": 50,
          "received_count": 30,
          "total_commission": 3000
        }
        // ... more branch statistics
      ],
      "transactions_per_day": "75.00"
    },

    "summary": {
      "message": "Report generated for 2 days",
      "total_transactions": 150,
      "total_branches_with_activity": 10,
      "total_snapshots": 20,
      "total_commission": 25000
    }
  }
}
```

## Response Fields Explained

### date_range
- `start_date`: The start date of the report (ISO format)
- `end_date`: The end date of the report (ISO format)
- `days_covered`: Number of days included in the report

### transactions
- `total_count`: Total number of transactions in the date range
- `approved_count`: Transactions approved by admin
- `pending_count`: Transactions waiting for admin approval
- `completed_count`: Transactions marked as completed
- `data`: Array of all transactions with enriched data (branch names, creator info)

### branch_snapshots
- `total_snapshots`: Total number of branch snapshots found
- `snapshots_by_branch`: Snapshots organized by branch name for easy access
- `all_snapshots`: Complete array of all snapshot records

### current_branch_balances
Current state of all branches (not filtered by date)

### statistics
- `total_commission`: Sum of all commissions from transactions in the date range
- `branch_statistics`: Activity statistics for each branch (sent/received counts, commissions)
- `transactions_per_day`: Average number of transactions per day

### summary
Quick overview of the report with key metrics

## Example Usage

### Using cURL
```bash
curl -X POST http://localhost:3000/api/admin/get-date-range-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "start_date": "01/12/24",
    "end_date": "26/12/24"
  }'
```

### Using JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:3000/api/admin/get-date-range-report', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_AUTH_TOKEN'
  },
  body: JSON.stringify({
    start_date: '01/12/24',
    end_date: '26/12/24'
  })
});

const report = await response.json();
console.log(report.data);
```

### Using Axios
```javascript
const axios = require('axios');

const getReport = async () => {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/admin/get-date-range-report',
      {
        start_date: '01/12/24',
        end_date: '26/12/24'
      },
      {
        headers: {
          'Authorization': 'Bearer YOUR_AUTH_TOKEN'
        }
      }
    );
    
    console.log('Report:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
};

getReport();
```

## Error Responses

### Missing Parameters
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Both start_date and end_date are required"
}
```

### Invalid Date Format
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Invalid start_date format. Use dd/mm/yy or ISO format"
}
```

### Invalid Date Range
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Start date must be before or equal to end date"
}
```

### Server Error
```json
{
  "statusCode": 500,
  "success": false,
  "message": "Error generating report: [error details]"
}
```

## Use Cases

1. **Monthly Reports**: Generate reports for the entire month
   ```json
   {
     "start_date": "01/12/24",
     "end_date": "31/12/24"
   }
   ```

2. **Weekly Reports**: Get data for a specific week
   ```json
   {
     "start_date": "18/12/24",
     "end_date": "24/12/24"
   }
   ```

3. **Daily Reports**: Single day analysis
   ```json
   {
     "start_date": "25/12/24",
     "end_date": "25/12/24"
   }
   ```

4. **Custom Range**: Any custom date range
   ```json
   {
     "start_date": "01/01/24",
     "end_date": "26/12/24"
   }
   ```

## Notes

- All transactions include encrypted sensitive data (points, names, mobile numbers)
- Branch snapshots are historical records created by the snapshot scheduler
- The function supports both historical snapshot data and current branch balances
- Statistics are calculated in real-time from the fetched data
- The response can be large for long date ranges with many transactions
- Consider pagination for very large datasets in production

## Performance Considerations

- For date ranges with many transactions (>1000), consider implementing pagination
- Branch snapshots are indexed by `branch_id` and `snapshot_date` for optimal performance
- The aggregation pipeline uses indexes on `createdAt` field for transactions
