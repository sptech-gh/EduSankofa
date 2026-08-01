import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, getUserFromToken } from '../../lib/authStorage';
import { hasRole } from '../../lib/rbac';
import { useStudents } from '../../hooks/useStudents';
import { validateStudentStep, emptyStudentForm, normalizeStudentForForm } from '../../utils/studentValidation';
import StudentsTable from './StudentsTable';
import StudentForm from './StudentForm';
import StudentModal from './StudentModal';
import apiService from '../../services/api';

// GES Basic School class levels (Creche through JHS 3) — used as fallback dropdown options
const GES_CLASS_LEVELS = [
  "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
  "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  "JHS 1", "JHS 2", "JHS 3",
];

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

  // Classes and academic years loaded from DB for dropdowns
  const [classesList, setClassesList] = useState([]);
  const [academicYearsList, setAcademicYearsList] = useState([]);
  const [schoolConfig, setSchoolConfig] = useState({});

  const user = getUserFromToken();
  const canManage = useMemo(() => {
    return user && hasRole(['admin', 'school admin', 'super admin', 'headmaster', 'proprietor', 'staff']);
  }, [user]);

  /** Load classes and academic years for the student form dropdowns */
  const fetchSetupData = async () => {
    // Single source of truth: GhanaClass via /api/school-setup/classes
    try {
      const classesRes = await apiService.get('/api/school-setup/classes');
      const rawClasses = classesRes && classesRes.classes
        ? classesRes.classes
        : Array.isArray(classesRes)
        ? classesRes
        : [];
      if (rawClasses.length > 0) {
        setClassesList(rawClasses);
      } else {
        // Hardcoded GES fallback only when DB has zero classes
        setClassesList(GES_CLASS_LEVELS.map((name, idx) => ({ _id: `ges-fallback-${idx}`, name })));
      }
    } catch (err) {
      console.warn('Could not load classes:', err?.message || err);
      setClassesList(GES_CLASS_LEVELS.map((name, idx) => ({ _id: `ges-fallback-${idx}`, name })));
    }

    try {
      const yearsRes = await apiService.get('/api/academic-years');
      setAcademicYearsList(Array.isArray(yearsRes) ? yearsRes : []);
    } catch (err) {
      console.warn('Could not load academic years:', err?.message || err);
    }
  };

  const fetchSchoolConfig = async () => {
    try {
      const config = await apiService.get('/api/school-profile');
      setSchoolConfig(config && typeof config === 'object' ? config : {});
    } catch (_) {
      setSchoolConfig({});
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }
    fetchStudents();
    fetchSetupData();
    fetchSchoolConfig();
  }, [navigate, fetchStudents]);

  const handleInputChange = useCallback((e, section = null) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    if (section) {
      setFormData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [name]: nextValue },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: nextValue }));
    }
  }, []);

  const handleNext = useCallback(() => {
    const valResult = validateStudentStep(formData, currentStep);
    if (valResult.isValid) {
      setCurrentStep((prev) => prev + 1);
      setFormError('');
    } else {
      setFormError(valResult.error);
      alert("Please fill in all required fields before proceeding.");
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
    const valResult = validateStudentStep(formData, 6);
    if (!valResult.isValid) {
      setFormError(valResult.error);
      alert("Please fill in all required fields before proceeding.");
      return;
    }

    try {
      setFormError('');
      const payload = {
        ...formData,
        documents: Object.entries(formData.documentChecklist || {}).map(([documentType, submitted]) => ({
          documentType,
          submitted,
        })),
      };
      if (editingStudent) {
        await updateStudent(editingStudent._id, payload);
      } else {
        await createStudent(payload);
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
    if (!window.confirm('Are you sure you want to delete this student?')) return;
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
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost">
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Students Management</h1>
        </div>
        {canManage && (
          <button onClick={handleOpenModal} className="btn btn-primary">
            Add New Student
          </button>
        )}
      </div>

      {/* Error Display */}
      {formError && (
        <div className="alert alert-error mb-6">{formError}</div>
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
          classesList={classesList}
          academicYearsList={academicYearsList}
          schoolConfig={schoolConfig}
        />
      </StudentModal>
    </div>
  );
};

export default StudentsContainer;
