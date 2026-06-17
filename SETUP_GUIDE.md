# School Management SaaS - Setup Guide

This guide will help you set up the School Management SaaS application on your local development environment.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **MongoDB** (version 4.4 or higher)
- **Git**

### Installing Prerequisites

#### Node.js and npm

1. Visit [nodejs.org](https://nodejs.org/)
2. Download and install the LTS version
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### MongoDB

1. Visit [mongodb.com](https://www.mongodb.com/try/download/community)
2. Download and install MongoDB Community Edition
3. Start MongoDB service:

   ```bash
   # On macOS with Homebrew
   brew services start mongodb-community

   # On Ubuntu/Debian
   sudo systemctl start mongod

   # On Windows
   net start MongoDB
   ```

## Quick Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd school-management-project
```

### 2. Backend Setup

```bash
cd school-management-saas

# Run the automated setup script
npm run setup

# Or manual setup:
# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Edit .env file with your configuration
nano .env
```

### 3. Frontend Setup

```bash
cd ../school-management-saas-frontend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Edit .env file with your configuration
nano .env
```

### 4. Start the Application

#### Terminal 1 - Backend

```bash
cd school-management-saas
npm run dev
```

#### Terminal 2 - Frontend

```bash
cd school-management-saas-frontend
npm start
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Detailed Setup

### Environment Configuration

#### Backend (.env)

```env
# Database
MONGODB_URI=mongodb://localhost:27017/school-management

# JWT Secret (generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server
PORT=5000
NODE_ENV=development

# Security
BCRYPT_ROUNDS=12
```

#### Frontend (.env)

```env
# API Configuration
REACT_APP_API_URL=http://localhost:5000

# Feature Flags
REACT_APP_ENABLE_DARK_MODE=true
REACT_APP_ENABLE_NOTIFICATIONS=true
```

### Database Setup

1. **Start MongoDB**:

   ```bash
   mongod
   ```

2. **Create Database** (optional - will be created automatically):

   ```bash
   mongo
   use school-management
   ```

3. **Verify Connection**:
   The application will automatically connect to MongoDB when started.

### Running Tests

#### Backend Tests

```bash
cd school-management-saas
npm test
npm run test:coverage
```

#### Frontend Tests

```bash
cd school-management-saas-frontend
npm test
npm run test:coverage
```

## Development Workflow

### Code Quality

#### Backend

```bash
# Linting
npm run lint
npm run lint:fix

# Testing
npm run test:watch
```

#### Frontend

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Testing
npm test
```

### Git Hooks

The project includes pre-commit hooks that will:

- Run ESLint and fix issues
- Format code with Prettier
- Run tests

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error

```
Error: MongoDB connection error: MongoNetworkError
```

**Solution**:

- Ensure MongoDB is running: `mongod`
- Check the connection string in `.env`
- Verify MongoDB is accessible on the specified port

#### 2. Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution**:

- Kill the process using the port: `lsof -ti:5000 | xargs kill -9`
- Or change the port in `.env` file

#### 3. JWT Secret Error

```
Error: JWT_SECRET is not defined
```

**Solution**:

- Ensure `.env` file exists in the backend directory
- Add `JWT_SECRET=your-secret-key` to the `.env` file

#### 4. CORS Error

```
Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution**:

- Verify the backend is running
- Check CORS configuration in `server.js`
- Ensure `REACT_APP_API_URL` is correctly set

#### 5. Module Not Found

```
Error: Cannot find module 'express-rate-limit'
```

**Solution**:

- Run `npm install` in the respective directory
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Performance Issues

#### Slow Database Queries

- Add database indexes for frequently queried fields
- Use pagination for large datasets
- Implement caching for static data

#### Frontend Performance

- Use React.memo for expensive components
- Implement lazy loading for routes
- Optimize bundle size with code splitting

## Production Deployment

### Environment Variables

#### Backend Production

```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db-url
JWT_SECRET=your-production-jwt-secret
PORT=5000
```

#### Frontend Production

```env
REACT_APP_API_URL=https://your-api-domain.com
REACT_APP_DEV_MODE=false
```

### Build Commands

#### Backend

```bash
npm start
```

#### Frontend

```bash
npm run build
```

### Security Checklist

- [ ] Change default JWT secret
- [ ] Use HTTPS in production
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Set up proper logging
- [ ] Configure security headers

## Additional Resources

### Documentation

- [API Documentation](./API_DOCS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

### Useful Commands

```bash
# Backend
npm run dev          # Start development server
npm test            # Run tests
npm run lint        # Check code quality
npm run setup       # Run setup script

# Frontend
npm start           # Start development server
npm run build       # Build for production
npm test            # Run tests
npm run analyze     # Analyze bundle size

# Database
mongod              # Start MongoDB
mongo               # MongoDB shell
```

### Support

If you encounter issues not covered in this guide:

1. Check the [Issues](./BUGFIXES_AND_IMPROVEMENTS.md) document
2. Review the application logs
3. Ensure all prerequisites are properly installed
4. Verify environment configuration

## Next Steps

After successful setup:

1. **Explore the Application**: Navigate through different features
2. **Review the Code**: Understand the project structure
3. **Run Tests**: Ensure everything is working correctly
4. **Read Documentation**: Familiarize yourself with the API and features
5. **Start Development**: Begin implementing new features or fixes

Happy coding! 🚀
