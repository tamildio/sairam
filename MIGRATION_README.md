# Migration to Local Database

This app has been migrated from Supabase to a local SQLite database for complete independence.

## What Changed

### ✅ Removed Dependencies
- `@supabase/supabase-js` - No longer needed
- All Supabase configuration files
- Supabase Edge Functions

### ✅ Added Local Backend
- **SQLite Database**: File-based database (`server/data/rent_receipts.db`)
- **Express.js Server**: REST API server on port 3001
- **JWT Authentication**: Simple password-based auth
- **CORS Support**: Configured for local development

### ✅ Updated API Layer
- All API calls now use local REST endpoints
- Same interface maintained - no frontend changes needed
- Authentication flow preserved

## How to Run

### Development Mode (Recommended)
```bash
npm run dev
```
This starts both the backend server and frontend client simultaneously.

### Manual Mode
```bash
# Terminal 1 - Start backend server
npm run server

# Terminal 2 - Start frontend client  
npm run client
```

### Production Mode
```bash
# Build frontend
npm run build

# Start backend server
npm start
```

## Configuration

### Default Settings
- **Backend URL**: `http://localhost:3001`
- **Admin Password**: `admin123`
- **Database**: `server/data/rent_receipts.db`

### Environment Variables
You can override defaults by setting:
- `VITE_API_URL` - Frontend API URL
- `PORT` - Backend server port
- `ADMIN_PASSWORD` - Admin login password
- `JWT_SECRET` - JWT signing secret

## Database Schema

The SQLite database maintains the same schema as the original Supabase setup:

```sql
CREATE TABLE rent_receipts (
  id TEXT PRIMARY KEY,
  receipt_date TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  eb_reading_last_month REAL NOT NULL,
  eb_reading_this_month REAL NOT NULL,
  eb_rate_per_unit REAL NOT NULL,
  units_consumed REAL NOT NULL,
  eb_charges REAL NOT NULL,
  rent_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  received_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## API Endpoints

- `POST /api/auth/login` - Authenticate with password
- `GET /api/receipts` - List receipts (with optional filters)
- `POST /api/receipts` - Create new receipt
- `PUT /api/receipts/:id` - Update receipt
- `DELETE /api/receipts/:id` - Delete receipt
- `GET /health` - Health check

## Benefits of Migration

1. **Complete Independence**: No external dependencies
2. **Faster Development**: No network latency
3. **Offline Capability**: Works without internet
4. **Easy Deployment**: Single codebase with embedded database
5. **Cost Effective**: No cloud service costs
6. **Data Ownership**: Complete control over your data

## Data Migration

If you have existing data in Supabase, you can export it and import it into the SQLite database using the provided schema.

## Security Notes

- Change the default admin password in production
- Use a strong JWT secret in production
- Consider adding HTTPS for production deployments
- The database file is stored locally - ensure proper backups

## Troubleshooting

### Server Won't Start
- Check if port 3001 is available
- Ensure Node.js is installed
- Check server logs for errors

### Frontend Can't Connect
- Verify backend server is running on port 3001
- Check CORS configuration
- Verify API URL in environment variables

### Database Issues
- Check file permissions for `server/data/` directory
- Ensure SQLite is properly installed
- Verify database file is not corrupted

