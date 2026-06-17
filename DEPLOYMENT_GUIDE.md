# School Management SaaS - Deployment Guide

## Overview

This guide covers the deployment of the School Management SaaS application, which consists of a Node.js/Express backend and a React frontend.

## Prerequisites

### System Requirements

- Node.js 16+ and npm
- MongoDB 4.4+
- Git
- Domain name (for production)
- SSL certificate (for production)

### Development Environment

- VS Code or similar IDE
- MongoDB Compass (optional, for database management)
- Postman (optional, for API testing)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd school-management-project
```

### 2. Backend Setup

```bash
cd school-management-saas

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

#### Environment Variables (.env)

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/school-management

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Upload Configuration
MAX_FILE_SIZE=5000000
FILE_UPLOAD_PATH=./public/uploads
```

### 3. Frontend Setup

```bash
cd ../school-management-saas-frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:5000" > .env
```

### 4. Database Setup

```bash
# Start MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Start Development Servers

#### Backend

```bash
cd school-management-saas
npm run dev
```

#### Frontend

```bash
cd school-management-saas-frontend
npm start
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### 2. Application Deployment

```bash
# Clone repository
git clone <repository-url> /var/www/school-management
cd /var/www/school-management

# Backend setup
cd school-management-saas
npm install --production
cp .env.example .env
# Edit .env with production values

# Frontend setup
cd ../school-management-saas-frontend
npm install
npm run build

# Set proper permissions
sudo chown -R www-data:www-data /var/www/school-management
```

#### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "school-management-api",
      script: "./school-management-saas/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
    },
  ],
};
```

Start the application:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Nginx Configuration

Create `/etc/nginx/sites-available/school-management`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # Frontend
    location / {
        root /var/www/school-management/school-management-saas-frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /uploads {
        root /var/www/school-management/school-management-saas/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/school-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option 2: Docker Deployment

#### 1. Backend Dockerfile

Create `school-management-saas/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

USER node

CMD ["npm", "start"]
```

#### 2. Frontend Dockerfile

Create `school-management-saas-frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 3. Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:6.0
    container_name: school-management-db
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

  backend:
    build: ./school-management-saas
    container_name: school-management-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/school-management?authSource=admin
      JWT_SECRET: your-production-jwt-secret
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
    volumes:
      - ./uploads:/app/public/uploads

  frontend:
    build: ./school-management-saas-frontend
    container_name: school-management-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongodb_data:
```

Deploy with Docker:

```bash
docker-compose up -d
```

### Option 3: Cloud Deployment (Heroku)

#### 1. Prepare for Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create applications
heroku create school-management-api
heroku create school-management-frontend
```

#### 2. Backend Deployment

```bash
cd school-management-saas

# Add MongoDB addon
heroku addons:create mongolab:sandbox -a school-management-api

# Set environment variables
heroku config:set NODE_ENV=production -a school-management-api
heroku config:set JWT_SECRET=your-production-jwt-secret -a school-management-api

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a school-management-api
git push heroku main
```

#### 3. Frontend Deployment

```bash
cd ../school-management-saas-frontend

# Update API URL
echo "REACT_APP_API_URL=https://school-management-api.herokuapp.com" > .env

# Add buildpack
heroku buildpacks:set mars/create-react-app -a school-management-frontend

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a school-management-frontend
git push heroku main
```

## Database Migration and Seeding

### 1. Create Admin User

```bash
# Connect to MongoDB
mongo school-management

# Create admin user
db.users.insertOne({
  name: "System Administrator",
  email: "admin@school.com",
  password: "$2a$10$hashed-password-here",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date()
});
```

### 2. Seed Sample Data

Create `scripts/seed.js`:

```javascript
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Subject = require("../models/Subject");

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "System Administrator",
      email: "admin@school.com",
      password: hashedPassword,
      role: "admin",
    });

    // Create sample subjects
    await Subject.create([
      {
        name: "Mathematics",
        code: "MATH101",
        credits: 3,
        academicYear: "2024",
        semester: "Fall",
      },
      {
        name: "Science",
        code: "SCI101",
        credits: 3,
        academicYear: "2024",
        semester: "Fall",
      },
      {
        name: "English",
        code: "ENG101",
        credits: 3,
        academicYear: "2024",
        semester: "Fall",
      },
    ]);

    console.log("Database seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();
```

Run seeding:

```bash
node scripts/seed.js
```

## Monitoring and Maintenance

### 1. Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart school-management-api
```

### 2. Database Backup

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --db school-management --out /backups/mongodb_$DATE
tar -czf /backups/mongodb_$DATE.tar.gz /backups/mongodb_$DATE
rm -rf /backups/mongodb_$DATE
```

### 3. SSL Certificate Renewal (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Security Considerations

### 1. Environment Security

- Use strong JWT secrets
- Enable MongoDB authentication
- Use HTTPS in production
- Implement rate limiting
- Regular security updates

### 2. Application Security

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- File upload restrictions

### 3. Server Security

- Firewall configuration
- SSH key authentication
- Regular system updates
- Fail2ban for intrusion prevention

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
sudo systemctl restart mongod
```

#### 2. Application Not Starting

```bash
# Check PM2 logs
pm2 logs school-management-api

# Check application logs
tail -f /var/www/school-management/logs/combined.log
```

#### 3. Frontend Build Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Performance Optimization

### 1. Backend Optimization

- Enable gzip compression
- Implement caching (Redis)
- Database indexing
- Connection pooling
- Load balancing

### 2. Frontend Optimization

- Code splitting
- Lazy loading
- Image optimization
- CDN usage
- Bundle analysis

## Support and Maintenance

### Regular Tasks

- [ ] Weekly database backups
- [ ] Monthly security updates
- [ ] Quarterly performance reviews
- [ ] Annual SSL certificate renewal
- [ ] Log rotation and cleanup

### Monitoring Checklist

- [ ] Application uptime
- [ ] Database performance
- [ ] Server resources
- [ ] Error rates
- [ ] User activity

For additional support, refer to the application documentation or contact the development team.
