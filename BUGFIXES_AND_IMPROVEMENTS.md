# Bug Fixes and Improvements

## Known Issues and Their Solutions

### 1. MongoDB Connection Issues

#### Issue

MongoDB connection timeouts and failures during server startup.

#### Solution

```javascript
// In server.js, update the MongoDB connection options:
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI ||
          "mongodb://localhost:27017/school-management",
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
          retryWrites: true,
          retryReads: true,
        }
      );
      console.log("MongoDB connected");
    }
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Retry connection after delay instead of exiting
    setTimeout(connectDB, 5000);
  }
};
```

### 2. Authentication Token Issues

#### Issue

JWT tokens not being properly validated or expired tokens causing errors.

#### Solution

```javascript
// In middleware/auth.js, add better error handling and token validation:
const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check token expiration explicitly
      if (Date.now() >= decoded.exp * 1000) {
        return res.status(401).json({
          message: "Token has expired",
          code: "TOKEN_EXPIRED",
        });
      }

      req.user = decoded;
      next();
    } catch (err) {
      if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
          message: "Invalid token",
          code: "INVALID_TOKEN",
        });
      }
      throw err;
    }
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};
```

### 3. Race Conditions in Grade Updates

#### Issue

Concurrent grade updates causing data inconsistency.

#### Solution

```javascript
// In routes/grades.js, add optimistic locking:
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "teacher", "staff"),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { version } = await Grade.findById(req.params.id);
      const grade = await Grade.findOneAndUpdate(
        { _id: req.params.id, version },
        { ...req.body, version: version + 1 },
        { new: true, session }
      );

      if (!grade) {
        await session.abortTransaction();
        return res.status(409).json({
          message:
            "Grade was updated by another user. Please refresh and try again.",
          code: "CONCURRENT_UPDATE",
        });
      }

      await session.commitTransaction();
      res.json(grade);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
);
```

### 4. Frontend Performance Issues

#### Issue

Slow component rendering and memory leaks.

#### Solution

```javascript
// In components with large lists (like GradesManagement.js), add virtualization:
import { FixedSizeList as List } from "react-window";

// Replace table with virtualized list
const GradesList = ({ grades }) => {
  const Row = ({ index, style }) => {
    const grade = grades[index];
    return (
      <div style={style} className="grade-row">
        {/* Grade row content */}
      </div>
    );
  };

  return (
    <List height={400} itemCount={grades.length} itemSize={50} width="100%">
      {Row}
    </List>
  );
};

// Add proper cleanup in useEffect hooks
useEffect(() => {
  let mounted = true;

  const fetchData = async () => {
    try {
      const data = await fetchGrades();
      if (mounted) {
        setGrades(data);
      }
    } catch (err) {
      if (mounted) {
        setError(err.message);
      }
    }
  };

  fetchData();

  return () => {
    mounted = false;
  };
}, []);
```

### 5. Form Submission Issues

#### Issue

Multiple form submissions and validation errors.

#### Solution

```javascript
// In components with forms, add submission protection:
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  setIsSubmitting(true);
  setError("");

  try {
    await submitForm(formData);
    onSuccess();
  } catch (err) {
    setError(err.message);
  } finally {
    setIsSubmitting(false);
  }
};

// Add form validation
const validateForm = (data) => {
  const errors = {};

  if (!data.score || data.score < 0) {
    errors.score = "Score must be a positive number";
  }

  if (!data.maxScore || data.maxScore < data.score) {
    errors.maxScore = "Max score must be greater than score";
  }

  return errors;
};
```

### 6. API Error Handling

#### Issue

Inconsistent error responses and poor error handling.

#### Solution

```javascript
// Create a custom error handler middleware
// In middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation Error",
      errors: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
      code: "VALIDATION_ERROR",
    });
  }

  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate Entry",
      field: Object.keys(err.keyValue)[0],
      code: "DUPLICATE_ERROR",
    });
  }

  res.status(500).json({
    message: "Internal Server Error",
    code: "SERVER_ERROR",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// Add to server.js
app.use(errorHandler);
```

### 7. File Upload Issues

#### Issue

Large file uploads causing timeouts and memory issues.

#### Solution

```javascript
// In routes that handle file uploads, add streaming and chunking:
const multer = require("multer");
const { createWriteStream } = require("fs");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const { file } = req;
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = `uploads/${fileName}`;

    await new Promise((resolve, reject) => {
      const writeStream = createWriteStream(filePath);
      writeStream.write(file.buffer);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      writeStream.end();
    });

    res.json({ fileName, path: filePath });
  } catch (err) {
    next(err);
  }
});
```

### 8. Real-time Updates

#### Issue

Users not seeing updates in real-time.

#### Solution

```javascript
// Add WebSocket support for real-time updates
// In server.js
const WebSocket = require("ws");
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    // Handle different message types
    switch (data.type) {
      case "SUBSCRIBE_GRADES":
        // Subscribe to grade updates
        break;
      case "SUBSCRIBE_MESSAGES":
        // Subscribe to new messages
        break;
    }
  });
});

// In frontend components
const useWebSocket = () => {
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5000");
    setWs(socket);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle updates
    };

    return () => {
      socket.close();
    };
  }, []);

  return ws;
};
```

## Performance Improvements

### 1. Database Indexing

```javascript
// Add compound indexes for frequently queried fields
const gradeSchema = new mongoose.Schema({
  // ... schema fields
});

gradeSchema.index({ student: 1, subject: 1, createdAt: -1 });
gradeSchema.index({ teacher: 1, status: 1 });
gradeSchema.index({ subject: 1, academicYear: 1, semester: 1 });
```

### 2. API Response Caching

```javascript
// Add Redis caching for frequently accessed data
const Redis = require("ioredis");
const redis = new Redis();

const cacheMiddleware =
  (key, expiry = 3600) =>
  async (req, res, next) => {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      res.sendResponse = res.json;
      res.json = (body) => {
        redis.setex(key, expiry, JSON.stringify(body));
        res.sendResponse(body);
      };
      next();
    } catch (err) {
      next(err);
    }
  };
```

### 3. Frontend Optimization

```javascript
// Add lazy loading for routes
const GradesManagement = React.lazy(() =>
  import("./components/GradesManagement")
);
const Messages = React.lazy(() => import("./components/Messages"));

// Add Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Route path="/grades" element={<GradesManagement />} />
</Suspense>;

// Add memoization for expensive calculations
const MemoizedGradesList = React.memo(({ grades }) => {
  // Component logic
});
```

## Security Improvements

### 1. Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

### 2. Input Sanitization

```javascript
const sanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

app.use(sanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks
```

### 3. Enhanced Password Security

```javascript
// Add password complexity requirements
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
};
```

## Testing Improvements

### 1. Integration Tests

```javascript
// Add integration tests for critical flows
describe("Grade Management Flow", () => {
  it("should create, update, and delete a grade", async () => {
    // Test complete grade lifecycle
  });
});
```

### 2. Load Testing

```javascript
// Add k6 load testing script
export default function () {
  const url = "http://localhost:5000";

  group("API endpoints", () => {
    // Test various endpoints under load
  });
}
```

## Monitoring Improvements

### 1. Application Logging

```javascript
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});
```

### 2. Performance Monitoring

```javascript
const responseTime = require("response-time");

app.use(
  responseTime((req, res, time) => {
    logger.info({
      method: req.method,
      url: req.url,
      responseTime: time,
    });
  })
);
```

These improvements should be implemented gradually and tested thoroughly in a staging environment before deploying to production.
