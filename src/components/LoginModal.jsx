import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useDialog } from '../hooks/useDialog';
import './LoginModal.css';

// Mirrors the server's rules so people get an instant, friendly message.
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;
const MIN_PASSWORD_LENGTH = 8;

const LoginModal = ({ onClose, notice }) => {
  const { login, register } = useAppContext();
  const dialogRef = useDialog(onClose);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    const name = username.trim();
    if (!isLogin) {
      if (!USERNAME_PATTERN.test(name)) {
        setError('Usernames are 3-24 characters: letters, numbers, dots, dashes and underscores.');
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(name, password);
      } else {
        await register(name, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" data-lenis-prevent onClick={onClose}>
      <div
        className="login-modal-container"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="login-modal-header">
          <h2 id="login-modal-title">{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <p>{isLogin ? 'Access your cloud collection' : 'Save your collection to the cloud'}</p>
        </div>

        <div className="login-modal-body">
          {notice && !error && <div className="auth-notice-msg" role="status">{notice}</div>}
          {error && <div className="auth-error-msg" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="apple-input-group">
              <input
                type="text"
                name="username"
                className="apple-input"
                placeholder="Username"
                aria-label="Username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={64}
                value={username}
                onChange={e => setUsername(e.target.value)}
                data-autofocus
                required
              />
            </div>
            <div className="apple-input-group" style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="apple-input"
                placeholder="Password"
                aria-label="Password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                maxLength={72}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: '50px' }}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button type="submit" className="apple-btn-primary" disabled={isLoading}>
              {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="login-modal-toggle">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
