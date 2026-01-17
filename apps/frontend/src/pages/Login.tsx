import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Zap, Loader2 } from 'lucide-react';
import { useState } from 'react';

export function Login() {
  const { login, authEnabled, googleClientId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError('No credential received from Google');
      return;
    }

    try {
      setIsLoggingIn(true);
      setError(null);
      await login(response.credential);
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  if (!authEnabled || !googleClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Energy Controller</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Authentication not configured</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in your environment variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Energy Controller</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Octopus Agile Smart Home Automation</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">
            Sign in to continue
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-center">
            {isLoggingIn ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Your devices, schedules, and settings will be saved to your account.
        </p>
      </div>
    </div>
  );
}
