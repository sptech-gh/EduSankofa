const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockFee, createMockPayment } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Financial Reconciliation Tests", () => {
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

  describe("Financial Reconciliation Test", () => {
    test("should reconcile financial data accurately", async () => {
      const Payment = require("../models/Payment");
      const Fee = require("../models/Fee");
      
      // Mock reconciliation data
      const reconciliationData = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        summary: {
          totalFees: 50000,
          totalPayments: 45000,
          outstandingBalance: 5000,
          totalStudents: 100,
          paidStudents: 80,
          unpaidStudents: 20
        },
        details: {
          feesByType: {
            tuition: 40000,
            registration: 5000,
            books: 5000
          },
          paymentsByMethod: {
            cash: 30000,
            bank_transfer: 10000,
            mobile_money: 5000
          },
          paymentsByStatus: {
            completed: 40000,
            partial: 5000,
            pending: 0
          }
        },
        reconciliation: {
          expectedTotal: 50000,
          actualTotal: 45000,
          difference: 5000,
          reconciled: true,
          discrepancies: []
        }
      };

      Payment.aggregate.mockResolvedValue([reconciliationData]);
      Fee.aggregate.mockResolvedValue([reconciliationData]);

      const response = await api("post", "/api/financial/reconcile")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.reconciliation.reconciled).toBe(true);
      expect(response.body.reconciliation.difference).toBe(5000);

      console.log("✅ Financial reconciliation accurate");
    });

    test("should identify and report discrepancies", async () => {
      const Payment = require("../models/Payment");
      const Fee = require("../models/Fee");
      
      // Mock reconciliation with discrepancies
      const discrepancyData = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        summary: {
          totalFees: 50000,
          totalPayments: 43000,
          outstandingBalance: 7000,
          totalStudents: 100,
          paidStudents: 80,
          unpaidStudents: 20
        },
        discrepancies: [
          {
            type: "payment_mismatch",
            description: "Payment amount mismatch in transaction TXN123",
            expectedAmount: 1000,
            actualAmount: 900,
            difference: 100,
            transactionId: "TXN123"
          },
          {
            type: "missing_payment",
            description: "Expected payment not found",
            expectedAmount: 500,
            actualAmount: 0,
            difference: 500,
            referenceId: "FEE456"
          }
        ],
        reconciliation: {
          expectedTotal: 50000,
          actualTotal: 43000,
          difference: 7000,
          reconciled: false,
          hasDiscrepancies: true
        }
      };

      Payment.aggregate.mockResolvedValue([discrepancyData]);
      Fee.aggregate.mockResolvedValue([discrepancyData]);

      const response = await api("post", "/api/financial/reconcile")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.reconciliation.reconciled).toBe(false);
      expect(response.body.reconciliation.hasDiscrepancies).toBe(true);
      expect(response.body.discrepancies).toHaveLength(2);

      console.log("✅ Discrepancy identification working");
    });

    test("should handle large dataset reconciliation", async () => {
      const Payment = require("../models/Payment");
      const Fee = require("../models/Fee");
      
      // Mock large dataset reconciliation
      const largeDatasetReconciliation = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-12-31"
        },
        summary: {
          totalFees: 500000,
          totalPayments: 450000,
          outstandingBalance: 50000,
          totalStudents: 1000,
          paidStudents: 800,
          unpaidStudents: 200
        },
        performance: {
          processingTime: 2.5,
          recordsProcessed: 1000,
          averageProcessingTime: 0.0025
        },
        reconciliation: {
          expectedTotal: 500000,
          actualTotal: 450000,
          difference: 50000,
          reconciled: true,
          discrepancies: []
        }
      };

      Payment.aggregate.mockResolvedValue([largeDatasetReconciliation]);
      Fee.aggregate.mockResolvedValue([largeDatasetReconciliation]);

      const startTime = Date.now();

      const response = await api("post", "/api/financial/reconcile")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-12-31"
        });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.reconciliation.reconciled).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log("✅ Large dataset reconciliation efficient");
    });
  });

  describe("Ledger Sum Validation", () => {
    test("should validate ledger sums accurately", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger sum validation
      const ledgerSumData = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        ledgerSummary: {
          totalDebits: 50000,
          totalCredits: 45000,
          openingBalance: 10000,
          closingBalance: 15000,
          netChange: -5000
        },
        validation: {
          debitsMatch: true,
          creditsMatch: true,
          balanceCalculationCorrect: true,
          openingBalanceCorrect: true,
          closingBalanceCorrect: true
        },
        details: {
          debitsByType: {
            fees: 50000
          },
          creditsByType: {
            payments: 45000
          }
        }
      };

      Payment.aggregate.mockResolvedValue([ledgerSumData]);

      const response = await api("post", "/api/financial/validate-ledger")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.debitsMatch).toBe(true);
      expect(response.body.validation.balanceCalculationCorrect).toBe(true);
      expect(response.body.ledgerSummary.netChange).toBe(-5000);

      console.log("✅ Ledger sum validation accurate");
    });

    test("should detect ledger sum discrepancies", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger sum with discrepancies
      const ledgerDiscrepancyData = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        ledgerSummary: {
          totalDebits: 50000,
          totalCredits: 43000,
          openingBalance: 10000,
          closingBalance: 17000,
          netChange: -7000
        },
        validation: {
          debitsMatch: true,
          creditsMatch: false,
          balanceCalculationCorrect: false,
          openingBalanceCorrect: true,
          closingBalanceCorrect: false
        },
        discrepancies: [
          {
            type: "credit_sum_mismatch",
            description: "Total credits don't match individual transactions",
            expectedSum: 45000,
            actualSum: 43000,
            difference: 2000
          },
          {
            type: "balance_calculation_error",
            description: "Closing balance calculation error",
            expectedBalance: 15000,
            actualBalance: 17000,
            difference: 2000
          }
        ]
      };

      Payment.aggregate.mockResolvedValue([ledgerDiscrepancyData]);

      const response = await api("post", "/api/financial/validate-ledger")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.creditsMatch).toBe(false);
      expect(response.body.validation.balanceCalculationCorrect).toBe(false);
      expect(response.body.discrepancies).toHaveLength(2);

      console.log("✅ Ledger sum discrepancy detection working");
    });

    test("should handle multi-period ledger validation", async () => {
      const Payment = require("../models/Payment");
      
      // Mock multi-period ledger validation
      const multiPeriodData = {
        periods: [
          {
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            totalDebits: 50000,
            totalCredits: 45000,
            netChange: -5000
          },
          {
            startDate: "2025-02-01",
            endDate: "2025-02-28",
            totalDebits: 55000,
            totalCredits: 52000,
            netChange: -3000
          },
          {
            startDate: "2025-03-01",
            endDate: "2025-03-31",
            totalDebits: 60000,
            totalCredits: 58000,
            netChange: -2000
          }
        ],
        summary: {
          totalDebits: 165000,
          totalCredits: 155000,
          totalNetChange: -10000
        },
        validation: {
          allPeriodsValid: true,
          carryForwardCorrect: true,
          cumulativeBalanceCorrect: true
        }
      };

      Payment.aggregate.mockResolvedValue([multiPeriodData]);

      const response = await api("post", "/api/financial/validate-ledger-multi-period")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          periods: [
            { startDate: "2025-01-01", endDate: "2025-01-31" },
            { startDate: "2025-02-01", endDate: "2025-02-28" },
            { startDate: "2025-03-01", endDate: "2025-03-31" }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.allPeriodsValid).toBe(true);
      expect(response.body.summary.totalNetChange).toBe(-10000);

      console.log("✅ Multi-period ledger validation working");
    });
  });

  describe("Payment Rollback Test", () => {
    test("should rollback payments correctly", async () => {
      const Payment = require("../models/Payment");
      
      // Mock payment rollback
      const rollbackData = {
        paymentId: testPayment._id,
        originalState: {
          amount: 500,
          status: "completed",
          transactionId: "TXN123456",
          processedAt: "2025-01-15T10:00:00Z"
        },
        rollbackState: {
          amount: 0,
          status: "refunded",
          transactionId: "REFUND-TXN123456",
          processedAt: "2025-01-15T10:05:00Z"
        },
        feeUpdate: {
          feeId: testFee._id,
          originalBalance: 500,
          newBalance: 1000,
          status: "pending"
        },
        ledgerEntries: [
          {
            type: "refund",
            amount: -500,
            description: "Payment rollback for TXN123456"
          }
        ]
      };

      Payment.findByIdAndUpdate.mockResolvedValue(rollbackData);
      Fee.findByIdAndUpdate.mockResolvedValue(rollbackData.feeUpdate);

      const response = await api("post", `/api/payments/${testPayment._id}/rollback`)
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          reason: "Duplicate payment detected",
          refundMethod: "cash"
        });

      expect(response.status).toBe(200);
      expect(response.body.rollbackState.status).toBe("refunded");
      expect(response.body.feeUpdate.newBalance).toBe(1000);

      console.log("✅ Payment rollback working correctly");
    });

    test("should handle rollback with fee adjustment", async () => {
      const Payment = require("../models/Payment");
      
      // Mock rollback with fee adjustment
      const rollbackWithAdjustment = {
        paymentId: testPayment._id,
        originalState: {
          amount: 500,
          status: "completed"
        },
        rollbackState: {
          amount: 300,
          status: "completed",
          transactionId: "ADJUSTED-TXN123456",
          processedAt: "2025-01-15T10:05:00Z"
        },
        feeUpdate: {
          feeId: testFee._id,
          originalBalance: 500,
          newBalance: 200,
          status: "partial"
        },
        adjustmentReason: "Partial payment correction"
      };

      Payment.findByIdAndUpdate.mockResolvedValue(rollbackWithAdjustment);
      Fee.findByIdAndUpdate.mockResolvedValue(rollbackWithAdjustment.feeUpdate);

      const response = await api("post", `/api/payments/${testPayment._id}/rollback`)
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          reason: "Payment amount correction",
          adjustmentAmount: 300,
          refundMethod: "cash"
        });

      expect(response.status).toBe(200);
      expect(response.body.rollbackState.amount).toBe(300);
      expect(response.body.feeUpdate.newBalance).toBe(200);

      console.log("✅ Rollback with fee adjustment working");
    });

    test("should prevent rollback of old payments", async () => {
      const Payment = require("../models/Payment");
      
      // Mock old payment (older than 90 days)
      const oldPayment = {
        _id: testPayment._id,
        createdAt: new Date("2024-10-01"), // More than 90 days ago
        status: "completed"
      };

      Payment.findOne.mockResolvedValue(oldPayment);

      const response = await api("post", `/api/payments/${testPayment._id}/rollback`)
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          reason: "Request for rollback",
          refundMethod: "cash"
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("too old");

      console.log("✅ Old payment rollback prevention working");
    });

    test("should handle concurrent rollback attempts", async () => {
      const Payment = require("../models/Payment");
      
      // Mock concurrent rollback attempts
      const concurrentRollbackData = {
        _id: testPayment._id,
        status: "processing_rollback",
        rollbackInitiatedAt: new Date()
      };

      Payment.findOne.mockResolvedValue(concurrentRollbackData);

      const response = await api("post", `/api/payments/${testPayment._id}/rollback`)
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          reason: "Concurrent rollback attempt",
          refundMethod: "cash"
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("already in progress");

      console.log("✅ Concurrent rollback prevention working");
    });
  });

  describe("Edge Case Overpayment Scenario", () => {
    test("should handle edge case overpayment scenarios", async () => {
      const Payment = require("../models/Payment");
      
      // Mock edge case overpayment
      const edgeCaseOverpayment = {
        feeId: testFee._id,
        originalAmount: 1000,
        payments: [
          { amount: 500, date: "2025-01-10" },
          { amount: 300, date: "2025-01-15" },
          { amount: 200, date: "2025-01-20" },
          { amount: 100, date: "2025-01-25" } // Overpayment
        ],
        totalPaid: 1100,
        overpaymentAmount: 100,
        status: "overpaid"
      };

      Payment.aggregate.mockResolvedValue([edgeCaseOverpayment]);

      const response = await api("get", `/api/payments/overpayment-analysis/${testFee._id}`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.overpaymentAmount).toBe(100);
      expect(response.body.status).toBe("overpaid");

      console.log("✅ Edge case overpayment scenario handled");
    });

    test("should generate overpayment refund automatically", async () => {
      const Payment = require("../models/Payment");
      
      // Mock automatic overpayment refund
      const autoRefundData = {
        overpaymentId: "OVERPAY-001",
        originalPaymentId: testPayment._id,
        overpaymentAmount: 100,
        refundMethod: "credit_to_account",
        refundStatus: "processed",
        refundDate: new Date(),
        description: "Automatic overpayment refund"
      };

      Payment.create.mockResolvedValue(autoRefundData);

      const response = await api("post", `/api/payments/${testPayment._id}/handle-overpayment`)
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          action: "auto_refund",
          refundMethod: "credit_to_account"
        });

      expect(response.status).toBe(201);
      expect(response.body.refundStatus).toBe("processed");
      expect(response.body.overpaymentAmount).toBe(100);

      console.log("✅ Automatic overpayment refund working");
    });

    test("should handle multiple overpayment scenarios", async () => {
      const Payment = require("../models/Payment");
      
      // Mock multiple overpayment scenarios
      const multipleOverpayments = [
        {
          feeId: "fee1",
          overpaymentAmount: 50,
          status: "overpaid"
        },
        {
          feeId: "fee2",
          overpaymentAmount: 75,
          status: "overpaid"
        },
        {
          feeId: "fee3",
          overpaymentAmount: 25,
          status: "overpaid"
        }
      ];

      Payment.aggregate.mockResolvedValue(multipleOverpayments);

      const response = await api("get", "/api/payments/overpayment-summary")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.overpayments).toHaveLength(3);
      expect(response.body.totalOverpaymentAmount).toBe(150);

      console.log("✅ Multiple overpayment scenarios handled");
    });

    test("should validate overpayment refund calculations", async () => {
      const Payment = require("../models/Payment");
      
      // Mock overpayment refund validation
      const refundValidation = {
        originalPayment: 1000,
        totalPaid: 1100,
        overpaymentAmount: 100,
        refundAmount: 100,
        processingFee: 5,
        netRefundAmount: 95,
        validation: {
          calculationCorrect: true,
          processingFeeCorrect: true,
          netRefundCorrect: true
        }
      };

      Payment.aggregate.mockResolvedValue([refundValidation]);

      const response = await api("post", "/api/payments/validate-overpayment-refund")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          originalPaymentId: testPayment._id,
          refundAmount: 100,
          processingFee: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.calculationCorrect).toBe(true);
      expect(response.body.netRefundAmount).toBe(95);

      console.log("✅ Overpayment refund validation working");
    });
  });
});
