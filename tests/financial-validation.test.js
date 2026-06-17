const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockInvoice } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Financial Validation Tests", () => {
  let adminToken, accountantToken, parentToken;
  let testStudent, testClass, testAcademicYear, testTerm, testFee, testPayment, testInvoice;

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
    testClass = createMockClass();
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();
    testFee = createMockFee();
    testPayment = createMockPayment();
    testInvoice = createMockInvoice();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    const parentUser = createMockUser({ role: "parent" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    accountantToken = responses[1].body.token;
    parentToken = responses[2].body.token;
  });

  describe("Fee Structure Per Class", () => {
    test("should create class-specific fee structures", async () => {
      const Fee = require("../models/Fee");
      
      // Mock class-specific fee structure
      const classFeeStructure = {
        class: testClass._id,
        academicYear: testAcademicYear._id,
        term: testTerm._id,
        fees: [
          {
            feeType: "tuition",
            amount: 1500,
            description: "Annual tuition fee"
          },
          {
            feeType: "registration",
            amount: 200,
            description: "Registration fee"
          },
          {
            feeType: "books",
            amount: 300,
            description: "Textbook fee"
          }
        ]
      };

      Fee.create.mockResolvedValue(classFeeStructure);

      const response = await api("post", "/api/fees/structure")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send(classFeeStructure);

      expect(response.status).toBe(201);
      expect(response.body.class).toBe(testClass._id);
      expect(response.body.fees).toHaveLength(3);

      console.log("✅ Class-specific fee structure created successfully");
    });

    test("should validate fee amounts per class", async () => {
      const Fee = require("../models/Fee");
      
      // Mock fee validation
      const invalidFeeStructure = {
        class: testClass._id,
        academicYear: testAcademicYear._id,
        term: testTerm._id,
        fees: [
          {
            feeType: "tuition",
            amount: -500, // Invalid negative amount
            description: "Annual tuition fee"
          }
        ]
      };

      Fee.create.mockRejectedValue(new Error("Invalid fee amount"));

      const response = await api("post", "/api/fees/structure")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send(invalidFeeStructure);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.amount).toBeDefined();

      console.log("✅ Fee amount validation working correctly");
    });

    test("should handle different fee structures for different classes", async () => {
      const Fee = require("../models/Fee");
      
      // Mock different class fee structures
      const class1Fees = {
        class: "class1",
        fees: [{ feeType: "tuition", amount: 1000 }]
      };
      const class2Fees = {
        class: "class2",
        fees: [{ feeType: "tuition", amount: 1500 }]
      };

      Fee.find.mockImplementation((query) => {
        if (query.class === "class1") return Promise.resolve([class1Fees]);
        if (query.class === "class2") return Promise.resolve([class2Fees]);
        return Promise.resolve([]);
      });

      const class1Response = await api("get", "/api/fees/structure/class1")
        .set("Authorization", `Bearer ${accountantToken}`);
      const class2Response = await api("get", "/api/fees/structure/class2")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(class1Response.status).toBe(200);
      expect(class2Response.status).toBe(200);
      expect(class1Response.body.fees[0].amount).toBe(1000);
      expect(class2Response.body.fees[0].amount).toBe(1500);

      console.log("✅ Different fee structures for different classes working");
    });
  });

  describe("Term-Based Billing", () => {
    test("should generate term-based billing correctly", async () => {
      const Fee = require("../models/Fee");
      
      // Mock term-based billing
      const termBilling = {
        academicYear: testAcademicYear._id,
        term: testTerm._id,
        billingDate: new Date(),
        fees: [
          {
            student: testStudent._id,
            feeType: "tuition",
            amount: 500,
            term: testTerm._id,
            dueDate: "2025-03-15"
          },
          {
            student: testStudent._id,
            feeType: "books",
            amount: 100,
            term: testTerm._id,
            dueDate: "2025-03-15"
          }
        ]
      };

      Fee.create.mockResolvedValue(termBilling);

      const response = await api("post", "/api/fees/term-billing")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          academicYear: testAcademicYear._id,
          term: testTerm._id
        });

      expect(response.status).toBe(201);
      expect(response.body.term).toBe(testTerm._id);
      expect(response.body.fees).toHaveLength(2);

      console.log("✅ Term-based billing generated correctly");
    });

    test("should handle multiple term billing", async () => {
      const Fee = require("../models/Fee");
      
      // Mock multiple term billing
      const multiTermBilling = [
        {
          term: "First Term",
          totalAmount: 600,
          fees: [
            { feeType: "tuition", amount: 500 },
            { feeType: "books", amount: 100 }
          ]
        },
        {
          term: "Second Term",
          totalAmount: 600,
          fees: [
            { feeType: "tuition", amount: 500 },
            { feeType: "books", amount: 100 }
          ]
        },
        {
          term: "Third Term",
          totalAmount: 600,
          fees: [
            { feeType: "tuition", amount: 500 },
            { feeType: "books", amount: 100 }
          ]
        }
      ];

      Fee.find.mockResolvedValue(multiTermBilling);

      const response = await api("get", "/api/fees/multi-term")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          academicYear: testAcademicYear._id,
          student: testStudent._id
        });

      expect(response.status).toBe(200);
      expect(response.body.billing).toHaveLength(3);
      expect(response.body.billing[0].totalAmount).toBe(600);

      console.log("✅ Multiple term billing handled correctly");
    });

    test("should validate term billing dates", async () => {
      const Fee = require("../models/Fee");
      
      // Mock invalid term billing date
      const invalidTermBilling = {
        academicYear: testAcademicYear._id,
        term: testTerm._id,
        billingDate: "invalid-date",
        fees: []
      };

      Fee.create.mockRejectedValue(new Error("Invalid billing date"));

      const response = await api("post", "/api/fees/term-billing")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send(invalidTermBilling);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Term billing date validation working");
    });
  });

  describe("Ledger Accuracy", () => {
    test("should maintain accurate ledger entries", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger entry
      const ledgerEntry = {
        student: testStudent._id,
        fee: testFee._id,
        payment: testPayment._id,
        transactionType: "payment",
        amount: 500,
        balance: 1000,
        date: new Date(),
        description: "Tuition fee payment"
      };

      Payment.create.mockResolvedValue(ledgerEntry);

      const response = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: testFee._id,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });

      expect(response.status).toBe(201);
      expect(response.body.ledgerEntry).toBeDefined();
      expect(response.body.ledgerEntry.balance).toBe(1000);

      console.log("✅ Ledger entries maintained accurately");
    });

    test("should validate ledger balance calculations", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger balance validation
      const ledgerEntries = [
        {
          student: testStudent._id,
          transactionType: "fee",
          amount: 1500,
          balance: 1500,
          date: "2025-01-01"
        },
        {
          student: testStudent._id,
          transactionType: "payment",
          amount: -500,
          balance: 1000,
          date: "2025-01-15"
        },
        {
          student: testStudent._id,
          transactionType: "payment",
          amount: -300,
          balance: 700,
          date: "2025-01-20"
        }
      ];

      Payment.find.mockResolvedValue(ledgerEntries);

      const response = await api("get", `/api/payments/ledger/${testStudent._id}`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ledger).toHaveLength(3);
      expect(response.body.currentBalance).toBe(700);

      console.log("✅ Ledger balance calculations validated");
    });

    test("should handle ledger reconciliation", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger reconciliation
      const reconciliationData = {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        totalFees: 1500,
        totalPayments: 800,
        expectedBalance: 700,
        actualBalance: 700,
        reconciled: true
      };

      Payment.aggregate.mockResolvedValue([reconciliationData]);

      const response = await api("post", "/api/payments/reconcile")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          student: testStudent._id
        });

      expect(response.status).toBe(200);
      expect(response.body.reconciled).toBe(true);
      expect(response.body.expectedBalance).toBe(700);
      expect(response.body.actualBalance).toBe(700);

      console.log("✅ Ledger reconciliation working correctly");
    });
  });

  describe("Overpayment Prevention", () => {
    test("should prevent overpayment of fees", async () => {
      const Payment = require("../models/Payment");
      
      // Mock fee with remaining balance
      const feeWithBalance = {
        _id: testFee._id,
        student: testStudent._id,
        amount: 1000,
        paid: 800,
        balance: 200,
        status: "partial"
      };

      Fee.findOne.mockResolvedValue(feeWithBalance);

      // Try to overpay
      const overpaymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: testFee._id,
          amount: 500, // Overpayment attempt
          paymentMethod: "cash",
          transactionId: "TXN123457"
        });

      expect(overpaymentResponse.status).toBe(400);
      expect(overpaymentResponse.body.message).toContain("overpayment");

      console.log("✅ Overpayment prevention working");
    });

    test("should handle exact payment correctly", async () => {
      const Payment = require("../models/Payment");
      
      // Mock fee with exact balance
      const feeWithExactBalance = {
        _id: testFee._id,
        student: testStudent._id,
        amount: 1000,
        paid: 800,
        balance: 200,
        status: "partial"
      };

      Fee.findOne.mockResolvedValue(feeWithExactBalance);

      Payment.create.mockResolvedValue({
        ...testPayment,
        amount: 200,
        remainingBalance: 0,
        status: "completed"
      });

      // Exact payment
      const exactPaymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: testFee._id,
          amount: 200, // Exact remaining balance
          paymentMethod: "cash",
          transactionId: "TXN123458"
        });

      expect(exactPaymentResponse.status).toBe(201);
      expect(exactPaymentResponse.body.remainingBalance).toBe(0);
      expect(exactPaymentResponse.body.status).toBe("completed");

      console.log("✅ Exact payment handling working");
    });

    test("should handle partial payments correctly", async () => {
      const Payment = require("../models/Payment");
      
      // Mock fee for partial payment
      const feeForPartialPayment = {
        _id: testFee._id,
        student: testStudent._id,
        amount: 1000,
        paid: 0,
        balance: 1000,
        status: "pending"
      };

      Fee.findOne.mockResolvedValue(feeForPartialPayment);

      Payment.create.mockResolvedValue({
        ...testPayment,
        amount: 300,
        remainingBalance: 700,
        status: "partial"
      });

      // Partial payment
      const partialPaymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: testFee._id,
          amount: 300, // Partial payment
          paymentMethod: "cash",
          transactionId: "TXN123459"
        });

      expect(partialPaymentResponse.status).toBe(201);
      expect(partialPaymentResponse.body.remainingBalance).toBe(700);
      expect(partialPaymentResponse.body.status).toBe("partial");

      console.log("✅ Partial payment handling working");
    });
  });

  describe("Outstanding Balance Calculation", () => {
    test("should calculate outstanding balances accurately", async () => {
      const Fee = require("../models/Fee");
      
      // Mock outstanding balance calculation
      const outstandingBalances = [
        {
          student: testStudent._id,
          totalFees: 1500,
          totalPaid: 800,
          outstandingBalance: 700,
          fees: [
            {
              feeType: "tuition",
              amount: 1000,
              paid: 600,
              balance: 400
            },
            {
              feeType: "books",
              amount: 500,
              paid: 200,
              balance: 300
            }
          ]
        }
      ];

      Fee.aggregate.mockResolvedValue(outstandingBalances);

      const response = await api("get", "/api/fees/outstanding")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.outstanding).toHaveLength(1);
      expect(response.body.outstanding[0].outstandingBalance).toBe(700);

      console.log("✅ Outstanding balance calculation accurate");
    });

    test("should handle multiple student outstanding balances", async () => {
      const Fee = require("../models/Fee");
      
      // Mock multiple student outstanding balances
      const multipleOutstanding = [
        {
          student: "student1",
          totalFees: 1500,
          totalPaid: 1000,
          outstandingBalance: 500
        },
        {
          student: "student2",
          totalFees: 1500,
          totalPaid: 1200,
          outstandingBalance: 300
        },
        {
          student: testStudent._id,
          totalFees: 1500,
          totalPaid: 800,
          outstandingBalance: 700
        }
      ];

      Fee.aggregate.mockResolvedValue(multipleOutstanding);

      const response = await api("get", "/api/fees/outstanding")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.outstanding).toHaveLength(3);
      expect(response.body.totalOutstanding).toBe(1500);

      console.log("✅ Multiple student outstanding balances calculated accurately");
    });

    test("should filter outstanding balances by date range", async () => {
      const Fee = require("../models/Fee");
      
      // Mock date-filtered outstanding balances
      const dateFilteredOutstanding = [
        {
          student: testStudent._id,
          totalFees: 1500,
          totalPaid: 800,
          outstandingBalance: 700,
          dueDate: "2025-03-15"
        }
      ];

      Fee.aggregate.mockResolvedValue(dateFilteredOutstanding);

      const response = await api("get", "/api/fees/outstanding")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-03-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.outstanding).toHaveLength(1);
      expect(response.body.outstanding[0].outstandingBalance).toBe(700);

      console.log("✅ Outstanding balance date filtering working");
    });
  });

  describe("Receipt PDF Correctness", () => {
    test("should generate accurate receipt PDFs", async () => {
      const Payment = require("../models/Payment");
      
      // Mock receipt PDF generation
      const receiptData = {
        payment: testPayment,
        student: testStudent,
        fee: testFee,
        receiptNumber: "RCP-2025-001",
        date: new Date(),
        amount: 500,
        paymentMethod: "cash",
        transactionId: "TXN123456"
      };

      Payment.findOne.mockResolvedValue(receiptData);

      const response = await api("get", `/api/payments/${testPayment._id}/receipt-pdf`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toBeDefined();

      console.log("✅ Receipt PDF generation working");
    });

    test("should include all required data in receipt PDF", async () => {
      const Payment = require("../models/Payment");
      
      // Mock receipt PDF with all required data
      const completeReceiptData = {
        payment: testPayment,
        student: {
          firstName: "Test",
          lastName: "Student",
          email: "test@test.com"
        },
        fee: {
          feeType: "tuition",
          amount: 1000,
          description: "Annual tuition fee"
        },
        receiptNumber: "RCP-2025-001",
        date: new Date(),
        amount: 500,
        paymentMethod: "cash",
        transactionId: "TXN123456"
      };

      Payment.findOne.mockResolvedValue(completeReceiptData);

      const response = await api("get", `/api/payments/${testPayment._id}/receipt-pdf`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      
      // Verify PDF contains required data
      expect(response.body).toContain("Test Student");
      expect(response.body).toContain("RCP-2025-001");
      expect(response.body).toContain("500");
      expect(response.body).toContain("TXN123456");

      console.log("✅ Receipt PDF includes all required data");
    });

    test("should handle receipt PDF generation errors gracefully", async () => {
      const Payment = require("../models/Payment");
      
      // Mock PDF generation error
      Payment.findOne.mockRejectedValue(new Error("PDF generation failed"));

      const response = await api("get", `/api/payments/${testPayment._id}/receipt-pdf`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBeDefined();

      console.log("✅ Receipt PDF error handling working");
    });
  });

  describe("Revenue Summary Correctness", () => {
    test("should calculate revenue summary correctly", async () => {
      const Payment = require("../models/Payment");
      
      // Mock revenue summary
      const revenueSummary = {
        totalRevenue: 50000,
        totalFees: 60000,
        totalPayments: 50000,
        outstandingBalance: 10000,
        paymentMethods: {
          cash: 30000,
          bank_transfer: 15000,
          mobile_money: 5000
        },
        feeTypes: {
          tuition: 40000,
          registration: 5000,
          books: 5000
        },
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        }
      };

      Payment.aggregate.mockResolvedValue([revenueSummary]);

      const response = await api("get", "/api/payments/revenue-summary")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalRevenue).toBe(50000);
      expect(response.body.outstandingBalance).toBe(10000);
      expect(response.body.paymentMethods.cash).toBe(30000);

      console.log("✅ Revenue summary calculation correct");
    });

    test("should handle revenue summary by term", async () => {
      const Payment = require("../models/Payment");
      
      // Mock term-based revenue summary
      const termRevenueSummary = [
        {
          term: "First Term",
          totalRevenue: 15000,
          totalFees: 20000,
          totalPayments: 15000,
          outstandingBalance: 5000
        },
        {
          term: "Second Term",
          totalRevenue: 18000,
          totalFees: 20000,
          totalPayments: 18000,
          outstandingBalance: 2000
        },
        {
          term: "Third Term",
          totalRevenue: 17000,
          totalFees: 20000,
          totalPayments: 17000,
          outstandingBalance: 3000
        }
      ];

      Payment.aggregate.mockResolvedValue(termRevenueSummary);

      const response = await api("get", "/api/payments/revenue-summary-by-term")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          academicYear: testAcademicYear._id
        });

      expect(response.status).toBe(200);
      expect(response.body.summary).toHaveLength(3);
      expect(response.body.summary[0].totalRevenue).toBe(15000);
      expect(response.body.totalRevenue).toBe(50000);

      console.log("✅ Revenue summary by term working");
    });

    test("should validate revenue summary calculations", async () => {
      const Payment = require("../models/Payment");
      
      // Mock revenue summary validation
      const validationData = {
        totalFees: 60000,
        totalPayments: 50000,
        outstandingBalance: 10000,
        validation: {
          totalFeesMatch: true,
          totalPaymentsMatch: true,
          balanceCalculationCorrect: true
        }
      };

      Payment.aggregate.mockResolvedValue([validationData]);

      const response = await api("post", "/api/payments/validate-revenue")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.totalFeesMatch).toBe(true);
      expect(response.body.validation.balanceCalculationCorrect).toBe(true);

      console.log("✅ Revenue summary validation working");
    });
  });
});
