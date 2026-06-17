import React from 'react';

const StudentsTable = React.memo(({ 
  students, 
  loading, 
  error, 
  onEdit, 
  onDelete, 
  canManage 
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading students...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        No students found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Class</th>
            <th>Admission No.</th>
            <th>Status</th>
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {students.map((student) => (
            <tr key={student._id}>
              <td>
                <div className="font-medium text-neutral-900 dark:text-neutral-100">
                  {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.otherNames ? student.otherNames + ' ' : ''}{student.lastName}
                </div>
              </td>
              <td>
                <div className="text-neutral-500 dark:text-neutral-400">{student.email}</div>
              </td>
              <td>
                <div className="text-neutral-500 dark:text-neutral-400">{student.class}</div>
              </td>
              <td>
                <div className="text-neutral-500 dark:text-neutral-400">{student.admissionNumber}</div>
              </td>
              <td>
                <span className={`badge ${
                  student.status === 'active' 
                    ? 'badge-success' 
                    : 'badge-error'
                }`}>
                  {student.status}
                </span>
              </td>
              {canManage && (
                <td>
                  <button
                    onClick={() => onEdit(student)}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 mr-3 font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(student._id)}
                    className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300 font-semibold"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default StudentsTable;
