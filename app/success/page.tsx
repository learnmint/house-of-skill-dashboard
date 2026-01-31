'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);

  // Get WhatsApp community link from URL params (you'll pass this from checkout)
  const whatsappLink = searchParams.get('whatsapp') || 'https://chat.whatsapp.com/YOUR_DEFAULT_COMMUNITY_LINK';
  const courseName = searchParams.get('course') || 'Ultimate Dropshipping by Parth';

  useEffect(() => {
    // Auto-redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = whatsappLink;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [whatsappLink]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0fdf4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        padding: '48px 32px',
        textAlign: 'center'
      }}>
        {/* Success Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scaleIn 0.5s ease-out'
        }}>
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="white" 
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#065f46',
          marginBottom: '12px'
        }}>
          Payment Successful! 🎉
        </h1>

        <p style={{
          fontSize: '18px',
          color: '#6b7280',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          Thank you for your payment! You&apos;re now enrolled in
        </p>

        <div style={{
          backgroundColor: '#f9fafb',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '32px'
        }}>
          <p style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '8px'
          }}>
            {courseName}
          </p>
          <p style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            Access your course materials and community
          </p>
        </div>

        {/* WhatsApp Community Section */}
        <div style={{
          backgroundColor: '#dcfce7',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '2px solid #86efac'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#065f46',
            marginBottom: '12px'
          }}>
            🚀 Join Our WhatsApp Community
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#166534',
            marginBottom: '16px'
          }}>
            Connect with fellow students, get updates, and access exclusive content!
          </p>
          
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              backgroundColor: '#25D366',
              color: 'white',
              padding: '14px 28px',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#20ba5a';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#25D366';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)';
            }}
          >
            Join WhatsApp Community →
          </a>
        </div>

        {/* Auto-redirect countdown */}
        <p style={{
          fontSize: '13px',
          color: '#9ca3af',
          marginTop: '24px'
        }}>
          Redirecting to WhatsApp in {countdown} seconds...
        </p>

        <p style={{
          fontSize: '12px',
          color: '#d1d5db',
          marginTop: '12px'
        }}>
          You&apos;ll receive a confirmation email shortly
        </p>
      </div>

      <style>{`
        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
