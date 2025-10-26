import express from 'express';
import cors from 'cors';
import { dbOperations } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Receipts endpoints
app.get('/api/receipts', async (req, res) => {
  try {
    const { limit, tenant_name } = req.query;
    
    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (tenant_name) options.tenant_name = tenant_name;
    
    const receipts = dbOperations.getReceipts(options);
    res.json({ data: receipts });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

app.post('/api/receipts', async (req, res) => {
  try {
    const receipt = req.body;
    
    // Validate required fields
    const requiredFields = [
      'receipt_date', 'tenant_name', 'eb_reading_last_month',
      'eb_reading_this_month', 'eb_rate_per_unit', 'units_consumed',
      'eb_charges', 'rent_amount', 'total_amount'
    ];
    
    for (const field of requiredFields) {
      if (receipt[field] === undefined || receipt[field] === null) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    const newReceipt = dbOperations.insertReceipt(receipt);
    res.json({ data: newReceipt });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
});

app.put('/api/receipts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedReceipt = dbOperations.updateReceipt(id, updates);
    res.json({ data: updatedReceipt });
  } catch (error) {
    console.error('Error updating receipt:', error);
    if (error.message === 'Receipt not found') {
      res.status(404).json({ error: 'Receipt not found' });
    } else {
      res.status(500).json({ error: 'Failed to update receipt' });
    }
  }
});

app.delete('/api/receipts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = dbOperations.deleteReceipt(id);
    res.json({ data: result });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    if (error.message === 'Receipt not found') {
      res.status(404).json({ error: 'Receipt not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete receipt' });
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database initialized successfully`);
});

export default app;
