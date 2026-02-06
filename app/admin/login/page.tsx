'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Premium cursor-reactive effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      setMousePos({ x: e.clientX, y: e.clientY });
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) * 0.03;
      const rotateY = (centerX - x) * 0.03;
      
      if (formRef.current) {
        formRef.current.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      }
    };

    const handleMouseLeave = () => {
      if (formRef.current) {
        formRef.current.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      if (rememberMe) {
        try {
          localStorage.setItem('adminRememberMe', 'true');
        } catch (e) {}
      }
      router.push('/admin/courses');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid password');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setError('Please enter your email');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (res.ok) {
        setSuccess('Password reset link sent to your email');
        setForgotEmail('');
        setTimeout(() => setShowForgotPassword(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to send reset link');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '20px',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Animated gradient orbs */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '-150px',
          left: '-150px',
          animation: 'float 25s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          bottom: '-100px',
          right: '-100px',
          animation: 'float 30s ease-in-out infinite reverse',
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-40px) translateX(0px); }
          75% { transform: translateY(-20px) translateX(-10px); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input::placeholder {
          color: rgba(226, 232, 240, 0.4);
        }
      `}</style>

      {/* Left side - Branding and info */}
      <div
        style={{
          position: 'absolute',
          left: '60px',
          top: '60px',
          color: 'white',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>
          House of Skill
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(226, 232, 240, 0.6)', margin: '4px 0 0 0' }}>
          Admin Dashboard
        </p>
      </div>

      {/* Main form container */}
      <form
        ref={formRef}
        onSubmit={showForgotPassword ? handleForgotPassword : handleSubmit}
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '56px 48px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 1,
          animation: 'slideDown 0.6s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)',
          }}>
            <span style={{ fontSize: '32px' }}>🔐</span>
          </div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'white',
            margin: '0 0 8px 0',
            letterSpacing: '-0.5px',
          }}>
            {showForgotPassword ? 'Reset Password' : 'Secure Login'}
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'rgba(226, 232, 240, 0.6)',
            margin: 0,
          }}>
            {showForgotPassword ? 'Enter your email to receive a reset link' : 'Access your admin dashboard'}
          </p>
        </div>

        {/* Form fields */}
        {showForgotPassword ? (
          <>
            {/* Email input for forgot password */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(226, 232, 240, 0.8)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                📧 Email Address
              </label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
                placeholder="admin@company.com"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: focusedInput === 'email' ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(226, 232, 240, 0.05)',
                  color: 'white',
                  fontSize: '14px',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box',
                  boxShadow: focusedInput === 'email' ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                }}
              />
            </div>

            {/* Error/Success messages */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '24px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '24px',
                color: '#86efac',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ✅ {success}
              </div>
            )}

            {/* Send button */}
            <button
              type="submit"
              disabled={forgotLoading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: forgotLoading 
                  ? 'rgba(99,102,241,0.5)' 
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 700,
                cursor: forgotLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                opacity: forgotLoading ? 0.8 : 1,
                marginBottom: '12px',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={(e) => {
                if (!forgotLoading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(99, 102, 241, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)';
              }}
            >
              {forgotLoading ? '⏳ Sending...' : '📤 Send Reset Link'}
            </button>

            {/* Back to login */}
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setSuccess('');
                setForgotEmail('');
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(226, 232, 240, 0.8)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(226, 232, 240, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(226, 232, 240, 0.8)';
              }}
            >
              ← Back to Login
            </button>
          </>
        ) : (
          <>
            {/* Password input */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(226, 232, 240, 0.8)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                🔑 Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                placeholder="Enter your secure password"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: focusedInput === 'password' ? '2px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(226, 232, 240, 0.05)',
                  color: 'white',
                  fontSize: '14px',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box',
                  boxShadow: focusedInput === 'password' ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
                }}
              />
            </div>

            {/* Remember me checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '24px',
              gap: '10px',
            }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#6366f1',
                }}
              />
              <label
                htmlFor="rememberMe"
                style={{
                  fontSize: '13px',
                  color: 'rgba(226, 232, 240, 0.7)',
                  cursor: 'pointer',
                }}
              >
                Remember me on this device
              </label>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '24px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Login button */}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                marginBottom: '12px',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(99, 102, 241, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.4)';
              }}
            >
              🚀 Secure Login
            </button>

            {/* Forgot password link */}
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                setError('');
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(99,102,241,0.9)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(99,102,241,1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(99,102,241,0.9)';
              }}
            >
              🔓 Forgot Password?
            </button>
          </>
        )}

        {/* Footer info */}
        <div style={{
          marginTop: '32px',
          padding: '16px 0',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          fontSize: '12px',
          color: 'rgba(226, 232, 240, 0.5)',
        }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
          <span>•</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</a>
          <span>•</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Support</a>
        </div>

        {/* Security badge */}
        <div style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '12px',
          color: 'rgba(34, 197, 94, 0.7)',
        }}>
          🔒 Bank-level security encryption
        </div>
      </form>
    </div>
  );
}
