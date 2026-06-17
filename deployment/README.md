# Deployment Instructions for School Management SaaS

This document outlines the steps to deploy the School Management SaaS application, including backend and frontend setup.

## Backend Deployment

1. Ensure MongoDB is installed and running.
2. Configure environment variables in `.env` file:
   - `MONGODB_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `PORT`: Port for backend server (default 5000)
3. Install dependencies:
   ```
   npm install
   ```
4. Start the backend server:
   ```
   npm start
   ```
5. For production, consider using process managers like PM2.

## Frontend Deployment

1. Navigate to the frontend directory:
   ```
   cd school-management-saas-frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Build the production bundle:
   ```
   npm run build
   ```
4. Serve the static files using a web server like `serve` or integrate with backend server.

## Environment Configuration

- Use `.env` files or environment variables to configure backend and frontend.
- Ensure CORS settings allow frontend to communicate with backend.

## Testing

- Backend tests can be run with:
  ```
  npm test
  ```
- Frontend tests require additional Jest/Babel configuration for ES modules.

## Notes

- This setup assumes deployment on a Linux server.
- Adjust configurations as needed for your hosting environment.
