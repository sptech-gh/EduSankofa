import React from 'react';

const DOCUMENT_LABELS = {
  birthCertificate: 'Birth Certificate',
  healthInsuranceCard: 'Health Insurance Card',
  ghanaCard: 'Ghana Card, if any',
  passportSizedPhotos: '2 Passport sized Photo',
  currentReportSheet: 'Current Report Sheet',
};

const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
];

// GES Basic School class levels (Creche through JHS 3)
const GES_CLASS_LEVELS = [
  "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
  "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
  "JHS 1", "JHS 2", "JHS 3",
];

const StudentForm = ({
  formData,
  currentStep,
  onInputChange,
  onNext,
  onPrev,
  onSubmit,
  onCancel,
  isEditing,
  error,
  classesList = [],
  academicYearsList = [],
  schoolConfig = {},
}) => {
  const schoolName = schoolConfig.schoolName || 'this school';
  const schoolMission = schoolConfig.mission || '';

  const renderMissionPanel = () => {
    if (!schoolMission && !schoolConfig.motto && !schoolConfig.schoolName) {
      return (
        <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/30 p-4 text-sm text-neutral-500 dark:text-neutral-400">
          School mission details are not configured yet.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-primary-200 bg-white p-4 space-y-2 shadow-sm dark:border-primary-900/40 dark:bg-neutral-900/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
            School Mission
          </span>
          {schoolConfig.motto ? (
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-100">
              Motto: {schoolConfig.motto}
            </span>
          ) : null}
        </div>
        {schoolConfig.schoolName ? (
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {schoolConfig.schoolName}
          </h3>
        ) : null}
        {schoolMission ? (
          <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {schoolMission}
          </p>
        ) : (
          <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Mission statement not configured.
          </p>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {renderMissionPanel()}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={onInputChange}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="middleName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Middle Name</label>
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    value={formData.middleName || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="e.g. Kofi"
                  />
                </div>
                <div>
                  <label htmlFor="otherNames" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Other Names</label>
                  <input
                    type="text"
                    id="otherNames"
                    name="otherNames"
                    value={formData.otherNames || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="e.g. Kwesi"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={onInputChange}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Date of Birth</label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={onInputChange}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Gender</label>
                  <select
                    id="gender"
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
                  <label htmlFor="placeOfBirth" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Place of Birth</label>
                  <input
                    type="text"
                    id="placeOfBirth"
                    name="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={onInputChange}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="nationality" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Nationality</label>
                  <input
                    type="text"
                    id="nationality"
                    name="nationality"
                    value={formData.nationality || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="e.g. Ghanaian"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Residential Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="addressStreet" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Street</label>
                  <input
                    type="text"
                    id="addressStreet"
                    name="street"
                    value={formData.address?.street || ''}
                    onChange={(e) => onInputChange(e, 'address')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="addressCity" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">City</label>
                  <input
                    type="text"
                    id="addressCity"
                    name="city"
                    value={formData.address?.city || ''}
                    onChange={(e) => onInputChange(e, 'address')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="addressRegion" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">State / Region</label>
                  <select
                    id="addressRegion"
                    name="region"
                    value={formData.address?.region || ''}
                    onChange={(e) => onInputChange(e, 'address')}
                    className="input mt-1"
                    required
                  >
                    <option value="">Select Region</option>
                    {GHANA_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="addressPostalCode" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Postal Address</label>
                  <input
                    type="text"
                    id="addressPostalCode"
                    name="postalCode"
                    value={formData.address?.postalCode || ''}
                    onChange={(e) => onInputChange(e, 'address')}
                    className="input mt-1"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
              Birth Certificate & NHIS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthCertificateNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Birth Certificate Number</label>
                <input
                  type="text"
                  id="birthCertificateNumber"
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
                <label htmlFor="birthCertificateIssueDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Birth Certificate Issue Date</label>
                <input
                  type="date"
                  id="birthCertificateIssueDate"
                  name="birthCertificateIssueDate"
                  value={formData.birthCertificateIssueDate}
                  onChange={onInputChange}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="nhisNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">NHIS Number</label>
                <input
                  type="text"
                  id="nhisNumber"
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
                <label htmlFor="nhisExpiryDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">NHIS Expiry Date</label>
                <input
                  type="date"
                  id="nhisExpiryDate"
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
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Father&apos;s Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fatherFirstName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  id="fatherFirstName"
                  name="firstName"
                  value={formData.fatherDetails.firstName}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="fatherOtherNames" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Other Names</label>
                <input
                  type="text"
                  id="fatherOtherNames"
                  name="otherNames"
                  value={formData.fatherDetails.otherNames || ''}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  placeholder="e.g. Kwabena"
                />
              </div>
              <div>
                <label htmlFor="fatherLastName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  id="fatherLastName"
                  name="lastName"
                  value={formData.fatherDetails.lastName}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="fatherOccupation" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Occupation</label>
                <input
                  type="text"
                  id="fatherOccupation"
                  name="occupation"
                  value={formData.fatherDetails.occupation}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="fatherPhone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  type="tel"
                  id="fatherPhone"
                  name="phone"
                  value={formData.fatherDetails.phone}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="fatherEmail" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  id="fatherEmail"
                  name="email"
                  value={formData.fatherDetails.email}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                />
              </div>
              <div>
                <label htmlFor="fatherIdentityType" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                <select
                  id="fatherIdentityType"
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
                <label htmlFor="fatherIdentityNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                <input
                  type="text"
                  id="fatherIdentityNumber"
                  name="identityNumber"
                  value={formData.fatherDetails.identityNumber}
                  onChange={(e) => onInputChange(e, 'fatherDetails')}
                  className="input mt-1"
                  placeholder={formData.fatherDetails.identityType === 'National ID' ? 'GHA-000000000-0' : 'Enter ID number'}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">Mother&apos;s Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="motherFirstName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                <input
                  type="text"
                  id="motherFirstName"
                  name="firstName"
                  value={formData.motherDetails.firstName}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="motherOtherNames" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Other Names</label>
                <input
                  type="text"
                  id="motherOtherNames"
                  name="otherNames"
                  value={formData.motherDetails.otherNames || ''}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  placeholder="e.g. Akua"
                />
              </div>
              <div>
                <label htmlFor="motherLastName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                <input
                  type="text"
                  id="motherLastName"
                  name="lastName"
                  value={formData.motherDetails.lastName}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="motherOccupation" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Occupation</label>
                <input
                  type="text"
                  id="motherOccupation"
                  name="occupation"
                  value={formData.motherDetails.occupation}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="motherPhone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                <input
                  type="tel"
                  id="motherPhone"
                  name="phone"
                  value={formData.motherDetails.phone}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="motherEmail" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  id="motherEmail"
                  name="email"
                  value={formData.motherDetails.email}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                />
              </div>
              <div>
                <label htmlFor="motherIdentityType" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                <select
                  id="motherIdentityType"
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
                <label htmlFor="motherIdentityNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                <input
                  type="text"
                  id="motherIdentityNumber"
                  name="identityNumber"
                  value={formData.motherDetails.identityNumber}
                  onChange={(e) => onInputChange(e, 'motherDetails')}
                  className="input mt-1"
                  placeholder={formData.motherDetails.identityType === 'National ID' ? 'GHA-000000000-0' : 'Enter ID number'}
                  required
                />
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Medical Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hasMedicalConditions" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Does the student have any medical conditions or allergies?</label>
                  <select
                    id="hasMedicalConditions"
                    name="hasMedicalConditions"
                    value={formData.hasMedicalConditions || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  >
                    <option value="">Select option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="medicalConditionDetails" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">If yes, please specify</label>
                  <textarea
                    id="medicalConditionDetails"
                    name="medicalConditionDetails"
                    value={formData.medicalConditionDetails || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder="List medical conditions, allergies, or other relevant health notes"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="emergencyFirstName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">First Name</label>
                  <input
                    type="text"
                    id="emergencyFirstName"
                    name="firstName"
                    value={formData.emergencyContact.firstName}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="emergencyLastName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Last Name</label>
                  <input
                    type="text"
                    id="emergencyLastName"
                    name="lastName"
                    value={formData.emergencyContact.lastName}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Relationship</label>
                  <input
                    type="text"
                    id="emergencyRelationship"
                    name="relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="emergencyPhone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Phone</label>
                  <input
                    type="tel"
                    id="emergencyPhone"
                    name="phone"
                    value={formData.emergencyContact.phone}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
                    className="input mt-1"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="emergencyIdentityType" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Type</label>
                  <select
                    id="emergencyIdentityType"
                    name="identityType"
                    value={formData.emergencyContact.identityType || ''}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
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
                  <label htmlFor="emergencyIdentityNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Identity Number</label>
                  <input
                    type="text"
                    id="emergencyIdentityNumber"
                    name="identityNumber"
                    value={formData.emergencyContact.identityNumber || ''}
                    onChange={(e) => onInputChange(e, 'emergencyContact')}
                    className="input mt-1"
                    placeholder={formData.emergencyContact.identityType === 'National ID' ? 'GHA-000000000-0' : 'Enter ID number'}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Academic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studentClass" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Class to Enroll In</label>
                  <select
                    id="studentClass"
                    name="class"
                    value={formData.class}
                    onChange={onInputChange}
                    className="input mt-1"
                    required
                  >
                    <option value="">Select Class</option>
                    {classesList.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="admissionNumber" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Admission Number</label>
                  <input
                    type="text"
                    id="admissionNumber"
                    name="admissionNumber"
                    value={isEditing ? formData.admissionNumber : (formData.admissionNumber || 'Auto-generated')}
                    onChange={onInputChange}
                    className="input mt-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    readOnly
                    disabled
                  />
                </div>
                <div>
                  <label htmlFor="currentClassGrade" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Previous Class (if transfer)</label>
                  <select
                    id="currentClassGrade"
                    name="currentClassGrade"
                    value={formData.currentClassGrade || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  >
                    <option value="">Select previous class</option>
                    {GES_CLASS_LEVELS.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="previousSchoolName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Previous School, if applicable</label>
                  <input
                    type="text"
                    id="previousSchoolName"
                    name="previousSchoolName"
                    value={formData.previousSchoolName || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="Enter previous school name"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="academicAchievements" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Academic Achievements, if any</label>
                  <textarea
                    id="academicAchievements"
                    name="academicAchievements"
                    value={formData.academicAchievements || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder="Enter academic achievements"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="extracurricularActivities" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Extracurricular Activities</label>
                  <textarea
                    id="extracurricularActivities"
                    name="extracurricularActivities"
                    value={formData.extracurricularActivities || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder="Enter clubs, sports, or other activities"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="reasonForChoosingSchool" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Reason for Choosing {schoolName}
                  </label>
                  <textarea
                    id="reasonForChoosingSchool"
                    name="reasonForChoosingSchool"
                    value={formData.reasonForChoosingSchool || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder={`Tell us why you are choosing ${schoolName}`}
                  />
                </div>
                <div>
                  <label htmlFor="heardAboutSchool" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">How did you hear about this school?</label>
                  <select
                    id="heardAboutSchool"
                    name="heardAboutSchool"
                    value={formData.heardAboutSchool || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  >
                    <option value="">Select option</option>
                    <option value="Online">Online</option>
                    <option value="Referral">Referral</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="heardAboutSchoolOther" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Other source</label>
                  <input
                    type="text"
                    id="heardAboutSchoolOther"
                    name="heardAboutSchoolOther"
                    value={formData.heardAboutSchoolOther || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="Specify if other"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="specialNeedsRequired" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Any special needs or accommodations required?</label>
                  <textarea
                    id="specialNeedsRequired"
                    name="specialNeedsRequired"
                    value={formData.specialNeedsRequired || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder="Describe any required accommodations"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Documents Required
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                    <input
                      type="checkbox"
                      name={key}
                      checked={!!formData.documentChecklist?.[key]}
                      onChange={(e) => onInputChange(e, 'documentChecklist')}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-700 pb-2">
                Declaration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-6">
                    I hereby declare that the information provided in this application is true and accurate to the best of my knowledge.
                  </p>
                </div>
                <div>
                  <label htmlFor="declarationName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Parent/Guardian Name</label>
                  <input
                    type="text"
                    id="declarationName"
                    name="declarationName"
                    value={formData.declarationName || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                    placeholder="Name of parent/guardian signing"
                  />
                </div>
                <div>
                  <label htmlFor="declarationDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Declaration Date</label>
                  <input
                    type="date"
                    id="declarationDate"
                    name="declarationDate"
                    value={formData.declarationDate || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="applicationReceivedDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Application Received Date</label>
                  <input
                    type="date"
                    id="applicationReceivedDate"
                    name="applicationReceivedDate"
                    value={formData.applicationReceivedDate || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="interviewScheduledDate" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Interview Scheduled Date</label>
                  <input
                    type="date"
                    id="interviewScheduledDate"
                    name="interviewScheduledDate"
                    value={formData.interviewScheduledDate || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="admissionStatus" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Admission Status</label>
                  <select
                    id="admissionStatus"
                    name="admissionStatus"
                    value={formData.admissionStatus || ''}
                    onChange={onInputChange}
                    className="input mt-1"
                  >
                    <option value="">Select status</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Waitlisted">Waitlisted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="remarks" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Remarks</label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    value={formData.remarks || ''}
                    onChange={onInputChange}
                    className="input mt-1 min-h-[96px]"
                    placeholder="Office remarks or internal notes"
                  />
                </div>
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

          {currentStep < 6 ? (
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
