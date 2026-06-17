const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockFee, createMockPayment } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Financial Discrepancy Fixes Tests", () => {
  let adminToken, accountantToken;
  let testStudent, testFee, testPayment;

  beforeAll(async () => {
    server = app.listen(0);
    server.on("connection", (socket) => {
      sockets.add(socket);
      if (typeof socket.unref === "function") {
        socket.unref();
      }
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise((resolve) => server.once("listening", resolve));

    server.keepAliveTimeout = 1;
    server.headersTimeout = 2;

    if (typeof server.unref === "function") {
      server.unref();
    }

    // Create test data
    testStudent = createMockStudent();
    testFee = createMockFee();
    testPayment = createMockPayment();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create mock users
    const adminUser = createMockUser({ role: "admin" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      return Promise.resolve(null);
    });

    // Get tokens
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    accountantToken = responses[1].body.token;
  });

  describe("Fee Structure Discrepancy Fixes", () => {
    test("should fix fee structure calculation errors", async () => {
      const Fee = require("../models/Fee");
      
      // Mock fee structure with calculation error
      const feeStructureWithError = {
        class: "class1",
        academicYear: "2025-2026",
        term: "First Term",
        fees: [
          {
            feeType: "tuition",
            amount: 1000,
            description: "Annual tuition"
          },
          {
            feeType: "books",
            amount: 200,
            description: "Textbook fee"
          }
        ],
        totalAmount: 1100, // Incorrect - should be 1200
        calculationError: true
      };

      Fee.findOne.mockResolvedValue(feeStructureWithError);
      Fee.findByIdAndUpdate.mockResolvedValue({
        ...feeStructureWithError,
        totalAmount: 1200, // Fixed
        calculationError: false,
        lastCalculated: new Date()
      });

      const response = await api("post", "/api/fees/fix-calculation")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          feeStructureId: "fee123",
          recalculate: true
        });

      expect(response.status).toBe(200);
      expect(response.body.totalAmount).toBe(1200);
      expect(response.body.calculationError).toBe(false);

      console.log("✅ Fee structure calculation error fixed");
    });

    test("should fix fee amount validation errors", async () => {
      const Fee = require("../models/Fee");
      
      // Mock fee amount validation error
      const feeAmountError = {
        _id: "fee123",
        feeType: "tuition",
        amount: -500, // Invalid negative amount
        validationError: "negative_amount"
      };

      Fee.findOne.mockResolvedValue(feeAmountError);
      Fee.findByIdAndUpdate.mockResolvedValue({
        ...feeAmountError,
        amount: 500, // Fixed
        validationError: null,
        lastValidated: new Date()
      });

      const response = await api("post", "/api/fees/fix-validation")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          feeId: "fee123",
          correctionType: "amount_validation"
        });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(500);
      expect(response.body.validationError).toBe(null);

      console.log("✅ Fee amount validation error fixed");
    });

    test("should fix duplicate fee structure entries", async () => {
      const Fee = require("../models/Fee");
      
      // Mock duplicate fee entries
      const duplicateFees = [
        {
          _id: "fee123",
          student: testStudent._id,
          feeType: "tuition",
          amount: 1000,
          term: "First Term",
          duplicate: true
        },
        {
          _id: "fee124",
          student: testStudent._id,
          feeType: "tuition",
          amount: 1000,
          term: "First Term",
          duplicate: true
        }
      ];

      Fee.find.mockResolvedValue(duplicateFees);
      Fee.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await api("post", "/api/fees/fix-duplicates")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          term: "First Term",
          feeType: "tuition"
        });

      expect(response.status).toBe(200);
      expect(response.body.duplicatesRemoved).toBe(1);
      expect(response.body.remainingFees).toBe(1);

      console.log("✅ Duplicate fee structure entries fixed");
    });
  });

  describe("Ledger Balance Discrepancy Fixes", () => {
    test("should fix ledger balance calculation errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger balance calculation error
      const ledgerBalanceError = {
        student: testStudent._id,
        openingBalance: 1000,
        totalDebits: 5000,
        totalCredits: 3000,
        expectedClosingBalance: 3000,
        actualClosingBalance: 2800, // Incorrect calculation
        balanceError: 200,
        calculationError: true
      };

      Payment.aggregate.mockResolvedValue([ledgerBalanceError]);
      Payment.updateMany.mockResolvedValue({
        modifiedCount: 1,
        correctedBalance: 3000
      });

      const response = await api("post", "/api/payments/fix-ledger-balance")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          recalculate: true
        });

      expect(response.status).toBe(200);
      expect(response.body.correctedBalance).toBe(3000);
      expect(response.body.balanceError).toBe(0);

      console.log("✅ Ledger balance calculation error fixed");
    });

    test("should fix missing ledger entries", async () => {
      const Payment = require("../models/Payment");
      
      // Mock missing ledger entries
      const missingLedgerEntries = {
        student: testStudent._id,
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        expectedTransactions: [
          { type: "fee", amount: 1000, date: "2025-01-01" },
          { type: "payment", amount: -500, date: "2025-01-15" },
          { type: "payment", amount: -300, date: "2025-01-20" }
        ],
        actualTransactions: [
          { type: "fee", amount: 1000, date: "2025-01-01" },
          { type: "payment", amount: -500, date: "2025-01-15" }
          // Missing payment of 300
        ],
        missingTransactions: [
          { type: "payment", amount: -300, date: "2025-01-20" }
        ]
      };

      Payment.aggregate.mockResolvedValue([missingLedgerEntries]);
      Payment.insertMany.mockResolvedValue({
        insertedCount: 1,
        insertedTransactions: missingLedgerEntries.missingTransactions
      });

      const response = await api("post", "/api/payments/fix-missing-entries")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          period: {
            startDate: "2025-01-01",
            endDate: "2025-01-31"
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.insertedCount).toBe(1);
      expect(response.body.missingTransactions).toHaveLength(1);

      console.log("✅ Missing ledger entries fixed");
    });

    test("should fix transaction reference errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock transaction reference errors
      const transactionReferenceErrors = [
        {
          _id: "payment123",
          transactionId: "TXN123",
          feeId: null, // Missing reference
          studentId: testStudent._id,
          referenceError: "missing_fee_reference"
        },
        {
          _id: "payment124",
          transactionId: "TXN124",
          feeId: "invalid_fee_id", // Invalid reference
          studentId: testStudent._id,
          referenceError: "invalid_fee_reference"
        }
      ];

      Payment.find.mockResolvedValue(transactionReferenceErrors);
      Payment.updateMany.mockResolvedValue({
        modifiedCount: 2,
        correctedReferences: [
          { paymentId: "payment123", feeId: "fee123" },
          { paymentId: "payment124", feeId: "fee124" }
        ]
      });

      const response = await api("post", "/api/payments/fix-references")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          paymentIds: ["payment123", "payment124"]
        });

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(2);

      console.log("✅ Transaction reference errors fixed");
    });
  });

  describe("Payment Processing Discrepancy Fixes", () => {
    test("should fix payment status inconsistencies", async () => {
      const Payment = require("../models/Payment");
      
      // Mock payment status inconsistencies
      const paymentStatusErrors = [
        {
          _id: "payment123",
          amount: 500,
          feeId: "fee123",
          status: "completed",
          feeStatus: "pending", // Inconsistent
          statusError: "payment_fee_status_mismatch"
        },
        {
          _id: "payment124",
          amount: 300,
          feeId: "fee124",
          status: "partial",
          feeStatus: "completed", // Inconsistent
          statusError: "payment_fee_status_mismatch"
        }
      ];

      Payment.find.mockResolvedValue(paymentStatusErrors);
      Payment.updateMany.mockResolvedValue({
        modifiedCount: 2,
        correctedStatuses: [
          { paymentId: "payment123", feeStatus: "completed" },
          { paymentId: "payment124", feeStatus: "partial" }
        ]
      });

      const response = await api("post", "/api/payments/fix-status-inconsistencies")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          paymentIds: ["payment123", "payment124"]
        });

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(2);

      console.log("✅ Payment status inconsistencies fixed");
    });

    test("should fix payment amount calculation errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock payment amount calculation errors
      const paymentAmountErrors = [
        {
          _id: "payment125",
          originalAmount: 500,
          processingFee: 25,
          netAmount: 475, // Correct
          recordedAmount: 450, // Incorrect
          amountError: 25,
          calculationError: true
        }
      ];

      Payment.find.mockResolvedValue(paymentAmountErrors);
      Payment.findByIdAndUpdate.mockResolvedValue({
        ...paymentAmountErrors[0],
        recordedAmount: 475,
        amountError: 0,
        calculationError: false,
        lastCorrected: new Date()
      });

      const response = await api("post", "/api/payments/fix-amount-errors")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          paymentId: "payment125",
          recalculate: true
        });

      expect(response.status).toBe(200);
      expect(response.body.recordedAmount).toBe(475);
      expect(response.body.amountError).toBe(0);

      console.log("✅ Payment amount calculation errors fixed");
    });

    test("should fix duplicate payment records", async () => {
      const Payment = require("../models/Payment");
      
      // Mock duplicate payment records
      const duplicatePayments = [
        {
          _id: "payment126",
          transactionId: "TXN126",
          amount: 500,
          status: "completed",
          duplicate: true
        },
        {
          _id: "payment127",
          transactionId: "TXN126",
          amount: 500,
          status: "completed",
          duplicate: true
        }
      ];

      Payment.find.mockResolvedValue(duplicatePayments);
      Payment.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const response = await api("post", "/api/payments/fix-duplicates")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          transactionId: "TXN126"
        });

      expect(response.status).toBe(200);
      expect(response.body.duplicatesRemoved).toBe(1);

      console.log("✅ Duplicate payment records fixed");
    });
  });

  describe("Revenue Reporting Discrepancy Fixes", () => {
    test("should fix revenue calculation errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock revenue calculation error
      const revenueCalculationError = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        individualPayments: [
          { amount: 500, date: "2025-01-15" },
          { amount: 300, date: "2025-01-20" },
          { amount: 200, date: "2025-01-25" }
        ],
        calculatedTotal: 1000,
        reportedTotal: 950, // Incorrect - should be 1000
        calculationError: 50
      };

      Payment.aggregate.mockResolvedValue([revenueCalculationError]);
      Payment.updateOne.mockResolvedValue({
        reportedTotal: 1000,
        calculationError: 0,
        lastCalculated: new Date()
      });

      const response = await api("post", "/api/revenue/fix-calculation")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          period: {
            startDate: "2025-01-01",
            endDate: "2025-01-31"
          },
          recalculate: true
        });

      expect(response.status).toBe(200);
      expect(response.body.reportedTotal).toBe(1000);
      expect(response.body.calculationError).toBe(0);

      console.log("✅ Revenue calculation error fixed");
    });

    test("should fix payment method categorization errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock payment method categorization error
      const categorizationError = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        paymentsByMethod: {
          cash: 3000,
          bank_transfer: 2000,
          mobile_money: 500,
          other: 500
        },
        categorizedPayments: [
          { amount: 3000, method: "cash" },
          { amount: 2000, method: "bank_transfer" },
          { amount: 500, method: "mobile_money" },
          { amount: 500, method: "check" } // Should be "other"
        ],
        categorizationError: true
      };

      Payment.aggregate.mockResolvedValue([categorizationError]);
      Payment.updateOne.mockResolvedValue({
        paymentsByMethod: {
          cash: 3000,
          bank_transfer: 2000,
          mobile_money: 500,
          other: 500
        },
        categorizationError: false,
        lastCategorized: new Date()
      });

      const response = await api("post", "/api/revenue/fix-categorization")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          period: {
            startDate: "2025-01-01",
            endDate: "2025-01-31"
          },
          recategorize: true
        });

      expect(response.status).toBe(200);
      expect(response.body.paymentsByMethod.other).toBe(500);
      expect(response.body.categorizationError).toBe(false);

      console.log("✅ Payment method categorization error fixed");
    });

    test("should fix period boundary calculation errors", async () => {
      const Payment = require("../models/Payment");
      
      // Mock period boundary calculation error
      const periodBoundaryError = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        boundaryPayments: [
          { amount: 500, date: "2024-12-31" }, // Before period
          { amount: 300, date: "2025-01-01" }, // In period
          { amount: 200, date: "2025-02-01" }  // After period
        ],
        calculatedPeriodTotal: 300,
        reportedPeriodTotal: 1000, // Incorrect - includes out-of-period payments
        boundaryError: true
      };

      Payment.aggregate.mockResolvedValue([periodBoundaryError]);
      Payment.updateOne.mockResolvedValue({
        reportedPeriodTotal: 300,
        boundaryError: false,
        lastCorrected: new Date()
      });

      const response = await api("post", "/api/revenue/fix-boundary-errors")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          period: {
            startDate: "2025-01-01",
            endDate: "2025-01-31"
          },
          enforceBoundaries: true
        });

      expect(response.status).toBe(200);
      expect(response.body.reportedPeriodTotal).toBe(300);
      expect(response.body.boundaryError).toBe(false);

      console.log("✅ Period boundary calculation error fixed");
    });
  });

  describe("Automated Discrepancy Detection and Fix", () => {
    test("should automatically detect and fix common discrepancies", async () => {
      const Payment = require("../models/Payment");
      const Fee = require("../models/Fee");
      
      // Mock comprehensive discrepancy detection
      const comprehensiveDiscrepancyCheck = {
        detectedIssues: [
          {
            type: "ledger_balance_mismatch",
            severity: "high",
            autoFixable: true,
            description: "Ledger balance doesn't match transactions"
          },
          {
            type: "payment_status_inconsistency",
            severity: "medium",
            autoFixable: true,
            description: "Payment status inconsistent with fee status"
          },
          {
            type: "revenue_calculation_error",
            severity: "low",
            autoFixable: true,
            description: "Revenue calculation error detected"
          }
        ],
        autoFixResults: {
          ledger_balance_mismatch: {
            fixed: true,
            recordsAffected: 5,
            timeTaken: 0.5
          },
          payment_status_inconsistency: {
            fixed: true,
            recordsAffected: 3,
            timeTaken: 0.3
          },
          revenue_calculation_error: {
            fixed: true,
            recordsAffected: 1,
            timeTaken: 0.2
          }
        },
        summary: {
          totalIssues: 3,
          issuesFixed: 3,
          issuesRemaining: 0,
          totalRecordsAffected: 9,
          totalTimeTaken: 1.0
        }
      };

      Payment.aggregate.mockResolvedValue([comprehensiveDiscrepancyCheck]);
      Fee.aggregate.mockResolvedValue([comprehensiveDiscrepancyCheck]);
      Payment.updateMany.mockResolvedValue({ modifiedCount: 9 });
      Fee.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const response = await api("post", "/api/financial/auto-fix-discrepancies")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          period: {
            startDate: "2025-01-01",
            endDate: "2025-01-31"
          },
          autoFix: true
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.issuesFixed).toBe(3);
      expect(response.body.summary.issuesRemaining).toBe(0);
      expect(response.body.summary.totalRecordsAffected).toBe(9);

      console.log("✅ Automated discrepancy detection and fix working");
    });

    test("should generate discrepancy fix report", async () => {
      const Payment = require("../models/Payment");
      
      // Mock discrepancy fix report generation
      const fixReport = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        fixesApplied: [
          {
            type: "ledger_balance_mismatch",
            count: 5,
            details: "Corrected ledger balance calculations"
          },
          {
            type: "payment_status_inconsistency",
            count: 3,
            details: "Synchronized payment and fee statuses"
          },
          {
            type: "revenue_calculation_error",
            count: 1,
            details: "Recalculated revenue totals"
          }
        ],
        summary: {
          totalFixes: 9,
          timeTaken: 1.0,
          successRate: 100,
          remainingIssues: 0
        },
        recommendations: [
          "Implement additional validation checks",
          "Schedule regular discrepancy audits",
          "Enhance automated monitoring"
        ]
      };

      Payment.aggregate.mockResolvedValue([fixReport]);

      const response = await api("get", "/api/financial/discrepancy-fix-report")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.fixesApplied).toHaveLength(3);
      expect(response.body.summary.totalFixes).toBe(9);
      expect(response.body.recommendations).toHaveLength(3);

      console.log("✅ Discrepancy fix report generated");
    });
  });
});
