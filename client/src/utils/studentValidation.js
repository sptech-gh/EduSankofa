const GHANA_CARD_REGEX = /^GHA-\d{9}-[A-Z0-9]$/i;
const NHIS_REGEX = /^\d{8}$/;
const BIRTH_CERT_REGEX = /^[A-Z0-9/-]+$/i;
const PASSPORT_REGEX = /^[A-Z]{1,2}\d{6,7}$/i;
const VOTER_ID_REGEX = /^\d{10}$/;
const DRIVER_LICENSE_REGEX = /^[A-Z0-9-]{8,16}$/i;

export const validateBirthCertificate = (num) => {
  if (!num) return false;
  return BIRTH_CERT_REGEX.test(num) && /\d/.test(num) && num.length >= 5 && num.length <= 15;
};

export const validateNhis = (num) => {
  if (!num) return false;
  return NHIS_REGEX.test(num);
};

export const validateGhanaCard = (num) => {
  if (!num) return false;
  return GHANA_CARD_REGEX.test(num);
};

export const validatePassport = (num) => {
  if (!num) return false;
  return PASSPORT_REGEX.test(num);
};

export const validateVoterId = (num) => {
  if (!num) return false;
  return VOTER_ID_REGEX.test(num);
};

export const validateDriverLicense = (num) => {
  if (!num) return false;
  return DRIVER_LICENSE_REGEX.test(num);
};

export const validateStudentStep = (formData, step) => {
  switch (step) {
    case 1:
      if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.gender || !formData.placeOfBirth || !formData.email) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      return { isValid: true };
    case 2:
      if (!formData.birthCertificateNumber || !formData.birthCertificateIssueDate || !formData.nhisNumber || !formData.nhisExpiryDate) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      if (!validateBirthCertificate(formData.birthCertificateNumber)) {
        return { isValid: false, error: 'Invalid Birth Certificate format. Expected entry number with slashes/hyphens, length 5-15, containing digits (e.g. 1234/2021).' };
      }
      if (!validateNhis(formData.nhisNumber)) {
        return { isValid: false, error: 'Invalid NHIS Number. Must be exactly 8 digits.' };
      }
      return { isValid: true };
    case 3:
      if (!formData.identityType || !formData.identityNumber || !formData.identityExpiryDate) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      const type = String(formData.identityType || '').toLowerCase().replace(/\s+/g, '-');
      if ((type === 'national-id' || type === 'ghana-card') && !validateGhanaCard(formData.identityNumber)) {
        return { isValid: false, error: 'Invalid National ID / Ghana Card PIN format. Expected format: GHA-123456789-0.' };
      }
      if (type === 'passport' && !validatePassport(formData.identityNumber)) {
        return { isValid: false, error: 'Invalid Passport number format. Expected 1 or 2 letters followed by 6 or 7 digits.' };
      }
      if (type === 'voter-id' && !validateVoterId(formData.identityNumber)) {
        return { isValid: false, error: 'Invalid Voter ID format. Must be exactly 10 digits.' };
      }
      if (type === 'driver-license' && !validateDriverLicense(formData.identityNumber)) {
        return { isValid: false, error: 'Invalid Driver License format. Must be 8-16 alphanumeric characters.' };
      }
      return { isValid: true };
    case 4:
      if (!formData.fatherDetails.firstName || !formData.fatherDetails.lastName || !formData.fatherDetails.occupation || !formData.fatherDetails.phone || !formData.fatherDetails.identityType || !formData.fatherDetails.identityNumber) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      const fType = String(formData.fatherDetails.identityType || '').toLowerCase().replace(/\s+/g, '-');
      if ((fType === 'national-id' || fType === 'ghana-card') && !validateGhanaCard(formData.fatherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Father's Ghana Card PIN format. Expected format: GHA-123456789-0." };
      }
      if (fType === 'passport' && !validatePassport(formData.fatherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Father's Passport number format. Expected 1 or 2 letters followed by 6 or 7 digits." };
      }
      if (fType === 'voter-id' && !validateVoterId(formData.fatherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Father's Voter ID format. Must be exactly 10 digits." };
      }
      if (fType === 'driver-license' && !validateDriverLicense(formData.fatherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Father's Driver License format. Must be 8-16 alphanumeric characters." };
      }
      return { isValid: true };
    case 5:
      if (!formData.motherDetails.firstName || !formData.motherDetails.lastName || !formData.motherDetails.occupation || !formData.motherDetails.phone || !formData.motherDetails.identityType || !formData.motherDetails.identityNumber) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      const mType = String(formData.motherDetails.identityType || '').toLowerCase().replace(/\s+/g, '-');
      if ((mType === 'national-id' || mType === 'ghana-card') && !validateGhanaCard(formData.motherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Mother's Ghana Card PIN format. Expected format: GHA-123456789-0." };
      }
      if (mType === 'passport' && !validatePassport(formData.motherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Mother's Passport number format. Expected 1 or 2 letters followed by 6 or 7 digits." };
      }
      if (mType === 'voter-id' && !validateVoterId(formData.motherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Mother's Voter ID format. Must be exactly 10 digits." };
      }
      if (mType === 'driver-license' && !validateDriverLicense(formData.motherDetails.identityNumber)) {
        return { isValid: false, error: "Invalid Mother's Driver License format. Must be 8-16 alphanumeric characters." };
      }
      return { isValid: true };
    case 6:
      if (!formData.emergencyContact.firstName || !formData.emergencyContact.lastName || !formData.emergencyContact.relationship || !formData.emergencyContact.phone) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      return { isValid: true };
    case 7:
      if (!formData.class || !formData.admissionNumber) {
        return { isValid: false, error: 'Please fill in all required fields.' };
      }
      return { isValid: true };
    default:
      return { isValid: false, error: 'Unknown step.' };
  }
};

export const emptyStudentForm = () => ({
  firstName: '',
  middleName: '',
  otherNames: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  placeOfBirth: '',
  email: '',
  phone: '',
  address: {
    street: '',
    city: '',
    region: '',
    postalCode: '',
  },
  birthCertificateNumber: '',
  birthCertificateIssueDate: '',
  nhisNumber: '',
  nhisExpiryDate: '',
  identityType: '',
  identityNumber: '',
  identityExpiryDate: '',
  fatherDetails: {
    firstName: '',
    lastName: '',
    occupation: '',
    phone: '',
    email: '',
    address: '',
    identityType: '',
    identityNumber: '',
  },
  motherDetails: {
    firstName: '',
    lastName: '',
    occupation: '',
    phone: '',
    email: '',
    address: '',
    identityType: '',
    identityNumber: '',
  },
  emergencyContact: {
    firstName: '',
    lastName: '',
    relationship: '',
    phone: '',
    address: '',
  },
  class: '',
  admissionNumber: '',
  status: 'active',
});

export const normalizeStudentForForm = (student) => {
  const base = emptyStudentForm();
  const s = student && typeof student === 'object' ? student : {};

  return {
    ...base,
    ...s,
    address: {
      ...base.address,
      ...(s.address && typeof s.address === 'object' ? s.address : {}),
    },
    fatherDetails: {
      ...base.fatherDetails,
      ...(s.fatherDetails && typeof s.fatherDetails === 'object'
        ? s.fatherDetails
        : {}),
    },
    motherDetails: {
      ...base.motherDetails,
      ...(s.motherDetails && typeof s.motherDetails === 'object'
        ? s.motherDetails
        : {}),
    },
    emergencyContact: {
      ...base.emergencyContact,
      ...(s.emergencyContact && typeof s.emergencyContact === 'object'
        ? s.emergencyContact
        : {}),
    },
  };
};
