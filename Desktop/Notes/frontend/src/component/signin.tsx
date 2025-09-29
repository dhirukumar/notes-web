import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import icon from '../assets/icon.png';
import backgroundImage from '../assets/right-column.png';
import {API_URL} from './backendurl.tsx'

interface SignInFormData {
  email: string;
  otp: string;
}

interface FormErrors {
  email?: string;
  otp?: string;
}

const Signin: React.FC = () => {
  const [formData, setFormData] = useState<SignInFormData>({
    email: '',
    otp: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showOtpField, setShowOtpField] = useState<boolean>(false);
  const [showOtp, setShowOtp] = useState<boolean>(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState<boolean>(false);
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
  };

  const validateEmail = (): boolean => {
    const newErrors: FormErrors = {};

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

  const validateOtp = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.otp.trim()) {
      newErrors.otp = 'OTP is required';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'OTP must be 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGetOtp = async (): Promise<void> => {
    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/signin`, {
        email: formData.email
      });
      
      if (response.status === 200) {
        setShowOtpField(true);
      }
    } catch (error: any) {
      console.error('Get OTP error:', error);
      
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Failed to send OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    setIsResending(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/signin/resend`, {
        email: formData.email
      });
      
      if (response.status === 200) {
        alert('New OTP sent to your email!');
        setFormData(prev => ({ ...prev, otp: '' }));
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Failed to resend OTP. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleSignIn = async (): Promise<void> => {
    if (!validateOtp()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/signin/verify`, {
        email: formData.email,
        otp: formData.otp,
        keepLoggedIn: keepLoggedIn
      });
      
      if (response.status === 200) {
        const { token, user } = response.data;
        
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      if (error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert('Invalid OTP. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = (): void => {
    navigate('/signup');
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
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Sign in</h1>
            <p className="text-gray-600">Please login to continue to your account.</p>
          </div>

          <div className="space-y-4">
            {/* Email Input */}
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

            {/* OTP Input - Only shown after email is validated */}
            {showOtpField && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  OTP
                </label>
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

            {/* Resend OTP Link */}
            {showOtpField && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-blue-600 hover:text-blue-700 hover:underline font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Resending...' : 'Resend OTP'}
                </button>
              </div>
            )}

            {/* Keep me logged in checkbox */}
            {showOtpField && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="keepLoggedIn"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
                <label htmlFor="keepLoggedIn" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
                  Keep me logged in
                </label>
              </div>
            )}

            {/* Main Action Button */}
            <button
              type="button"
              onClick={showOtpField ? handleSignIn : handleGetOtp}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-lg font-semibold text-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" />
                  {showOtpField ? 'Signing in...' : 'Sending OTP...'}
                </>
              ) : (
                showOtpField ? 'Sign in' : 'Get OTP'
              )}
            </button>
          </div>

          {/* Create Account Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              Need an account?{' '}
              <button
                type="button"
                onClick={handleCreateAccount}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Create one
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Background Image (Hidden on mobile) */}
      <div className="hidden lg:block w-1/2 relative h-screen">
  <div className="absolute inset-0">
    <img 
      src={backgroundImage} 
      alt="Blue abstract background"
      className="w-full h-full object-cover rounded-l-3xl"
    />
  </div>
</div>

    </div>
  );
};

export default Signin;