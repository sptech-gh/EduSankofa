import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, getUserFromToken } from '../../lib/authStorage';
import { useStudents } from '../../hooks/useStudents';
import { validateStudentStep, emptyStudentForm, normalizeStudentForForm } from '../../utils/studentValidation';
import StudentsTable from './StudentsTable';
import StudentForm from './StudentForm';
import StudentModal from './StudentModal';

const StudentsContainer = () => {
  const navigate = useNavigate();
  const {
    students,
    loading,
    error,
    fetchStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentById,
  } = useStudents();

  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(emptyStudentForm());
  const [formError, setFormError] = useState('');

  const user = getUserFromToken();
  const canManage = useMemo(() => {
    return user && ['admin', 'staff'].includes(user.role);
  }, [user]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }

    fetchStudents();
  }, [navigate, fetchStudents]);

  const handleInputChange = useCallback((e, section = null) => {
    const { name, value } = e.target;

    if (section) {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [name]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  }, []);

  const handleNext = useCallback(() => {
    const valResult = validateStudentStep(formData, currentStep);
    if (valResult.isValid) {
      setCurrentStep((prev) => prev + 1);
      setFormError('');
    } else {
      setFormError(valResult.error);
    }
  }, [formData, currentStep]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => prev - 1);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditingStudent(null);
    setFormData(emptyStudentForm());
    setCurrentStep(1);
    setFormError('');
  }, []);

  const handleSubmit = useCallback(async () => {
    const valResult = validateStudentStep(formData, 7);
    if (!valResult.isValid) {
      setFormError(valResult.error);
      return;
    }

    try {
      setFormError('');
      
      if (editingStudent) {
        await updateStudent(editingStudent._id, formData);
      } else {
        await createStudent(formData);
      }

      handleCloseModal();
    } catch (err) {
      setFormError(err && err.message ? err.message : 'Server error');
    }
  }, [editingStudent, formData, updateStudent, createStudent, handleCloseModal]);

  const handleEdit = useCallback(async (student) => {
    if (!canManage) return;

    try {
      setFormError('');
      const fullStudent = await getStudentById(student._id);
      setEditingStudent(fullStudent);
      setFormData(normalizeStudentForForm(fullStudent));
      setCurrentStep(1);
      setShowModal(true);
    } catch (err) {
      setFormError(err && err.message ? err.message : 'Server error');
    }
  }, [canManage, getStudentById]);

  const handleDelete = useCallback(async (id) => {
    if (!canManage) return;

    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    try {
      await deleteStudent(id);
    } catch (err) {
      setFormError(err && err.message ? err.message : 'Server error');
    }
  }, [canManage, deleteStudent]);

  const handleOpenModal = useCallback(() => {
    if (!canManage) return;
    
    setEditingStudent(null);
    setFormData(emptyStudentForm());
    setCurrentStep(1);
    setShowModal(true);
    setFormError('');
  }, [canManage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Students Management</h1>
        {canManage && (
          <button
            onClick={handleOpenModal}
            className="btn btn-primary"
          >
            Add New Student
          </button>
        )}
      </div>

      {/* Error Display */}
      {formError && (
        <div className="alert alert-error mb-6">
          {formError}
        </div>
      )}

      {/* Students Table */}
      <StudentsTable
        students={students}
        loading={loading}
        error={error}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canManage={canManage}
      />

      {/* Student Modal */}
      <StudentModal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingStudent ? 'Edit Student' : 'Add New Student'}
      >
        <StudentForm
          formData={formData}
          currentStep={currentStep}
          onInputChange={handleInputChange}
          onNext={handleNext}
          onPrev={handlePrev}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          isEditing={!!editingStudent}
          error={formError}
        />
      </StudentModal>
    </div>
  );
};

export default StudentsContainer;
