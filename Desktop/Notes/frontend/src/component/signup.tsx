import React, { useState } from 'react';
import { Calendar, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import icon from "../assets/icon.png";
import rightimage from "../assets/right-column.png";
import {API_URL} from './backendurl.tsx'

interface FormData {
  name: string;
  dateOfBirth: string;
  email: string;
  otp: string;
}

interface FormErrors {
  name?: string;
  dateOfBirth?: string;
  email?: string;
  otp?: string;
}

const Signup: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    dateOfBirth: '',
    email: '',
    otp: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showOtpField, setShowOtpField] = useState<boolean>(false);
  const [showOtp, setShowOtp] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>('');
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
    
    // Clear API error when user starts typing
    if (apiError) {
      setApiError('');
    }
  };

  const validateInitialForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
        ? age - 1 
        : age;
      
      if (actualAge < 1) {
        newErrors.dateOfBirth = 'You must be at least 13 years old';
      } else if (actualAge > 120 || birthDate > today) {
        newErrors.dateOfBirth = 'Please enter a valid date of birth';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtpForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.otp.trim()) {
      newErrors.otp = 'OTP is required';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'OTP must be 6 digits';
    } else if (!/^\d{6}$/.test(formData.otp)) {
      newErrors.otp = 'OTP must contain only numbers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGetOtp = async (): Promise<void> => {
    if (!validateInitialForm()) {
      return;
    }
  
    setIsLoading(true);
    setApiError('');
    
    try {
      console.log('API URL:', API_URL);
      console.log('Sending request to:', `${API_URL}/api/signup`);
      console.log('Request data:', {
        name: formData.name,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth
      });

      
      const response = await axios.post(`${API_URL}/api/signup`, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        dateOfBirth: formData.dateOfBirth
      }, {
        timeout: 30000, 
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
     
      
      if (response.status === 200 || response.status === 201) {
        setShowOtpField(true);
        setApiError('');
        // alert('OTP sent to your email! Please check your inbox and spam folder.');
      }
    } catch (error: any) {
      console.error('Get OTP error:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.response) {
        // Server responded with error status
        console.error('Error response:', error.response);
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
        
        if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else {
          switch (error.response.status) {
            case 400:
              errorMessage = 'Invalid request. Please check your information.';
              break;
            case 409:
              errorMessage = 'Email already exists. Please use a different email or sign in.';
              break;
            case 422:
              errorMessage = 'Invalid data provided. Please check your information.';
              break;
            case 429:
              errorMessage = 'Too many requests. Please wait a moment and try again.';
              break;
            case 500:
              errorMessage = 'Server error. Please try again later.';
              break;
            default:
              errorMessage = `HTTP Error ${error.response.status}: ${error.response.statusText || 'Unknown error'}`;
          }
        }
      } else if (error.request) {
        // Network error
        console.error('Network error:', error.request);
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        console.error('Error message:', error.message);
        errorMessage = error.message || 'Something went wrong. Please try again.';
      }
      
      setApiError(errorMessage);
      // alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (): Promise<void> => {
    if (!validateOtpForm()) {
      return;
    }

    setIsLoading(true);
    setApiError('');
    
    try {
      const response = await axios.post(`${API_URL}/api/signup/verify`, {
        email: formData.email.trim().toLowerCase(),
        otp: formData.otp.trim()
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Verify response:', response);
      
      if (response.status === 200 || response.status === 201) {
        const { token, user } = response.data;
        
        // Store token in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // alert('Signup successful! Welcome to HD!');
        
        // Navigate to dashboard or home page
        navigate('/dashboard'); // or '/dashbord' if you keep the typo
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid OTP. Please check and try again.';
      } else if (error.response?.status === 410) {
        errorMessage = 'OTP has expired. Please request a new one.';
      }
      
      setApiError(errorMessage);
      // alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInClick = (): void => {
    console.log('Navigate to sign in');
    navigate('/signin');
  };

  const handleResendOtp = async (): Promise<void> => {
    await handleGetOtp();
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* HD Logo - Top Left */}
      <div className="absolute top-6 left-6 z-20">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2">
            <img src={icon} alt="Logo" className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-gray-800">HD</span>
        </div>
      </div>

      {/* Left side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Sign up</h1>
            <p className="text-gray-600">Sign up to enjoy the feature of HD</p>
          </div>

          {/* API Error Display */}
          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-red-700 text-sm">{apiError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Jonas Khanwald"
                disabled={showOtpField}
                className={`w-full px-4 py-3 rounded-lg border border-gray-300 transition-colors ${
                  showOtpField ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                } ${
                  errors.name ? 'border-red-300' : ''
                } outline-none text-gray-900 placeholder-gray-500`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={showOtpField}
                  className={`w-full px-4 py-3 rounded-lg border border-gray-300 transition-colors ${
                    showOtpField ? 'bg-gray-100 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  } ${
                    errors.dateOfBirth ? 'border-red-300' : ''
                  } outline-none text-gray-900`}
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {errors.dateOfBirth && (
                <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="jonas_kahnwald@gmail.com"
                disabled={showOtpField}
                className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                  showOtpField ? 'bg-gray-100 cursor-not-allowed border-gray-300' : 'border-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                } ${
                  errors.email ? 'border-red-300' : ''
                } outline-none text-gray-900 placeholder-gray-500`}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {showOtpField && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                    OTP
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-xs text-blue-600 hover:text-blue-700 disabled:text-blue-400 transition-colors"
                  >
                    Resend OTP
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showOtp ? 'text' : 'password'}
                    id="otp"
                    name="otp"
                    value={formData.otp}
                    onChange={handleInputChange}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className={`w-full px-4 py-3 pr-12 rounded-lg border border-blue-400 transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.otp ? 'border-red-300' : ''
                    } outline-none text-gray-900 placeholder-gray-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOtp(!showOtp)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showOtp ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.otp && (
                  <p className="text-red-500 text-xs mt-1">{errors.otp}</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={showOtpField ? handleSignup : handleGetOtp}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-lg font-semibold text-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" />
                  {showOtpField ? 'Signing up...' : 'Sending OTP...'}
                </>
              ) : (
                showOtpField ? 'Sign up' : 'Get OTP'
              )}
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <button
                type="button"
                onClick={handleSignInClick}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Background Image (Hidden on mobile) */}
      <div className="hidden lg:block w-1/2 relative h-screen">
  <div className="absolute inset-0">
    <img 
      src={rightimage} 
      alt="Blue abstract background"
      className="w-full h-full object-cover rounded-l-3xl"
    />
  </div>
</div>

    </div>
  );
};

export default Signup;