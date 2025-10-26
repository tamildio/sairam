// Configuration file for the rent receipt app
// Copy this to config.js and modify as needed

module.exports = {
  // API Configuration
  API_URL: process.env.VITE_API_URL || 'http://localhost:3001',
  
  // Server Configuration
  PORT: process.env.PORT || 3001,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  
  // Database Configuration
  DATABASE_PATH: './server/data/rent_receipts.db'
};

