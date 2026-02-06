'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PaymentLink {
  id: string;
  course_id: string | null;
  course_name: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  pitched_amount: number;
  link_amount: number;
  status: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const params = useParams();
  // route file is app/checkout/[id]/page.tsx — param name is `id`
  const code = params.id as string; // this may be a UUID (id) or a short_code

  const [paymentLinkId, setPaymentLinkId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [courseName, setCourseName] = useState<string>('Loading...');
  const [whatsappLink, setWhatsappLink] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const trackJourneyEvent = async (eventType: string, eventData: any = {}) => {
    try {
      await supabase.from('payment_events').insert({
        payment_link_id: paymentLinkId, // can be null for very first events
        event_type: eventType,
        event_data: eventData,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error tracking journey event:', err);
    }
  };

  const fetchPaymentLink = async () => {
    try {
      // decide whether the value in the URL is a UUID (id) or a short_code
      const isUUID = (s: string) =>
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
          s
        );

      const field = isUUID(code) ? 'id' : 'short_code';

      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq(field, code)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Payment link not found');

      // set main state
      setPaymentLink(data as PaymentLink);
      setPaymentLinkId(data.id);
      setCustomerName(data.customer_name || '');
      setCustomerPhone(data.customer_phone || '');
      setCustomerEmail(data.customer_email || '');
      setCourseName(data.course_name || 'Unknown Course');

      // log checkout opened once we know the real id
      await trackJourneyEvent('checkout_opened', {
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        timestamp: new Date().toISOString(),
      });

      // if already paid, redirect to success
      if (data.status === 'paid' || data.status === 'fully_paid') {
        let finalCourseName = data.course_name || 'Unknown Course';
        let courseWhatsapp = '';

        if (data.course_id) {
          const { data: courseData } = await supabase
            .from('courses')
            .select('name, whatsapp_community_link')
            .eq('id', data.course_id)
            .single();

          if (courseData) {
            finalCourseName = courseData.name || finalCourseName;
            courseWhatsapp = courseData.whatsapp_community_link || '';
          }
        }

        const params = new URLSearchParams({
          course: finalCourseName,
          whatsapp: courseWhatsapp || '',
          pl: data.id, // payment_link_id
        });

        window.location.href = `/success?${params.toString()}`;
        return;
      }

      // always fetch latest WhatsApp community link from courses
      if (data.course_id) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('name, whatsapp_community_link')
          .eq('id', data.course_id)
          .single();

        if (courseError || !courseData) {
          console.error('Error fetching course:', courseError);
          setCourseName(data.course_name || 'Unknown Course');
          setWhatsappLink('');
        } else {
          setCourseName(
            courseData.name || data.course_name || 'Unknown Course'
          );
          setWhatsappLink(courseData.whatsapp_community_link || '');
        }
      } else {
        setCourseName(data.course_name || 'Unknown Course');
        setWhatsappLink('');
      }
    } catch (err: any) {
      console.error('Error fetching payment link:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!code) return;
    fetchPaymentLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handlePayment = async () => {
    if (!paymentLink) return;

    if (!customerName.trim()) {
      alert('Please enter your name');
      trackJourneyEvent('form_validation_failed', { missing_field: 'name' });
      return;
    }
    if (!customerPhone.trim()) {
      alert('Please enter your phone number');
      trackJourneyEvent('form_validation_failed', { missing_field: 'phone' });
      return;
    }
    if (!customerEmail.trim()) {
      alert('Please enter your email');
      trackJourneyEvent('form_validation_failed', { missing_field: 'email' });
      return;
    }

    trackJourneyEvent('payment_button_clicked', {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      amount: paymentLink.link_amount,
    });

    try {
      const { error: updateError } = await supabase
        .from('payment_links')
        .update({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
        })
        .eq('id', paymentLink.id);

      if (updateError) {
        console.error('Failed to update customer details:', updateError);
      }

      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_link_id: paymentLink.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const { orderId, amount, currency, keyId } = await response.json();

      trackJourneyEvent('razorpay_order_created', {
        order_id: orderId,
        amount,
        currency,
      });

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'House of Skill',
        description: `Course: ${courseName}`,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: { color: '#3399cc' },
        handler: async function (response: any) {
          await trackJourneyEvent('payment_success_handler', {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });

          const verifyResponse = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payment_link_id: paymentLink.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            const params = new URLSearchParams({
              course: courseName,
              whatsapp: whatsappLink || '',
              pl: paymentLink.id, // payment_link_id
            });

            window.location.href = `/success?${params.toString()}`;
          } else {
            alert('Payment verification failed. Please contact support.');
            trackJourneyEvent('payment_verification_failed', {
              order_id: response.razorpay_order_id,
            });
          }
        },
        modal: {
          ondismiss: function () {
            trackJourneyEvent('payment_modal_closed', {
              order_id: orderId,
              reason: 'user_dismissed',
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        alert(`Payment failed: ${response.error.description}`);
        trackJourneyEvent('payment_failed_event', {
          error_code: response.error.code,
          error_description: response.error.description,
          order_id: orderId,
        });
      });

      rzp.open();
      trackJourneyEvent('payment_gateway_opened', { order_id: orderId });
    } catch (err: any) {
      console.error('Payment error:', err);
      alert(`Error: ${err.message}`);
      trackJourneyEvent('payment_error', {
        error: err.message,
        stack: err.stack,
      });
    }
  };

  const balanceAmount = paymentLink
    ? (paymentLink.pitched_amount || 0) - (paymentLink.link_amount || 0)
    : 0;

  if (loading) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            ></div>
            <p style={{ fontSize: '18px', color: '#6b7280' }}>Loading...</p>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  if (error || !paymentLink) {
    return (
      <>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p
              style={{
                color: '#dc2626',
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '8px',
              }}
            >
              Error
            </p>
            <p style={{ color: '#6b7280' }}>
              {error || 'Payment link not found'}
            </p>
          </div>
        </div>
      </>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as const;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          padding: '48px 16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            margin: '0 auto',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            padding: '40px',
          }}
        >
          <div
            style={{
              backgroundColor: '#22c55e',
              borderRadius: '16px 16px 0 0',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <img
              src="/logo.png"
              alt="House of skill logo"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.03em',
                }}
              >
                House of Skill
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#9db4dd',
                  marginTop: '2px',
                }}
              >
                Secure Checkout Page
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '24px',
                color: '#1f2937',
              }}
            >
              Payment Details
            </h2>

            <div
              style={{
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '6px',
                  fontWeight: '500',
                }}
              >
                Course
              </p>
              <p
                style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '16px',
                }}
              >
                {courseName}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '8px',
                  display: 'block',
                  fontWeight: '500',
                }}
              >
                Your Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '8px',
                  display: 'block',
                  fontWeight: '500',
                }}
              >
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your phone number"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '8px',
                  display: 'block',
                  fontWeight: '500',
                }}
              >
                Email Address *
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter your email"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#f9fafb',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  fontWeight: '500',
                }}
              >
                Final Course Fee:
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                }}
              >
                ₹{paymentLink.pitched_amount?.toFixed(2) || '0.00'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  fontWeight: '500',
                }}
              >
                Pay Now:
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#2563eb',
                }}
              >
                ₹{paymentLink.link_amount?.toFixed(2) || '0.00'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                }}
              >
                Balance Amount:
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#f97316',
                }}
              >
                ₹{balanceAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div
            style={{
              borderTop: '2px solid #e5e7eb',
              paddingTop: '24px',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                }}
              >
                Total Amount
              </span>
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#2563eb',
                }}
              >
                ₹{paymentLink.link_amount?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            style={{
              width: '100%',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '16px',
              borderRadius: '10px',
              fontWeight: '600',
              fontSize: '18px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow =
                '0 6px 12px rgba(37, 99, 235, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 4px 6px rgba(37, 99, 235, 0.2)';
            }}
          >
            Pay ₹{paymentLink.link_amount?.toFixed(2) || '0.00'}
          </button>

          <p
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#9ca3af',
              marginTop: '20px',
            }}
          >
            🔒 Secured by Razorpay • Your payment information is encrypted
          </p>
        </div>
      </div>
    </>
  );
}
