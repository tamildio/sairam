# Rent Receipt Management App

A modern, local-first rent receipt management application built with React, TypeScript, and SQLite.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation & Running

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd home-rent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   # Option 1: Use the startup script (recommended)
   ./start.sh        # Linux/Mac
   start.bat         # Windows
   
   # Option 2: Manual start
   npm run dev       # Starts both backend and frontend
   
   # Option 3: Separate terminals
   npm run server    # Backend only
   npm run client    # Frontend only
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Default admin password: `admin123`

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **shadcn/ui** components with Tailwind CSS
- **React Router** for navigation
- **React Hook Form** for form management

### Backend
- **Express.js** REST API server
- **SQLite** database with better-sqlite3
- **JWT** authentication
- **CORS** enabled for local development

### Database
- **SQLite** file-based database (`server/data/rent_receipts.db`)
- Same schema as the original Supabase setup
- Automatic migrations and indexing

## 📊 Features

- ✅ **Receipt Management**: Create, read, update, delete rent receipts
- ✅ **Electricity Bill Tracking**: Calculate EB charges based on meter readings
- ✅ **Tenant Management**: Filter receipts by tenant name
- ✅ **Payment Recording**: Track payment dates and status
- ✅ **Receipt Preview**: Generate printable receipt previews
- ✅ **Local Storage**: Complete data independence
- ✅ **Authentication**: Simple password-based admin access

## 🔧 Configuration

### Environment Variables
- `VITE_API_URL`: Frontend API URL (default: http://localhost:3001)
- `PORT`: Backend server port (default: 3001)
- `ADMIN_PASSWORD`: Admin login password (default: admin123)
- `JWT_SECRET`: JWT signing secret (default: auto-generated)

### Database
The SQLite database is automatically created at `server/data/rent_receipts.db` on first run.

## 🛠️ Development

### Project Structure
```
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── lib/               # API and utility functions
│   ├── pages/             # Page components
│   └── hooks/             # Custom React hooks
├── server/                # Backend source code
│   ├── data/              # SQLite database files
│   ├── auth.js            # Authentication logic
│   ├── database.js        # Database operations
│   └── server.js          # Express server
└── public/                # Static assets
```

### Available Scripts
- `npm run dev` - Start both backend and frontend
- `npm run client` - Start frontend only
- `npm run server` - Start backend only
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔒 Security

- JWT-based authentication with 24-hour expiration
- Password-protected admin access
- CORS configured for local development
- SQL injection protection via prepared statements

## 📱 Usage

1. **Login**: Use the default password `admin123` or set your own via environment variables
2. **Create Receipt**: Fill out the rent receipt form with tenant and electricity bill details
3. **View History**: Browse all receipts with filtering options
4. **Update Payments**: Mark receipts as paid with payment dates
5. **Export/Print**: Generate printable receipt previews

## 🚀 Deployment

### Local Production
```bash
npm run build
npm start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Troubleshooting

### Common Issues

**Server won't start**
- Check if port 3001 is available
- Ensure Node.js is installed
- Check server logs for errors

**Frontend can't connect**
- Verify backend server is running
- Check CORS configuration
- Verify API URL in environment variables

**Database issues**
- Check file permissions for `server/data/` directory
- Ensure SQLite is properly installed
- Verify database file is not corrupted

For more help, see the [Migration Guide](MIGRATION_README.md).
