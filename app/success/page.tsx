'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SuccessPage() {
  const [courseName, setCourseName] = useState<string>('Your Course');
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [showSupportPopup, setShowSupportPopup] = useState(false);

  const [customerName, setCustomerName] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);

  // 1) Read URL params and, if needed, fetch WhatsApp link + customer name from Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const course = params.get('course');
    const wa = params.get('whatsapp');          // community link if checkout sent it
    const paymentLinkId = params.get('pl');     // payment_link_id if you choose to pass it

    if (course) setCourseName(course);
    if (wa) {
      setWhatsappLink(wa);
    }

    // If we already have a WhatsApp link from URL, no need to touch Supabase
    if (wa || !paymentLinkId) return;

    // Try to fetch latest WhatsApp link + customer name using payment_link_id
    (async () => {
      const { data: link, error } = await supabase
        .from('payment_links')
        .select('customer_name, course_id, course_name, courses!inner(whatsapp_community_link)')
        .eq('id', paymentLinkId)
        .single();

      if (error || !link) {
        console.error('Failed to fetch link/course for success page:', error);
        setShowSupportPopup(true);
        return;
      }

      setCustomerName(link.customer_name || null);
      setCourseId(link.course_id || null);
      setCourseName(link.course_name || course || 'Your Course');

      // Prefer course table whatsapp_community_link if available
      const courseWhatsapp =
        (link as any).courses?.whatsapp_community_link || null;

      if (courseWhatsapp) {
        setWhatsappLink(courseWhatsapp);
      } else {
        // No community link in DB → show support popup
        setShowSupportPopup(true);
      }
    })();
  }, []);

  // 2) Auto redirect only when we HAVE a community link and no error popup
  useEffect(() => {
    if (!whatsappLink || showSupportPopup) return;

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
  }, [whatsappLink, showSupportPopup]);

  const supportNumber = '917303314367'; // 91 + 7303314367, no plus, no spaces
  const supportDisplayNumber = '+91 7303314367';

  const supportMessage = encodeURIComponent(
    `Hi, my name is ${customerName || '[Your Name]'}, I enrolled for ${
      courseName || '[Course Name]'
    }`
  );

  const supportWhatsAppLink = `https://wa.me/${supportNumber}?text=${supportMessage}`; // [web:333][web:338][web:341]

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f0fdf4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          padding: '48px 32px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Main success content (unchanged) */}
        <div
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#10b981',
            borderRadius: '50%',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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

        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#065f46',
            marginBottom: '12px',
          }}
        >
          Payment Successful! 🎉
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          Thank you for your payment! You&apos;re now enrolled in
        </p>

        <div
          style={{
            backgroundColor: '#f9fafb',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        >
          <p
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px',
            }}
          >
            {courseName}
          </p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Access your course materials and community
          </p>
        </div>

        {/* Community CTA: only show normal section if we have a link and no error */}
        {!showSupportPopup && whatsappLink && (
          <div
            style={{
              backgroundColor: '#dcfce7',
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '2px solid #86efac',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#065f46',
                marginBottom: '12px',
              }}
            >
              🚀 Join Our WhatsApp Community
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#166534',
                marginBottom: '16px',
              }}
            >
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
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              }}
            >
              Join WhatsApp Community →
            </a>
          </div>
        )}

        <p
          style={{
            fontSize: '13px',
            color: '#9ca3af',
            marginTop: '24px',
          }}
        >
          {whatsappLink && !showSupportPopup
            ? `Redirecting to WhatsApp in ${countdown} seconds...`
            : 'We are setting up your access...'}
        </p>

        <p
          style={{
            fontSize: '12px',
            color: '#d1d5db',
            marginTop: '12px',
          }}
        >
          You&apos;ll receive a confirmation email shortly
        </p>

        {/* 3) Support popup overlay when we could not get the course community link */}
        {showSupportPopup && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px 20px',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: '#111827',
                }}
              >
                Community Link Not Available
              </h2>
              <p
                style={{
                  fontSize: '14px',
                  color: '#4b5563',
                  marginBottom: '12px',
                }}
              >
                Kindly refresh the page to get the community link. If the issue
                continues, please contact our support team.
              </p>

              <div
                style={{
                  fontSize: '13px',
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                }}
              >
                <p style={{ marginBottom: '4px', fontWeight: 600 }}>
                  Support Team Details:
                </p>
                <p>📞 Call: 7303314367</p>
                <p>💬 WhatsApp: {supportDisplayNumber}</p>
                <p>📅 Working Days: Tuesday to Sunday</p>
                <p>🕚 Support Hours: 11:30 AM – 8:00 PM</p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'flex-end',
                  marginTop: '8px',
                }}
              >
                <button
                  onClick={handleRefresh}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#111827',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Refresh Page
                </button>

                <a
                  href={supportWhatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#25D366',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Contact Support (WhatsApp)
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
