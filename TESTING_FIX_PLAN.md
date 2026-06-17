# Testing Fix Plan - School Management System

## Current Status Summary

### Frontend Tests: **CRITICAL FAILURES**

- **11 failed, 1 passed** test suites
- **40 failed, 16 passed** individual tests
- **36.61%** code coverage

### Backend Tests: **DATABASE CONNECTION ISSUES**

- **MongoDB connection failures** (ECONNREFUSED)
- **Missing model dependencies** (Class model - FIXED)
- Tests timing out due to database issues

## Immediate Fixes Required

### 1. Backend Database Setup (CRITICAL)

#### Install and Start MongoDB

```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify MongoDB is running
sudo systemctl status mongodb
```

#### Alternative: Use MongoDB Memory Server for Tests

```bash
cd school-management-saas
npm install --save-dev mongodb-memory-server
```

### 2. Frontend Test Infrastructure Fixes (CRITICAL)

#### Fix Router Context Issues

Create test utilities file:

```javascript
// school-management-saas-frontend/src/test-utils.js
import React from "react";
import { render } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

export const renderWithRouter = (ui, options = {}) => {
  const Wrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

  return render(ui, { wrapper: Wrapper, ...options });
};

export * from "@testing-library/react";
```

#### Fix Form Label Associations

Update components to include proper label associations:

```javascript
// Example fix for Login component
<label htmlFor="email">Email:</label>
<input
  id="email"
  name="email"
  type="email"
  value={formData.email}
  onChange={handleChange}
  required
/>
```

### 3. Standardize API Mocking

#### Update setupTests.js

```javascript
// school-management-saas-frontend/src/setupTests.js
import "@testing-library/jest-dom";

// Mock axios consistently
jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Mock React Router hooks
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});
```

## Step-by-Step Implementation

### Phase 1: Database Setup (Day 1)

1. **Install MongoDB**

   ```bash
   sudo apt update
   sudo apt install -y mongodb
   sudo systemctl start mongodb
   ```

2. **Verify Connection**

   ```bash
   cd school-management-saas
   node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/school-management-test').then(() => console.log('Connected')).catch(err => console.error(err));"
   ```

3. **Run Backend Tests**
   ```bash
   cd school-management-saas
   npm test
   ```

### Phase 2: Frontend Test Infrastructure (Day 1-2)

1. **Create Test Utilities**

   ```bash
   cd school-management-saas-frontend/src
   # Create test-utils.js file (content above)
   ```

2. **Fix Component Label Associations**

   - Update Login.js
   - Update LoginPage.js
   - Update Register.js
   - Update all form components

3. **Update Test Files**
   - Replace `render()` with `renderWithRouter()`
   - Fix label queries to use proper selectors
   - Update axios mocking

### Phase 3: Component Fixes (Day 2-3)

1. **Fix Login Components**

   ```javascript
   // Use getByRole instead of getByLabelText for problematic cases
   const emailInput = screen.getByRole("textbox", { name: /email/i });
   const passwordInput = screen.getByLabelText(/password/i);
   ```

2. **Fix Dashboard Components**

   ```javascript
   // Use more specific queries
   const announcementCount = screen.getByText("2", {
     selector: ".stat-content h3",
   });
   ```

3. **Fix ExamPage Component**
   ```javascript
   // Mock useParams properly
   jest.mock("react-router-dom", () => ({
     ...jest.requireActual("react-router-dom"),
     useParams: () => ({ id: "test-exam-id" }),
   }));
   ```

### Phase 4: Test Coverage Improvement (Day 3-5)

1. **Add Integration Tests**
2. **Improve Unit Test Coverage**
3. **Add Error Boundary Tests**
4. **Add Performance Tests**

## Specific File Fixes

### 1. Fix LoginPage.test.js

```javascript
import { renderWithRouter } from "../test-utils";

// Replace all render() calls with renderWithRouter()
// Fix label queries to use proper selectors
```

### 2. Fix Login.test.js

```javascript
// Same fixes as LoginPage.test.js
// Update axios mocking to be consistent
```

### 3. Fix EnhancedDashboard.test.js

```javascript
// Use more specific text queries
// Mock API responses properly
// Fix multiple element conflicts
```

### 4. Fix ExamPage.test.js

```javascript
// Mock useParams to provide required parameters
// Wrap component in Router context
```

## Backend Test Fixes

### 1. Update Test Database Configuration

```javascript
// tests/setup.js
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

const connect = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
};

const closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
};
```

### 2. Fix Missing Dependencies

- ✅ Class model created
- Check for other missing models
- Update import paths

## Quality Gates

### Before Merging Any Code:

1. ✅ All backend tests pass
2. ✅ Frontend test pass rate > 90%
3. ✅ Code coverage > 70%
4. ✅ No accessibility violations
5. ✅ No console errors in tests

### Success Metrics:

- **Backend**: 100% test pass rate
- **Frontend**: >90% test pass rate
- **Coverage**: >80% overall
- **Performance**: All tests complete in <30s

## Monitoring and Maintenance

### Daily Checks:

1. Run full test suite
2. Check coverage reports
3. Monitor test performance
4. Review failed tests

### Weekly Tasks:

1. Add tests for new features
2. Refactor flaky tests
3. Update test documentation
4. Review test coverage gaps

## Emergency Rollback Plan

If fixes break existing functionality:

1. **Revert to last working commit**

   ```bash
   git revert HEAD
   ```

2. **Isolate problematic changes**

   ```bash
   git bisect start
   ```

3. **Apply fixes incrementally**
   - Fix one component at a time
   - Test after each change
   - Commit working fixes

## Resources and Documentation

### Testing Best Practices:

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)

### Code Quality Tools:

- ESLint for code quality
- Prettier for formatting
- Husky for pre-commit hooks
- Jest for testing

---

**Next Action**: Start with Phase 1 (Database Setup) immediately.
**Timeline**: Complete all phases within 5 days.
**Priority**: Fix database connection first, then frontend infrastructure.
