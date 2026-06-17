/**
 * Integration Test: Fee → Payment → Receipt Workflow
 * Tests the complete workflow from fee creation to receipt generation
 */

const request = require('supertest');
const app = require('../../../app');
const Student = require('../../../models/Student');
const Fee = require('../../../models/Fee');
const Payment = require('../../../models/Payment');

describe('Fee → Payment → Receipt Integration', () => {
  let adminToken;
  let staffToken;
  let testStudent;
  let testFee;

  beforeAll(async () => {
    // Create test tokens
    const jwt = require('jsonwebtoken');
    
    adminToken = jwt.sign(
      {
        userId: 'admin-user-id',
        role: 'admin',
        email: 'admin@example.com',
        jti: 'admin-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    staffToken = jwt.sign(
      {
        userId: 'staff-user-id',
        role: 'staff',
        email: 'staff@example.com',
        jti: 'staff-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // Create test student
    testStudent = await Student.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      studentId: 'STU001'
    });
  });

  afterAll(async () => {
    // Cleanup
    await Payment.deleteMany({});
    await Fee.deleteMany({});
    await Student.deleteMany({});
  });

  describe('Complete Workflow Test', () => {
    test('should complete fee → payment → receipt workflow', async () => {
      // Step 1: Create fee
      const feeData = {
        student: testStudent._id,
        feeType: 'tuition',
        amount: 1500,
        dueDate: '2024-02-01',
        description: 'First term tuition fee',
        academicYear: '2023-2024',
        term: 'Term 1'
      };

      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(feeData)
        .expect(201);

      const feeId = feeResponse.body._id;
      expect(feeResponse.body.amount).toBe(1500);
      expect(feeResponse.body.status).toBe('pending');

      // Step 2: Create payment
      const paymentData = {
        fee: feeId,
        amount: 1500,
        paymentMethod: 'cash',
        paymentDate: '2024-02-01',
        transactionId: 'TXN20240201001',
        notes: 'Full tuition payment',
        receivedBy: 'accounts-office'
      };

      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(paymentData)
        .expect(201);

      const paymentId = paymentResponse.body._id;
      expect(paymentResponse.body.amount).toBe(1500);
      expect(paymentResponse.body.status).toBe('completed');
      expect(paymentResponse.body.fee).toBe(feeId);

      // Step 3: Verify fee status update
      const updatedFeeResponse = await request(app)
        .get(`/api/fees/${feeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedFeeResponse.body.status).toBe('paid');
      expect(updatedFeeResponse.body.paidAmount).toBe(1500);

      // Step 4: Generate receipt
      const receiptResponse = await request(app)
        .get(`/api/payments/${paymentId}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(receiptResponse.body).toHaveProperty('payment');
      expect(receiptResponse.body).toHaveProperty('receipt');
      expect(receiptResponse.body.payment.amount).toBe(1500);
      expect(receiptResponse.body.payment.paymentMethod).toBe('cash');
      expect(receiptResponse.body.payment.transactionId).toBe('TXN20240201001');

      // Step 5: Verify receipt content
      const receipt = receiptResponse.body.receipt;
      expect(receipt).toHaveProperty('receiptNumber');
      expect(receipt).toHaveProperty('paymentDate');
      expect(receipt).toHaveProperty('amountPaid');
      expect(receipt).toHaveProperty('paymentDetails');
      expect(receipt).toHaveProperty('feeDetails');
      expect(receipt).toHaveProperty('schoolInfo');
      expect(receipt).toHaveProperty('generatedAt');

      // Verify receipt details
      expect(receipt.paymentDetails.amount).toBe(1500);
      expect(receipt.paymentDetails.method).toBe('cash');
      expect(receipt.paymentDetails.transactionId).toBe('TXN20240201001');
      expect(receipt.feeDetails.feeType).toBe('tuition');
      expect(receipt.feeDetails.description).toBe('First term tuition fee');
      expect(receipt.schoolInfo).toHaveProperty('name');
      expect(receipt.schoolInfo).toHaveProperty('address');

      // Step 6: Test receipt export
      const exportResponse = await request(app)
        .get(`/api/payments/${paymentId}/receipt?format=pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(exportResponse.headers['content-type']).toMatch(/application\/pdf/);
      expect(exportResponse.headers['content-disposition']).toMatch(/attachment/);
    });

    test('should handle partial payment workflow', async () => {
      // Create fee
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 2000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      const feeId = feeResponse.body._id;

      // Create partial payment
      const partialPaymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeId,
          amount: 1000,
          paymentMethod: 'bank',
          paymentDate: '2024-02-01',
          transactionId: 'TXN20240201002',
          notes: 'Partial payment - first installment'
        })
        .expect(201);

      expect(partialPaymentResponse.body.amount).toBe(1000);
      expect(partialPaymentResponse.body.status).toBe('completed');

      // Verify fee status after partial payment
      const updatedFeeResponse = await request(app)
        .get(`/api/fees/${feeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedFeeResponse.body.status).toBe('partially_paid');
      expect(updatedFeeResponse.body.paidAmount).toBe(1000);
      expect(updatedFeeResponse.body.balanceAmount).toBe(1000);

      // Generate receipt for partial payment
      const receiptResponse = await request(app)
        .get(`/api/payments/${partialPaymentResponse.body._id}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const receipt = receiptResponse.body.receipt;
      expect(receipt.paymentDetails.amount).toBe(1000);
      expect(receipt.feeDetails.balanceAmount).toBe(1000);
    });

    test('should handle payment refund workflow', async () => {
      // Create and pay fee
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 1000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeResponse.body._id,
          amount: 1000,
          paymentMethod: 'cash',
          paymentDate: '2024-02-01'
        })
        .expect(201);

      // Process refund
      const refundResponse = await request(app)
        .post(`/api/payments/${paymentResponse.body._id}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          refundAmount: 200,
          refundReason: 'Overpayment correction',
          refundDate: '2024-02-05',
          approvedBy: 'admin@example.com'
        })
        .expect(200);

      expect(refundResponse.body.refundAmount).toBe(200);
      expect(refundResponse.body.refundReason).toBe('Overpayment correction');

      // Verify payment status after refund
      const updatedPaymentResponse = await request(app)
        .get(`/api/payments/${paymentResponse.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedPaymentResponse.body.status).toBe('refunded');
      expect(updatedPaymentResponse.body.refundAmount).toBe(200);

      // Verify fee status after refund
      const updatedFeeResponse = await request(app)
        .get(`/api/fees/${feeResponse.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedFeeResponse.body.status).toBe('refunded');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle overpayment gracefully', async () => {
      // Create fee
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 1000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      // Create overpayment
      const overpaymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeResponse.body._id,
          amount: 1200, // Overpayment of 200
          paymentMethod: 'cash',
          paymentDate: '2024-02-01'
        })
        .expect(201);

      expect(overpaymentResponse.body.amount).toBe(1200);
      expect(overpaymentResponse.body.overpaymentAmount).toBe(200);

      // Generate receipt showing overpayment
      const receiptResponse = await request(app)
        .get(`/api/payments/${overpaymentResponse.body._id}/receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const receipt = receiptResponse.body.receipt;
      expect(receipt.paymentDetails.overpaymentAmount).toBe(200);
      expect(receipt.paymentDetails.amountPaid).toBe(1200);
    });

    test('should handle duplicate payment detection', async () => {
      // Create fee
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 1000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      // Create first payment
      const firstPaymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeResponse.body._id,
          amount: 1000,
          paymentMethod: 'cash',
          paymentDate: '2024-02-01',
          transactionId: 'TXN001'
        })
        .expect(201);

      // Attempt duplicate payment
      const duplicatePaymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeResponse.body._id,
          amount: 1000,
          paymentMethod: 'cash',
          paymentDate: '2024-02-01',
          transactionId: 'TXN001' // Same transaction ID
        })
        .expect(400);

      expect(duplicatePaymentResponse.body).toHaveProperty('errors');
      expect(duplicatePaymentResponse.body.errors.some(e => 
        e.msg.includes('duplicate') || e.msg.includes('already paid')
      )).toBe(true);
    });

    test('should validate payment method constraints', async () => {
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 1000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      // Test invalid payment methods
      const invalidMethods = ['invalid-method', '', null, undefined];
      
      for (const method of invalidMethods) {
        const response = await request(app)
          .post('/api/payments')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            fee: feeResponse.body._id,
            amount: 1000,
            paymentMethod: method,
            paymentDate: '2024-02-01'
          })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should handle payment receipt generation for different formats', async () => {
      // Create and pay fee
      const feeResponse = await request(app)
        .post('/api/fees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: 'tuition',
          amount: 1000,
          dueDate: '2024-02-01'
        })
        .expect(201);

      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          fee: feeResponse.body._id,
          amount: 1000,
          paymentMethod: 'cash',
          paymentDate: '2024-02-01'
        })
        .expect(201);

      const paymentId = paymentResponse.body._id;

      // Test different receipt formats
      const formats = ['json', 'html', 'pdf'];
      
      for (const format of formats) {
        const response = await request(app)
          .get(`/api/payments/${paymentId}/receipt?format=${format}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify content type based on format
        if (format === 'pdf') {
          expect(response.headers['content-type']).toMatch(/application\/pdf/);
        } else if (format === 'html') {
          expect(response.headers['content-type']).toMatch(/text\/html/);
        } else {
          expect(response.headers['content-type']).toMatch(/application\/json/);
        }

        // Verify receipt data consistency
        if (format === 'json') {
          expect(response.body).toHaveProperty('receipt');
          expect(response.body.receipt).toHaveProperty('receiptNumber');
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle bulk payment processing efficiently', async () => {
      // Create multiple fees
      const fees = [];
      for (let i = 0; i < 5; i++) {
        const feeResponse = await request(app)
          .post('/api/fees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            student: testStudent._id,
            feeType: `fee-${i}`,
            amount: 1000,
            dueDate: '2024-02-01'
          })
          .expect(201);
        fees.push(feeResponse.body);
      }

      // Process bulk payments
      const startTime = Date.now();
      const paymentPromises = fees.map(fee =>
        request(app)
          .post('/api/payments')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            fee: fee._id,
            amount: 1000,
            paymentMethod: 'cash',
            paymentDate: '2024-02-01'
          })
      );

      const paymentResponses = await Promise.all(paymentPromises);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(paymentResponses.length).toBe(5);
      expect(paymentResponses.every(r => r.status === 201)).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should process within 10 seconds

      // Generate bulk receipts
      const receiptPromises = paymentResponses.map(r =>
        request(app)
          .get(`/api/payments/${r.body._id}/receipt`)
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const receiptResponses = await Promise.all(receiptPromises);
      expect(receiptResponses.length).toBe(5);
      expect(receiptResponses.every(r => r.status === 200)).toBe(true);
    });

    test('should generate payment reports within acceptable time limits', async () => {
      // Create substantial payment data
      for (let i = 0; i < 50; i++) {
        await request(app)
          .post('/api/payments')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            fee: testStudent._id,
            amount: 1000,
            paymentMethod: 'cash',
            paymentDate: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
            transactionId: `TXN${String(i).padStart(4, '0')}`
          });
      }

      // Test payment summary report performance
      const startTime = Date.now();
      const reportResponse = await request(app)
        .get('/api/payments/summary?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(reportResponse.body).toHaveProperty('totalAmount');
      expect(reportResponse.body).toHaveProperty('paymentCount');
      expect(reportResponse.body.totalAmount).toBe(50000); // 50 * 1000
      expect(reportResponse.body.paymentCount).toBe(50);
      expect(processingTime).toBeLessThan(15000); // Should generate within 15 seconds
    });
  });
});
