import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api"
import { getUserFromToken } from "../lib/authStorage";
import { hasRole } from "../lib/rbac";

const FeesManagement = () => {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({
    student: "",
    academicYear: "",
    semester: "",
    status: "",
    feeType: "",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const [formData, setFormData] = useState({
    student: "",
    feeType: "",
    academicYear: "",
    semester: "",
    amount: "",
    dueDate: "",
    description: "",
  });

  const user = getUserFromToken();
  const canManage =
    user && hasRole(["admin", "school admin", "super admin", "accounts officer", "accountant"]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [feesData, studentsData, academicYearsData] = await Promise.all([
        apiService.get("/api/fees"),
        apiService.get("/api/students"),
        apiService.get("/api/academic-years"),
      ]);

      setFees(Array.isArray(feesData.fees) ? feesData.fees : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setAcademicYears(
        Array.isArray(academicYearsData) ? academicYearsData : [],
      );
    } catch (err) {
      setError(err && err.message ? err.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredFees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.student) params.set("student", filters.student);
      if (filters.academicYear)
        params.set("academicYear", filters.academicYear);
      if (filters.semester) params.set("semester", filters.semester);
      if (filters.status) params.set("status", filters.status);
      if (filters.feeType) params.set("feeType", filters.feeType);

      const url = params.toString()
        ? `/api/fees?${params.toString()}`
        : "/api/fees";
      const data = await apiService.get(url);
      setFees(Array.isArray(data.fees) ? data.fees : []);
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

  const handleCreateFee = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !formData.student ||
      !formData.feeType ||
      !formData.academicYear ||
      !formData.amount ||
      !formData.dueDate
    ) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const payload = {
        student: formData.student,
        feeType: formData.feeType,
        academicYear: formData.academicYear,
        semester: formData.semester || undefined,
        amount: Number(formData.amount),
        dueDate: formData.dueDate,
        description: formData.description || undefined,
      };

      await apiService.post("/api/fees", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess("Fee created successfully");
      setShowCreateForm(false);
      setFormData({
        student: "",
        feeType: "",
        academicYear: "",
        semester: "",
        amount: "",
        dueDate: "",
        description: "",
      });
      fetchFilteredFees();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to create fee");
    }
  };

  const handleEditFee = (fee) => {
    if (!canManage) return;

    setEditingFee(fee);
    setFormData({
      student: fee.student._id,
      feeType: fee.feeType,
      academicYear: fee.academicYear,
      semester: fee.semester || "",
      amount: fee.amount.toString(),
      dueDate: fee.dueDate
        ? new Date(fee.dueDate).toISOString().split("T")[0]
        : "",
      description: fee.description || "",
    });
    setShowCreateForm(true);
  };

  const handleUpdateFee = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!editingFee) return;

    try {
      const payload = {
        feeType: formData.feeType,
        academicYear: formData.academicYear,
        semester: formData.semester || undefined,
        amount: Number(formData.amount),
        dueDate: formData.dueDate,
        description: formData.description || undefined,
      };

      await apiService.put(`/api/fees/${editingFee._id}`, {
        body: JSON.stringify(payload),
      });

      setSuccess("Fee updated successfully");
      setEditingFee(null);
      setShowCreateForm(false);
      setFormData({
        student: "",
        feeType: "",
        academicYear: "",
        semester: "",
        amount: "",
        dueDate: "",
        description: "",
      });
      fetchFilteredFees();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to update fee");
    }
  };

  const handleDeleteFee = async (id) => {
    if (!window.confirm("Are you sure you want to delete this fee?")) {
      return;
    }

    try {
      await apiService.delete(`/api/fees/${id}`, {
        method: "DELETE",
      });
      setSuccess("Fee deleted successfully");
      fetchFilteredFees();
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to delete fee");
    }
  };

  const getStudentName = (studentId) => {
    const student = students.find((s) => s._id === studentId);
    return student
      ? `${student.firstName} ${student.lastName}`
      : "Unknown Student";
  };

  const getAcademicYearName = (yearId) => {
    const year = academicYears.find((y) => y._id === yearId);
    return year ? year.name : "Unknown Year";
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "paid":
        return "status-paid";
      case "partial":
        return "status-partial";
      case "overdue":
        return "status-overdue";
      default:
        return "status-pending";
    }
  };

  const resetForm = () => {
    setEditingFee(null);
    setFormData({
      student: "",
      feeType: "",
      academicYear: "",
      semester: "",
      amount: "",
      dueDate: "",
      description: "",
    });
    setShowCreateForm(false);
  };

  if (loading) {
    return <div className="loading">Loading fees...</div>;
  }

  return (
    <div className="fees-management">
      <div className="page-header">
        <h1>Fees Management</h1>
        {canManage && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Cancel" : "Create Fee"}
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
            <label>Academic Year:</label>
            <select
              name="academicYear"
              value={filters.academicYear}
              onChange={handleFilterChange}
            >
              <option value="">All Years</option>
              {academicYears.map((year) => (
                <option key={year._id} value={year._id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Term:</label>
            <select
              name="semester"
              value={filters.semester}
              onChange={handleFilterChange}
            >
              <option value="">All Terms</option>
              <option value="First Term">First Term</option>
              <option value="Second Term">Second Term</option>
              <option value="Third Term">Third Term</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fee Type:</label>
            <select
              name="feeType"
              value={filters.feeType}
              onChange={handleFilterChange}
            >
              <option value="">All Types</option>
              <option value="tuition">Tuition</option>
              <option value="registration">Registration</option>
              <option value="examination">Examination</option>
              <option value="library">Library</option>
              <option value="sports">Sports</option>
              <option value="uniform">Uniform</option>
              <option value="books">Books</option>
              <option value="other">Other</option>
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
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="form-group">
            <button className="btn btn-secondary" onClick={fetchFilteredFees}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && canManage && (
        <div className="fee-form-section">
          <h3>{editingFee ? "Edit Fee" : "Create New Fee"}</h3>
          <form
            onSubmit={editingFee ? handleUpdateFee : handleCreateFee}
            className="form-grid"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student
                </label>
                <select
                  name="student"
                  value={formData.student}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                  disabled={!!editingFee}
                >
                  <option value="">Select Student</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fee Type
                </label>
                <select
                  name="feeType"
                  value={formData.feeType}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Fee Type</option>
                  <option value="tuition">Tuition</option>
                  <option value="registration">Registration</option>
                  <option value="examination">Examination</option>
                  <option value="library">Library</option>
                  <option value="sports">Sports</option>
                  <option value="uniform">Uniform</option>
                  <option value="books">Books</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Academic Year
                </label>
                <select
                  name="academicYear"
                  value={formData.academicYear}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year) => (
                    <option key={year._id} value={year._id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term
                </label>
                <select
                  name="semester"
                  value={formData.semester}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select Term</option>
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="3"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {editingFee ? "Update Fee" : "Create Fee"}
            </button>
            {editingFee && (
              <div className="form-group">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Fees List */}
      <div className="fees-list">
        <h3>Fees ({fees.length})</h3>
        {fees.length === 0 ? (
          <div className="no-data">No fees found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fee Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fees.map((fee) => (
                  <tr key={fee._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fee.student
                        ? `${fee.student.firstName} ${fee.student.lastName}`
                        : "Unknown Student"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fee.feeType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      GH¢{fee.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(fee.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          fee.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : fee.status === "overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {fee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canManage && (
                        <button
                          onClick={() => handleDeleteFee(fee._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeesManagement;
