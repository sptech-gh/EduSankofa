import React from 'react';

const StudentForm = ({ 
  formData, 
  currentStep, 
  onInputChange, 
  onNext, 
  onPrev, 
  onSubmit, 
  onCancel, 
  isEditing,
  error
}) => {
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName || ''}
                  onChange={onInputChange}
                  className="input mt-1"
                  placeholder="e.g. Kofi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Other Names</label>
                <input
                  type="text"
                  name="otherNames"
                  value={formData.otherNames || ''}
                  onChange={onInputChange}
                  className="input mt-1"
                  placeholder="e.g. Kwesi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Place of Birth</label>
                <input
                  type="text"
                  name="placeOfBirth"
                  value={formData.placeOfBirth}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Birth Certificate & NHIS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Birth Certificate Number</label>
                <input
                  type="text"
                  name="birthCertificateNumber"
                  value={formData.birthCertificateNumber}
                  onChange={onInputChange}
                  className="input mt-1"
                  placeholder="e.g. 1234/2021"
                  required
                />
                <p className="text-xs text-neutral-400 mt-1">Alphanumeric entry number (5-15 characters, e.g. 1234/2021)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Birth Certificate Issue Date</label>
                <input
                  type="date"
                  name="birthCertificateIssueDate"
                  value={formData.birthCertificateIssueDate}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">NHIS Number</label>
                <input
                  type="text"
                  name="nhisNumber"
                  value={formData.nhisNumber}
                  onChange={onInputChange}
                  className="input mt-1"
                  placeholder="e.g. 12345678"
                  required
                />
                <p className="text-xs text-neutral-400 mt-1">Must be exactly 8 digits</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">NHIS Expiry Date</label>
                <input
                  type="date"
                  name="nhisExpiryDate"
                  value={formData.nhisExpiryDate}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Identity Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                <select
                  name="identityType"
                  value={formData.identityType}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                >
                  <option value="">Select Identity Type</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driver License">Driver License</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                <input
                  type="text"
                  name="identityNumber"
                  value={formData.identityNumber}
                  onChange={onInputChange}
                  className="input mt-1"
                  placeholder={
                    formData.identityType === "National ID"
                      ? "GHA-000000000-0"
                      : formData.identityType === "Passport"
                      ? "e.g. G1234567"
                      : formData.identityType === "Voter ID"
                      ? "10 digits"
                      : formData.identityType === "Driver License"
                      ? "8-16 characters"
                      : "Enter ID number"
                  }
                  required
                />
                {formData.identityType && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Format: {
                      formData.identityType === "National ID"
                        ? "GHA-#########-# (e.g. GHA-123456789-0)"
                        : formData.identityType === "Passport"
                        ? "1 or 2 letters followed by 6 or 7 digits (e.g. G1234567)"
                        : formData.identityType === "Voter ID"
                        ? "Exactly 10 digits"
                        : formData.identityType === "Driver License"
                        ? "8-16 alphanumeric characters, hyphens allowed"
                        : ""
                    }
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Expiry Date</label>
                <input
                  type="date"
                  name="identityExpiryDate"
                  value={formData.identityExpiryDate}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Father&apos;s Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.fatherDetails.firstName}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.fatherDetails.lastName}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.fatherDetails.occupation}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.fatherDetails.phone}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.fatherDetails.email}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                <select
                  name="identityType"
                  value={formData.fatherDetails.identityType}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                >
                  <option value="">Select Identity Type</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driver License">Driver License</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                <input
                  type="text"
                  name="identityNumber"
                  value={formData.fatherDetails.identityNumber}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Mother&apos;s Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.motherDetails.firstName}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.motherDetails.lastName}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formData.motherDetails.occupation}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.motherDetails.phone}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.motherDetails.email}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                <select
                  name="identityType"
                  value={formData.motherDetails.identityType}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                >
                  <option value="">Select Identity Type</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driver License">Driver License</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                <input
                  type="text"
                  name="identityNumber"
                  value={formData.motherDetails.identityNumber}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.emergencyContact.firstName}
                  onChange={(e) => onInputChange(e, 'emergencyContact')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.emergencyContact.lastName}
                  onChange={(e) => onInputChange(e, 'emergencyContact')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Relationship</label>
                <input
                  type="text"
                  name="relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) => onInputChange(e, 'emergencyContact')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.emergencyContact.phone}
                  onChange={(e) => onInputChange(e, 'emergencyContact')}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Academic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Class</label>
                <input
                  type="text"
                  name="class"
                  value={formData.class}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Admission Number</label>
                <input
                  type="text"
                  name="admissionNumber"
                  value={formData.admissionNumber}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card p-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg mb-4 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}
      {renderStepContent()}
      
      <div className="flex justify-between mt-8">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={onPrev}
              className="btn btn-ghost"
            >
              Previous
            </button>
          )}
        </div>
        
        <div className="space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          
          {currentStep < 7 ? (
            <button
              type="button"
              onClick={onNext}
              className="btn btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              className="btn btn-secondary"
            >
              {isEditing ? 'Update Student' : 'Create Student'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentForm;
