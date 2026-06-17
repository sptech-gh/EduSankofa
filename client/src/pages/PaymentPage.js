import React, { useState } from "react";
import apiService from "../services/api";

const PaymentPage = () => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const handlePayment = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage("");
    try {
      const res = await apiService.post("/integrations/payment", {
        amount,
        paymentMethod,
      });
      setMessage(res.message);
    } catch (err) {
      setError("Payment failed. Please try again.");
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Payment</h1>
      <form onSubmit={handlePayment}>
        <div>
          <label>Amount:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Payment Method:</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            required
          >
            <option value="">Select</option>
            <option value="credit_card">Credit Card</option>
            <option value="paypal">PayPal</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
        <button type="submit">Pay</button>
      </form>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default PaymentPage;
