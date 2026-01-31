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
  course_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  pitched_amount: number;
  link_amount: number;
  status: string;
}

interface Course {
  id: string;
  name: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const params = useParams();
  const id = params.id as string;
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);
  const [courseName, setCourseName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Editable form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  useEffect(() => {
    fetchPaymentLink();
  }, [id]);

  const fetchPaymentLink = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      console.log('✅ Fetched payment link data:', data);
      
      setPaymentLink(data);
      console.log('💰 Link Amount:', data.link_amount, 'Pitched Amount:', data.pitched_amount);

      // Pre-fill the form with existing data
      setCustomerName(data.customer_name || '');
      setCustomerPhone(data.customer_phone || '');
      setCustomerEmail(data.customer_email || '');

      // Fetch course name
      if (data.course_id) {
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('name')
          .eq('id', data.course_id)
          .single();

        if (courseError) {
          console.error('❌ Error fetching course:', courseError);
          setCourseName('Unknown Course');
        } else {
          console.log('✅ Fetched course data:', courseData);
          setCourseName(courseData.name);
        }
      }
    } catch (err: any) {
      console.error('❌ Error fetching payment link:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentLink) return;

    // Validate inputs
    if (!customerName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!customerPhone.trim()) {
      alert('Please enter your phone number');
      return;
    }
    if (!customerEmail.trim()) {
      alert('Please enter your email');
      return;
    }

    try {
      console.log('🔵 Initiating payment for:', paymentLink.id);

      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_link_id: paymentLink.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to create payment order');
      }

      const { orderId, amount, currency, keyId } = await response.json();

      console.log('✅ Order created:', { orderId, amount, currency, keyId });

      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK not loaded. Please refresh the page.');
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'Academy',
        description: `Course ID: ${paymentLink.course_id}`,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: '#3399cc',
        },
        handler: async function (response: any) {
  console.log('✅ Payment successful:', response);
  
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
    // Redirect to success page with course details and WhatsApp link
    const whatsappLink = 'https://chat.whatsapp.com/YOUR_COMMUNITY_LINK'; // ← Replace with actual link
    const params = new URLSearchParams({
      course: courseName,
      whatsapp: whatsappLink
    });
    window.location.href = `/success?${params.toString()}`;
  } else {
    alert('Payment verification failed. Please contact support.');
  }
},

        modal: {
          ondismiss: function () {
            console.log('⚠️ Payment modal closed');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        console.error('❌ Payment failed:', response.error);
        alert(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
      
    } catch (err: any) {
      console.error('❌ Payment error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Calculate balance amount
  const balanceAmount = paymentLink 
    ? (paymentLink.pitched_amount || 0) - (paymentLink.link_amount || 0)
    : 0;

  if (loading) {
    return (
      <>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
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
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{
            textAlign: 'center',
            backgroundColor: 'white',
            padding: '32px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: '#dc2626', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Error</p>
            <p style={{ color: '#6b7280' }}>{error || 'Payment link not found'}</p>
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
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '48px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '40px'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '8px',
            color: '#2563eb'
          }}>
            Academy
          </h1>

          <p style={{
            textAlign: 'center',
            color: '#6b7280',
            marginBottom: '40px',
            fontSize: '14px'
          }}>
            Secure Checkout
          </p>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '24px',
              color: '#1f2937'
            }}>
              Payment Details
            </h2>
            
            {/* Course Name (Read-only) */}
            <div style={{ 
              marginBottom: '20px',
              paddingBottom: '20px',
              borderBottom: '1px solid #f3f4f6'
            }}>
              <p style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                marginBottom: '6px',
                fontWeight: '500'
              }}>
                Course
              </p>
              <p style={{ 
                fontWeight: '600', 
                color: '#1f2937',
                fontSize: '16px'
              }}>
                {courseName}
              </p>
            </div>

            {/* Customer Name (Editable) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                marginBottom: '8px',
                display: 'block',
                fontWeight: '500'
              }}>
                Your Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter your full name"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Customer Phone (Editable) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                marginBottom: '8px',
                display: 'block',
                fontWeight: '500'
              }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter your phone number"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Customer Email (Editable) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                marginBottom: '8px',
                display: 'block',
                fontWeight: '500'
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter your email"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>

          {/* Amount Breakdown Box */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '24px'
          }}>
            {/* Pitched Amount */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Final Course Fee:
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#374151'
              }}>
                ₹{paymentLink.pitched_amount?.toFixed(2) || '0.00'}
              </span>
            </div>

            {/* Link Amount (To Pay) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '14px', 
                color: '#6b7280',
                fontWeight: '500'
              }}>
                Pay Now:
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#2563eb'
              }}>
                ₹{paymentLink.link_amount?.toFixed(2) || '0.00'}
              </span>
            </div>

            {/* Balance Amount */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '12px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Balance Amount:
              </span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: 'bold',
                color: '#f97316'
              }}>
                ₹{balanceAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Total Amount to Pay */}
          <div style={{
            borderTop: '2px solid #e5e7eb',
            paddingTop: '24px',
            marginBottom: '32px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#374151' 
              }}>
                Total Amount
              </span>
              <span style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: '#2563eb'
              }}>
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
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(37, 99, 235, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(37, 99, 235, 0.2)';
            }}
          >
            Pay ₹{paymentLink.link_amount?.toFixed(2) || '0.00'}
          </button>

          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '20px'
          }}>
            🔒 Secured by Razorpay • Your payment information is encrypted
          </p>
        </div>
      </div>
    </>
  );
}
