# Supabase Integration Setup Guide

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Enter project details:
   - **Name**: `rent-bill-generator`
   - **Database Password**: (create a strong password)
   - **Region**: Choose closest to your users
5. Click "Create new project"

### 2. Get Your Credentials

Once your project is created, go to **Settings > API** and copy:
- **Project URL** (looks like: `https://your-project.supabase.co`)
- **anon/public key** (starts with `eyJ...`)

### 3. Create Database Table

In your Supabase dashboard, go to **SQL Editor** and run this query:

```sql
-- Create the rent_receipts table
CREATE TABLE rent_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_date DATE NOT NULL,
  tenant_name TEXT NOT NULL,
  eb_reading_last_month DECIMAL(10,2) NOT NULL,
  eb_reading_this_month DECIMAL(10,2) NOT NULL,
  eb_rate_per_unit DECIMAL(10,2) NOT NULL,
  units_consumed DECIMAL(10,2) NOT NULL,
  eb_charges DECIMAL(10,2) NOT NULL,
  rent_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  received_date DATE,
  payment_mode TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_rent_receipts_created_at ON rent_receipts(created_at DESC);
CREATE INDEX idx_rent_receipts_tenant_name ON rent_receipts(tenant_name);
```

### 4. Set Environment Variables

Create a `.env.local` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: Replace the values with your actual Supabase credentials!

### 5. Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Try generating a bill - it should now save to Supabase
3. Check the "Receipts" tab to see if data is retrieved from Supabase
4. Check your Supabase dashboard to see the data in the table

## 🔧 Troubleshooting

### Common Issues:

1. **"Missing Supabase environment variables" error**
   - Make sure you created `.env.local` with the correct variables
   - Restart your development server after adding environment variables

2. **"Failed to fetch receipts" error**
   - Check if your Supabase table was created correctly
   - Verify your API keys are correct
   - Check the browser console for detailed error messages

3. **Data not appearing**
   - Check if the table name is exactly `rent_receipts`
   - Verify the column names match the schema
   - Check Supabase logs in the dashboard

### Testing Database Connection:

You can test the connection by opening the browser console and running:
```javascript
// This will show your Supabase client configuration
console.log(window.supabase);
```

## 🚀 Deployment

### For Netlify:

1. Add your environment variables in Netlify dashboard:
   - Go to Site Settings > Environment Variables
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

2. Deploy your site - the database will work from any domain!

### For Vercel:

1. Add environment variables in Vercel dashboard
2. Deploy - same process as Netlify

## ✅ Benefits

- **✅ Cloud Database**: Data persists across deployments
- **✅ Real-time**: Automatic updates (if you enable subscriptions)
- **✅ Scalable**: Handles multiple users
- **✅ Secure**: Built-in authentication and security
- **✅ Backup**: Automatic backups and point-in-time recovery
- **✅ Analytics**: Built-in database analytics

## 🔄 Migration from SQLite

If you have existing data in SQLite, you can:

1. Export data from your SQLite database
2. Import to Supabase using the SQL editor
3. Or manually add a few test records to verify everything works

Your app is now ready for cloud deployment! 🎉
