import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api"
import { getUserFromToken } from "../lib/authStorage";
import { hasRole } from "../lib/rbac";

const PaymentsManagement = () => {
  const [payments, setPayments] = useState([]);
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({
    student: "",
    fee: "",
    status: "",
    paymentMethod: "",
    startDate: "",
    endDate: "",
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [formData, setFormData] = useState({
    fee: "",
    amount: "",
    paymentMethod: "",
    transactionId: "",
    reference: "",
    notes: "",
  });

  const navigate = useNavigate();
  const user = getUserFromToken();
  const canManage =
    user && hasRole(["admin", "school admin", "super admin", "accounts officer", "accountant"]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [paymentsData, feesData, studentsData] = await Promise.all([
        apiService.get("/api/payments"),
        apiService.get("/api/fees"),
        apiService.get("/api/students"),
      ]);

      setPayments(
        Array.isArray(paymentsData.payments) ? paymentsData.payments : [],
      );
      setFees(Array.isArray(feesData.fees) ? feesData.fees : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.student) params.set("student", filters.student);
      if (filters.fee) params.set("fee", filters.fee);
      if (filters.status) params.set("status", filters.status);
      if (filters.paymentMethod)
        params.set("paymentMethod", filters.paymentMethod);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      const url = params.toString()
        ? `/api/payments?${params.toString()}`
        : "/api/payments";
      const data = await apiService.get(url);
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.fee || !formData.amount || !formData.paymentMethod) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const payload = {
        fee: formData.fee,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        transactionId: formData.transactionId || undefined,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      await apiService.post("/api/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Payment processed successfully");
      setShowPaymentForm(false);
      setFormData({
        fee: "",
        amount: "",
        paymentMethod: "",
        transactionId: "",
        reference: "",
        notes: "",
      });
      fetchFilteredPayments();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to process payment");
    }
  };

  const handleRefund = async (id) => {
    const reason = prompt("Please enter refund reason:");
    if (!reason) return;

    try {
      await apiService.put(`/api/payments/${id}/refund`, {
        body: JSON.stringify({ reason }),
      });
      setSuccess("Payment refunded successfully");
      fetchFilteredPayments();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to refund payment");
    }
  };

  const getStudentName = (studentId) => {
    const student = students.find((s) => s._id === studentId);
    return student
      ? `${student.firstName} ${student.lastName}`
      : "Unknown Student";
  };

  const getFeeDetails = (feeId) => {
    const fee = fees.find((f) => f._id === feeId);
    return fee
      ? {
          student: fee.student
            ? `${fee.student.firstName} ${fee.student.lastName}`
            : "Unknown",
          type: fee.feeType,
          amount: fee.amount,
          remaining: fee.remainingAmount,
        }
      : { student: "Unknown", type: "Unknown", amount: 0, remaining: 0 };
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "completed":
        return "status-completed";
      case "pending":
        return "status-pending";
      case "refunded":
        return "status-refunded";
      default:
        return "status-unknown";
    }
  };

  const getUnpaidFees = () => {
    return fees.filter((fee) => fee.remainingAmount > 0);
  };

  if (loading) {
    return <div className="loading">Loading payments...</div>;
  }

  return (
    <div className="payments-management">
      <div className="page-header">
        <h1>Payments Management</h1>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => setShowPaymentForm(!showPaymentForm)}
          >
            {showPaymentForm ? "Cancel" : "Process Payment"}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filters */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="form-group">
            <label>Student:</label>
            <select
              name="student"
              value={filters.student}
              onChange={handleFilterChange}
            >
              <option value="">All Students</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.firstName} {student.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fee:</label>
            <select
              name="fee"
              value={filters.fee}
              onChange={handleFilterChange}
            >
              <option value="">All Fees</option>
              {fees.map((fee) => (
                <option key={fee._id} value={fee._id}>
                  {fee.feeType} -{" "}
                  {fee.student
                    ? `${fee.student.firstName} ${fee.student.lastName}`
                    : "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Status:</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="form-group">
            <label>Payment Method:</label>
            <select
              name="paymentMethod"
              value={filters.paymentMethod}
              onChange={handleFilterChange}
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
          <div className="form-group">
            <label>Start Date:</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>
          <div className="form-group">
            <label>End Date:</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
          <div className="form-group">
            <button
              className="btn btn-secondary"
              onClick={fetchFilteredPayments}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      {showPaymentForm && canManage && (
        <div className="payment-form-section">
          <h3>Process New Payment</h3>
          <form onSubmit={handleProcessPayment} className="form-grid">
            <div className="form-group">
              <label>Fee: *</label>
              <select
                name="fee"
                value={formData.fee}
                onChange={handleFormChange}
                required
              >
                <option value="">Select Fee</option>
                {getUnpaidFees().map((fee) => (
                  <option key={fee._id} value={fee._id}>
                    {fee.feeType} -{" "}
                    {fee.student
                      ? `${fee.student.firstName} ${fee.student.lastName}`
                      : "Unknown"}{" "}
                    (Balance: ₵{fee.remainingAmount.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Amount: *</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleFormChange}
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="form-group">
              <label>Payment Method: *</label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleFormChange}
                required
              >
                <option value="">Select Method</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="cheque">Cheque</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>
            <div className="form-group">
              <label>Transaction ID:</label>
              <input
                type="text"
                name="transactionId"
                value={formData.transactionId}
                onChange={handleFormChange}
              />
            </div>
            <div className="form-group">
              <label>Reference:</label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleFormChange}
              />
            </div>
            <div className="form-group full-width">
              <label>Notes:</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                rows="3"
              />
            </div>
            <div className="form-group">
              <button type="submit" className="btn btn-primary">
                Process Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments List */}
      <div className="payments-list">
        <h3>Payments ({payments.length})</h3>
        {payments.length === 0 ? (
          <div className="no-data">No payments found</div>
        ) : (
          <div className="table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Fee Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction ID</th>
                  <th>Status</th>
                  <th>Processed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const feeDetails = getFeeDetails(payment.fee._id);
                  return (
                    <tr key={payment._id}>
                      <td>
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </td>
                      <td>{feeDetails.student}</td>
                      <td>{feeDetails.type}</td>
                      <td>₵{payment.amount.toFixed(2)}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{payment.transactionId || "-"}</td>
                      <td>
                        <span
                          className={`status ${getStatusClass(payment.status)}`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td>
                        {payment.processedBy
                          ? payment.processedBy.name
                          : "System"}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {canManage && payment.status === "completed" && (
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleRefund(payment._id)}
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsManagement;
