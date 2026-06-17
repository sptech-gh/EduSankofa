import { useCallback, useState } from 'react';
import apiService from '../services/api';
import { getUserFromToken } from '../lib/authStorage';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const user = getUserFromToken();
      let params = {};
      
      if (user && user.role === 'teacher') {
        const [yearsData, termsData] = await Promise.all([
          apiService.academic.getAcademicYears(),
          apiService.academic.getTerms(),
        ]);

        const years = Array.isArray(yearsData) ? yearsData : [];
        const terms = Array.isArray(termsData) ? termsData : [];

        const activeYear = years.find((y) => y.isActive) || years[0];
        if (!activeYear) {
          setStudents([]);
          setError(
            'No active academic year found. Please ask an admin to set an active academic year.'
          );
          return;
        }

        const yearTerms = terms.filter((t) => {
          const termYearId = t?.academicYear?._id || t?.academicYear;
          return termYearId && String(termYearId) === String(activeYear._id);
        });
        const activeTerm = yearTerms.find((t) => t.isActive) || yearTerms[0];

        params = {
          academicYearId: activeYear._id,
        };
        if (activeTerm && activeTerm._id) {
          params.termId = activeTerm._id;
        }
      }

      const data = await apiService.students.getAll(params);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err && err.message ? err.message : 'Server error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createStudent = useCallback(async (studentData) => {
    try {
      const newStudent = await apiService.students.create(studentData);
      setStudents(prev => [...prev, newStudent]);
      return newStudent;
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'Failed to create student');
    }
  }, []);

  const updateStudent = useCallback(async (id, studentData) => {
    try {
      const updatedStudent = await apiService.students.update(id, studentData);
      setStudents(prev => 
        prev.map(student => student._id === id ? updatedStudent : student)
      );
      return updatedStudent;
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'Failed to update student');
    }
  }, []);

  const deleteStudent = useCallback(async (id) => {
    try {
      await apiService.students.delete(id);
      setStudents(prev => prev.filter(student => student._id !== id));
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'Failed to delete student');
    }
  }, []);

  const getStudentById = useCallback(async (id) => {
    try {
      return await apiService.students.getById(id);
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'Failed to fetch student');
    }
  }, []);

  return {
    students,
    loading,
    error,
    fetchStudents,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentById,
  };
};
