import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const LicenseContext = createContext();

export const useLicense = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
};

export const LicenseProvider = ({ children }) => {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);

  const checkLicenseStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/license/status');
      
      if (response.success) {
        setLicenseInfo(response.data);
        setError(null);
        setLastCheck(new Date());
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

  useEffect(() => {
    checkLicenseStatus();
    
    // Check license status every 5 minutes
    const interval = setInterval(checkLicenseStatus, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const isLicenseValid = () => {
    if (!licenseInfo?.validation) return false;
    const { validation } = licenseInfo;
    return validation.isValid || validation.status === 'grace_period';
  };

  const isLicenseExpired = () => {
    if (!licenseInfo?.validation) return true;
    return licenseInfo.validation.status === 'expired';
  };

  const isInGracePeriod = () => {
    if (!licenseInfo?.validation) return false;
    return licenseInfo.validation.status === 'grace_period';
  };

  const getDaysUntilExpiry = () => {
    if (!licenseInfo?.validation) return 0;
    return licenseInfo.validation.daysUntilExpiry;
  };

  const getUserLimitStatus = () => {
    if (!licenseInfo?.validation) return { current: 0, max: 0, exceeded: false };
    const { currentUsers, maxUsers } = licenseInfo.validation;
    return {
      current: currentUsers,
      max: maxUsers,
      exceeded: currentUsers >= maxUsers
    };
  };

  const canAccessFeature = (feature) => {
    if (!isLicenseValid()) return false;
    if (!licenseInfo?.license?.features) return true; // Default to allowed if no feature restrictions
    
    return licenseInfo.license.features[feature] !== false;
  };

  const getLicenseWarningLevel = () => {
    if (!licenseInfo?.validation) return 'error';
    
    const { status, daysUntilExpiry } = licenseInfo.validation;
    
    if (status === 'expired') return 'error';
    if (status === 'suspended') return 'error';
    if (status === 'grace_period') return 'warning';
    if (daysUntilExpiry <= 7) return 'warning';
    if (daysUntilExpiry <= 30) return 'info';
    return 'success';
  };

  const getLicenseMessage = () => {
    if (!licenseInfo?.validation) return 'License status unknown';
    
    const { status, daysUntilExpiry, message } = licenseInfo.validation;
    
    switch (status) {
      case 'active':
        if (daysUntilExpiry <= 7) {
          return `License expires in ${daysUntilExpiry} days`;
        }
        if (daysUntilExpiry <= 30) {
          return `License expires in ${daysUntilExpiry} days`;
        }
        return 'License is active';
      
      case 'grace_period':
        return `License expired - grace period active`;
      
      case 'expired':
        return 'License has expired';
      
      case 'suspended':
        return 'License is suspended';
      
      default:
        return message || 'License status unknown';
    }
  };

  const value = {
    licenseInfo,
    loading,
    error,
    lastCheck,
    checkLicenseStatus,
    isLicenseValid,
    isLicenseExpired,
    isInGracePeriod,
    getDaysUntilExpiry,
    getUserLimitStatus,
    canAccessFeature,
    getLicenseWarningLevel,
    getLicenseMessage
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};

// HOC for protecting routes
export const withLicenseProtection = (WrappedComponent) => {
  return function LicenseProtectedComponent(props) {
    const { isLicenseValid, isLicenseExpired, isInGracePeriod, getLicenseWarningLevel } = useLicense();

    if (isLicenseExpired()) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md w-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-red-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-red-800 mb-2">License Expired</h2>
              <p className="text-red-700 mb-6">
                Your license has expired. Please renew your license to continue using the system.
              </p>
              <button
                onClick={() => window.location.href = '/license'}
                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                Renew License
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!isLicenseValid()) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md w-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-yellow-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h2 className="text-2xl font-bold text-yellow-800 mb-2">License Required</h2>
              <p className="text-yellow-700 mb-6">
                This system requires a valid license to operate. Please activate your license to continue.
              </p>
              <button
                onClick={() => window.location.href = '/license'}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Activate License
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
};

// Component for displaying license warnings
export const LicenseWarning = () => {
  const { getLicenseWarningLevel, getLicenseMessage, getDaysUntilExpiry, isInGracePeriod } = useLicense();

  const warningLevel = getLicenseWarningLevel();
  const message = getLicenseMessage();
  const daysUntilExpiry = getDaysUntilExpiry();

  if (warningLevel === 'success') return null;

  const getWarningStyles = () => {
    switch (warningLevel) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (warningLevel) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border rounded-lg p-4 mb-6 flex items-center ${getWarningStyles()}`}>
      {getIcon()}
      <span className="ml-2">{message}</span>
      {isInGracePeriod() && (
        <button
          onClick={() => window.location.href = '/license'}
          className="ml-auto bg-white text-current px-3 py-1 rounded border border-current text-sm hover:bg-opacity-80"
        >
          Renew Now
        </button>
      )}
    </div>
  );
};

export default LicenseContext;
