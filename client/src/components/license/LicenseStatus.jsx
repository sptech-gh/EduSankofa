import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

const LicenseStatus = () => {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showActivation, setShowActivation] = useState(false);

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/license/status');
      
      if (response.success) {
        setLicenseInfo(response.data);
        setError(null);
      } else {
        setError(response.error?.message || 'Failed to check license status');
      }
    } catch (err) {
      setError('Network error checking license status');
      console.error('License status check error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = () => {
    setShowActivation(true);
  };

  const getLicenseStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'grace_period':
        return 'text-yellow-600';
      case 'expired':
        return 'text-red-600';
      case 'suspended':
        return 'text-red-800';
      default:
        return 'text-gray-600';
    }
  };

  const getLicenseStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'grace_period':
        return 'Grace Period';
      case 'expired':
        return 'Expired';
      case 'suspended':
        return 'Suspended';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !licenseInfo) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-800">License Error</h3>
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={handleActivateLicense}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Activate License
        </button>
      </div>
    );
  }

  if (!licenseInfo?.license) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-yellow-800">No License Found</h3>
        </div>
        <p className="text-yellow-700 mb-4">
          This system requires a valid license to operate. Please activate your license to continue.
        </p>
        <button
          onClick={handleActivateLicense}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Activate License
        </button>
      </div>
    );
  }

  const { license, validation, deploymentMode } = licenseInfo;
  const isExpired = validation.status === 'expired';
  const isInGracePeriod = validation.status === 'grace_period';
  const daysUntilExpiry = validation.daysUntilExpiry;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold text-gray-900">License Status</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLicenseStatusColor(validation.status)} bg-gray-100`}>
          {getLicenseStatusText(validation.status)}
        </span>
      </div>

      {/* License Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">License Details</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600">School Name:</dt>
              <dd className="font-medium">{license.schoolName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Deployment Type:</dt>
              <dd className="font-medium capitalize">{license.deploymentType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Max Users:</dt>
              <dd className="font-medium">{license.maxUsers}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Current Users:</dt>
              <dd className="font-medium">{license.currentUsers || 0}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Expiry Information</h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600">Expiry Date:</dt>
              <dd className="font-medium">
                {new Date(license.expiryDate).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Days Until Expiry:</dt>
              <dd className={`font-medium ${daysUntilExpiry <= 7 ? 'text-red-600' : daysUntilExpiry <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                {daysUntilExpiry > 0 ? `${daysUntilExpiry} days` : 'Expired'}
              </dd>
            </div>
            {isInGracePeriod && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Grace Period:</dt>
                <dd className="font-medium text-yellow-600">
                  {license.gracePeriodDays} days remaining
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Warning Messages */}
      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-red-800 font-semibold">License Expired</h4>
          </div>
          <p className="text-red-700 mt-2">
            Your license has expired. Please renew your license to continue using the system.
          </p>
        </div>
      )}

      {isInGracePeriod && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h4 className="text-yellow-800 font-semibold">Grace Period Active</h4>
          </div>
          <p className="text-yellow-700 mt-2">
            Your license has expired but you are in a grace period. Please renew your license soon.
          </p>
        </div>
      )}

      {daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-blue-800 font-semibold">License Expiring Soon</h4>
          </div>
          <p className="text-blue-700 mt-2">
            Your license will expire in {daysUntilExpiry} days. Consider renewing soon.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={checkLicenseStatus}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Refresh Status
        </button>
        
        {(isExpired || isInGracePeriod || !license) && (
          <button
            onClick={handleActivateLicense}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            {isExpired ? 'Renew License' : 'Activate License'}
          </button>
        )}
      </div>

      {/* Activation Modal */}
      {showActivation && (
        <LicenseActivationModal
          onClose={() => setShowActivation(false)}
          onSuccess={checkLicenseStatus}
        />
      )}
    </div>
  );
};

const LicenseActivationModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    schoolName: '',
    licenseKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.schoolName || !formData.licenseKey) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.post('/license/activate', formData);
      
      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error?.message || 'Activation failed');
      }
    } catch (err) {
      setError('Network error during activation');
      console.error('License activation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex justify-between items-center p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Activate License</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-2">
                School Name
              </label>
              <input
                type="text"
                id="schoolName"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your school name"
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700 mb-2">
                License Key
              </label>
              <textarea
                id="licenseKey"
                name="licenseKey"
                value={formData.licenseKey}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your license key"
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LicenseStatus;
