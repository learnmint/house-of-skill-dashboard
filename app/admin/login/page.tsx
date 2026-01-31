'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin/courses');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid password');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: '320px',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ fontSize: '20px', marginBottom: '16px' }}>Admin login</h1>

        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
          Admin password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            marginBottom: '12px',
          }}
        />

        {error && (
          <p style={{ color: 'red', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#16a34a',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}
