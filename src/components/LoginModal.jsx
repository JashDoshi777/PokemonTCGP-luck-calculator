import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './LoginModal.css';

const LoginModal = ({ onClose }) => {
  const { login, register } = useAppContext();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-container" onClick={e => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        
        <div className="login-modal-header">
          <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <p>{isLogin ? 'Access your cloud collection' : 'Save your collection to the cloud'}</p>
        </div>

        <div className="login-modal-body">
          {error && <div className="auth-error-msg">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="apple-input-group">
              <input 
                type="text" 
                className="apple-input" 
                placeholder="Username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="apple-input-group" style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="apple-input" 
                placeholder="Password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: '50px' }}
                required
              />
              <button 
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <button type="submit" className="apple-btn-primary" disabled={isLoading}>
              {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="login-modal-toggle">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
