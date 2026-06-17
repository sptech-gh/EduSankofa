# School Management SaaS

A comprehensive school management system built with Node.js, Express, MongoDB, and React. This system provides complete academic management, communication tools, and administrative features for educational institutions.

## 🚀 Features

### Academic Management

- **Grade Management**: Record, calculate, and track student grades with automatic percentage and letter grade calculations
- **Report Card Generation**: Automated report card creation with GPA calculations and academic summaries
- **Academic Progress Tracking**: Multi-semester progress monitoring with cumulative statistics
- **Subject Management**: Complete course management with teacher assignments and academic organization

### Communication System

- **Announcements**: School-wide announcements with target audience control and priority levels
- **Direct Messaging**: Secure messaging between teachers, parents, and administrators
- **Bulk Notifications**: Mass notification system with delivery tracking and multiple priority levels
- **Real-time Updates**: Live notifications for important updates and messages

### Additional Features

- **Attendance Management**: Track student attendance with leave request handling
- **Fee Management**: Complete fee structure management with payment tracking and invoice generation
- **User Management**: Role-based access control for admins, teachers, staff, students, and parents
- **Analytics Dashboard**: Comprehensive reporting and analytics for academic performance
- **Parent Portal**: Dedicated portal for parents to track their children's progress

## 🛠️ Technology Stack

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

### Frontend

- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling with responsive design

### Testing

- **Jest** - Testing framework
- **Supertest** - API testing
- **React Testing Library** - Component testing
- **MongoDB Memory Server** - In-memory database for testing

## 📋 Prerequisites

- Node.js 16+ and npm
- MongoDB 4.4+
- Git

## 🚀 Quick Start

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

# Edit .env with your configuration
# MONGODB_URI=mongodb://localhost:27017/school-management
# JWT_SECRET=your-super-secret-jwt-key
# PORT=5000
```

### 3. Frontend Setup

```bash
cd ../school-management-saas-frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_API_URL=http://localhost:5000" > .env
```

### 4. Start Development Servers

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

## 📁 Project Structure

```
school-management-project/
├── school-management-saas/          # Backend
│   ├── models/                      # Database models
│   │   ├── User.js
│   │   ├── Student.js
│   │   ├── Grade.js
│   │   ├── Subject.js
│   │   ├── ReportCard.js
│   │   ├── Announcement.js
│   │   ├── Message.js
│   │   ├── Notification.js
│   │   ├── Attendance.js
│   │   ├── Fee.js
│   │   └── Payment.js
│   ├── routes/                      # API routes
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── grades.js
│   │   ├── subjects.js
│   │   ├── reportCards.js
│   │   ├── announcements.js
│   │   ├── messages.js
│   │   ├── notifications.js
│   │   ├── attendance.js
│   │   ├── fees.js
│   │   └── analytics.js
│   ├── middleware/                  # Custom middleware
│   │   └── auth.js
│   ├── tests/                       # Backend tests
│   ├── server.js                    # Main server file
│   └── package.json
├── school-management-saas-frontend/ # Frontend
│   ├── src/
│   │   ├── components/              # React components
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── Dashboard.js
│   │   │   ├── EnhancedDashboard.js
│   │   │   ├── GradesManagement.js
│   │   │   ├── Messages.js
│   │   │   └── __tests__/           # Component tests
│   │   ├── pages/                   # Page components
│   │   ├── styles/                  # CSS files
│   │   ├── App.js                   # Main app component
│   │   └── index.js                 # Entry point
│   └── package.json
├── DEPLOYMENT_GUIDE.md              # Deployment instructions
├── BUGFIXES_AND_IMPROVEMENTS.md     # Known issues and solutions
└── README.md                        # This file
```

## 🔐 Authentication & Authorization

The system uses JWT-based authentication with role-based access control:

- **Admin**: Full system access
- **Staff**: Administrative functions
- **Teacher**: Grade management, messaging, attendance
- **Student**: View grades, messages, announcements
- **Parent**: View child's progress, messaging with teachers

## 📊 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Academic Management

- `GET /api/grades` - Get grades
- `POST /api/grades` - Create grade
- `PUT /api/grades/:id` - Update grade
- `DELETE /api/grades/:id` - Delete grade
- `GET /api/subjects` - Get subjects
- `POST /api/subjects` - Create subject
- `GET /api/report-cards` - Get report cards
- `POST /api/report-cards/generate` - Generate report card

### Communication

- `GET /api/announcements` - Get announcements
- `POST /api/announcements` - Create announcement
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message
- `POST /api/messages/:id/reply` - Reply to message
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Create notification

### Other Features

- `GET /api/students` - Get students
- `GET /api/attendance` - Get attendance records
- `GET /api/fees` - Get fee information
- `GET /api/analytics` - Get analytics data

## 🧪 Testing

### Backend Tests

```bash
cd school-management-saas
npm test
```

### Frontend Tests

```bash
cd school-management-saas-frontend
npm test
```

### Test Coverage

The project includes comprehensive tests for:

- API endpoints
- Database models
- Authentication middleware
- React components
- User interactions

## 🚀 Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions including:

- Traditional server deployment
- Docker deployment
- Cloud deployment (Heroku)
- Database setup and migration
- SSL configuration
- Monitoring and maintenance

## 🐛 Known Issues & Solutions

See [BUGFIXES_AND_IMPROVEMENTS.md](BUGFIXES_AND_IMPROVEMENTS.md) for:

- Common issues and their solutions
- Performance improvements
- Security enhancements
- Monitoring recommendations

## 📈 Performance Features

- **Database Indexing**: Optimized queries with compound indexes
- **Caching**: Redis caching for frequently accessed data
- **Pagination**: Efficient data loading with pagination
- **Lazy Loading**: Component lazy loading for better performance
- **Responsive Design**: Mobile-first responsive design

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password hashing
- **Input Validation**: Comprehensive input validation and sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Cross-origin resource sharing protection
- **XSS Prevention**: Cross-site scripting protection

## 🎨 UI/UX Features

- **Modern Design**: Clean, professional interface
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Dark/Light Theme**: Theme support (configurable)
- **Accessibility**: WCAG compliant design
- **Real-time Updates**: Live notifications and updates
- **Intuitive Navigation**: User-friendly navigation system

## 📚 Documentation

### API Documentation

API documentation is available at `/api/docs` when running in development mode.

### Component Documentation

Component documentation is available in the `docs/` directory.

### Database Schema

Database schema documentation is available in `docs/database-schema.md`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Follow semantic versioning

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Backend Development**: Node.js/Express API with MongoDB
- **Frontend Development**: React with modern UI/UX
- **Testing**: Comprehensive test suite with Jest
- **DevOps**: Docker, CI/CD, and deployment automation

## 📞 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

### v1.0.0 (Current)

- Complete academic management system
- Full communication features
- User authentication and authorization
- Responsive frontend interface
- Comprehensive testing suite
- Deployment documentation

### Upcoming Features

- Mobile app (React Native)
- Advanced analytics and reporting
- Integration with external systems
- Multi-language support
- Advanced notification system

## 🌟 Acknowledgments

- MongoDB for the database solution
- React team for the frontend framework
- Express.js for the backend framework
- Jest for the testing framework
- All contributors and testers

---

**Note**: This is a production-ready school management system with comprehensive features for educational institutions. For detailed setup and deployment instructions, please refer to the respective documentation files.
