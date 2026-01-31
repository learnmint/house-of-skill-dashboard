"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type CourseOption = {
  id: string;
  name: string;
  max_price: number | null;
  min_price: number | null;
  min_part_payment: number | null;
};

type PaymentLink = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  course_id: string | null;
  course_name: string | null;
  pitched_amount: number | null;
  link_amount: number;
  state: string | null;
  gateway: string;
  status: string;
  gateway_link_url: string | null;      // direct gateway URL (Razorpay/Cashfree/Zoho)
  checkout_link_url?: string | null;    // NEW: your /checkout/[id] URL
  created_at: string;
  discount_amount: number | null;
  balance_amount?: number | null;
  created_by?: string; // 👈 NEW: User ID who created the link
  creator_name?: string; // 👈 NEW: Name of creator (from profiles join)
};

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  // 👇 NEW: Filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [pitchedAmount, setPitchedAmount] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [state, setState] = useState("");
  const [gateway, setGateway] = useState("razorpay");
  const [error, setError] = useState("");
  
const [selectedLinkForJourney, setSelectedLinkForJourney] = useState<string | null>(null);
const [journeyEvents, setJourneyEvents] = useState<any[]>([]);

// Add the fetch function
const fetchPaymentJourney = async (paymentLinkId: string) => {
  const { data, error } = await supabase
    .from('payment_events')
    .select('*')
    .eq('payment_link_id', paymentLinkId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching journey:', error);
    return;
  }

  setJourneyEvents(data || []);
  setSelectedLinkForJourney(paymentLinkId);
};


  const loadCourses = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("id, name, max_price, min_price, min_part_payment")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading courses", error);
      return;
    }

    setCourses(
      (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        max_price: c.max_price ? Number(c.max_price) : null,
        min_price: c.min_price ? Number(c.min_price) : null,
        min_part_payment: c.min_part_payment ? Number(c.min_part_payment) : null,
      }))
    );
  };

  const loadLinks = async () => {
  // 👇 UPDATED: Use full_name instead of name
  let query = supabase
    .from("payment_links")
     .select(`
    id, 
    customer_name, 
    customer_phone, 
    customer_email, 
    course_id, 
    course_name, 
    link_amount, 
    gateway, 
    status, 
    gateway_link_url,      -- gateway direct URL
    checkout_link_url,     -- NEW
    created_at, 
    pitched_amount, 
    discount_amount, 
    state, 
    balance_amount,
    created_by,
    profiles!payment_links_created_by_fkey(full_name)
  `)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  if (filterDateFrom) {
    query = query.gte("created_at", new Date(filterDateFrom).toISOString());
  }

  if (filterDateTo) {
    const endDate = new Date(filterDateTo);
    endDate.setHours(23, 59, 59, 999);
    query = query.lte("created_at", endDate.toISOString());
  }

  if (searchQuery.trim()) {
    query = query.or(
      `customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,customer_email.ilike.%${searchQuery}%`
    );
  }

  query = query.limit(50);

  const { data, error } = await query;

  if (error) {
    console.error(error);
  } else {
    // 👇 Map the joined profile data - use full_name
    const formattedData = (data || []).map((link: any) => ({
      ...link,
      creator_name: link.profiles?.full_name || "Unknown",
    }));
    setLinks(formattedData as PaymentLink[]);
  }
};

  useEffect(() => {
    loadLinks();
    loadCourses();
  }, []);

  // 👇 NEW: Reload when filters change
  useEffect(() => {
    loadLinks();
  }, [filterStatus, filterDateFrom, filterDateTo, searchQuery]);
  useEffect(() => {
  loadLinks();
}, [filterStatus, filterDateFrom, filterDateTo, searchQuery]);


  const handleCreateLink = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    setError("Not logged in");
    setLoading(false);
    return;
  }

  if (!selectedCourseId) {
    setError("Please select a course");
    setLoading(false);
    return;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const maxPrice = selectedCourse?.max_price ?? 0;
  const pitched = pitchedAmount ? Number(pitchedAmount) : 0;
  const linkAmt = Number(linkAmount);

  const discountAmount = Math.max(maxPrice - pitched, 0);
  const balanceAmount = Math.max(pitched - linkAmt, 0);

  // 👇 FIXED: Default status is "link_created" until payment is actually made
  // The status will be updated by webhook when customer pays
  let paymentStatus: string = "link_created";

  const { data: insertData, error: insertError } = await supabase
    .from("payment_links")
    .insert({
      created_by: user.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      course_id: selectedCourse ? selectedCourse.id : null,
      course_name: selectedCourse ? selectedCourse.name : null,
      pitched_amount: pitched || null,
      link_amount: linkAmt,
      state,
      gateway,
      status: paymentStatus,  // 👈 Always "link_created" initially
      discount_amount: discountAmount,
      balance_amount: balanceAmount,
    })
    .select("id")
    .single();

  // ... rest of the code remains same

    if (insertError || !insertData) {
      console.error(insertError);
      setError(insertError?.message || "Insert failed");
      setLoading(false);
      return;
    }

    let razorpayUrl: string | null = null;
    let razorpayId: string | null = null;
    let checkoutPageUrl: string | null = null; // 👈 NEW

    if (gateway === "razorpay") {
      try {
        const res = await fetch("/api/razorpay/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: linkAmt,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            description: selectedCourse ? selectedCourse.name : "Course payment",
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Razorpay create link error:", data);
          setError(data.error || "Failed to create Razorpay link");
        } else {
          razorpayUrl = data.url;
razorpayId = data.id;

// Create checkout page URL
checkoutPageUrl = `${window.location.origin}/checkout/${insertData.id}`;

const { error: updateError } = await supabase
  .from("payment_links")
  .update({
    gateway_link_id: razorpayId,
    gateway_link_url: razorpayUrl,       // direct gateway URL (razorpay)
    checkout_link_url: checkoutPageUrl,  // your hosted checkout page
  })
  .eq("id", insertData.id);

          if (updateError) {
            console.error(updateError);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Error talking to Razorpay");
      }
    }

    // reset form and refresh list
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setSelectedCourseId("");
    setPitchedAmount("");
    setLinkAmount("");
    setState("");
    setGateway("razorpay");
    setShowForm(false);
    setLoading(false);
    await loadLinks();
  };

  // 👇 NEW: Download CSV report
  const handleDownloadReport = () => {
    const headers = [
      "Created At",
      "Customer Name",
      "Phone",
      "Email",
      "Course",
      "Pitched Amount",
      "Link Amount",
      "Balance",
      "Discount",
      "Status",
      "Gateway",
      "State",
      "Created By",
      "Payment Link",
    ];

    const rows = links.map((link) => [
      new Date(link.created_at).toLocaleString(),
      link.customer_name,
      link.customer_phone,
      link.customer_email || "",
      link.course_name || "",
      link.pitched_amount || "",
      link.link_amount,
      link.balance_amount || "",
      link.discount_amount || "",
      link.status,
      link.gateway,
      link.state || "",
      link.creator_name || "",
      link.gateway_link_url || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", encodedUri);
    downloadLink.setAttribute("download", `payment_links_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // 👇 NEW: Copy link helper
  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (e) {
      alert("Failed to copy link");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Payments</h1>

      {/* Row 1 - Generate Link button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowForm(true)}>Generate Link</button>
      </div>

      {/* Popup form */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 400 }}>
            <h2>Create Payment Link</h2>
            <form onSubmit={handleCreateLink}>
              <label>
                Course
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCourseId(val);

                    const course = courses.find((c) => c.id === val);
                    if (course && course.max_price) {
                      setLinkAmount(course.max_price.toString());
                    }
                  }}
                  required
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                >
                  <option value="">-- Select Course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Customer Name
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                Mobile Number
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                Pitched Amount
                <input
                  type="number"
                  value={pitchedAmount}
                  onChange={(e) => setPitchedAmount(e.target.value)}
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                Link Amount
                <input
                  type="number"
                  value={linkAmount}
                  onChange={(e) => setLinkAmount(e.target.value)}
                  required
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                State
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                />
              </label>

              <label>
                Payment Gateway
                <select
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="cashfree">Cashfree</option>
                  <option value="zoho">Zoho</option>
                </select>
              </label>

              {error && <p style={{ color: "red" }}>{error}</p>}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button type="button" onClick={() => setShowForm(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details popup */}
      {selectedLink && (() => {
  const selectedCourse = courses.find((c) => c.id === selectedLink.course_id);
  const maxPrice = selectedCourse?.max_price ?? 0;
  const pitched = selectedLink.pitched_amount ?? 0;
  const linkAmt = selectedLink.link_amount;

  // 👇 FIXED: paidAmount should come from actual payment data (from webhook)
  // For now, if status is "link_created", paidAmount = 0
  const paidAmount = selectedLink.status === "link_created" ? 0 : linkAmt;

  const balanceAmount = Math.max(pitched - paidAmount, 0);
  const discountAmount = Math.max(maxPrice - pitched, 0);

  // 👇 FIXED: Use the status directly from database
  const computedStatus = selectedLink.status;

  return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
            }}
          >
            <div style={{ background: "white", padding: 24, borderRadius: 8, width: 450 }}>
              <h2>Enrollment Form</h2>

              <p>
                <strong>Customer Name:</strong> {selectedLink.customer_name}
              </p>
              <p>
                <strong>Email:</strong> {selectedLink.customer_email || "-"}
              </p>
              <p>
                <strong>Mobile Number:</strong> {selectedLink.customer_phone}
              </p>
              <p>
                <strong>Course Name:</strong> {selectedLink.course_name || "-"}
              </p>
              <p>
                <strong>Course Fees (Max Price):</strong> ₹{maxPrice}
              </p>
              {/* 👇 NEW: Show Final Payable Amount */}
              <p>
                <strong>Final Payable Amount:</strong> ₹{pitched}
              </p>
              <p>
                <strong>Link Amount:</strong> ₹{linkAmt}
                </p>
              <p>
                <strong>Paid Amount:</strong> ₹{paidAmount}
              </p>
              <p>
                <strong>Balance Amount:</strong> ₹{balanceAmount}
              </p>
              <p>
                <strong>Discount Amount:</strong> ₹{discountAmount}
              </p>
              <p>
                <strong>Payment Status:</strong> {computedStatus}
              </p>
              {/* 👇 NEW: Show Created By */}
              <p>
                <strong>Created By:</strong> {selectedLink.creator_name || "Unknown"}
              </p>

              <div style={{ marginTop: 12 }}>
                {/* Checkout Page Link */}
<p>
  <strong>Checkout Page Link:</strong>
</p>
<div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
  <span style={{ fontSize: 12, wordBreak: "break-all" }}>
    {selectedLink.checkout_link_url || "(not generated yet)"}
  </span>
  {selectedLink.checkout_link_url && (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(selectedLink.checkout_link_url!);
          setCopyMessage("Checkout link copied!");
        } catch (e) {
          setCopyMessage("Could not copy checkout link");
        }
      }}
    >
      Copy checkout
    </button>
  )}
</div>

{/* Gateway Direct Link */}
<p>
  <strong>Gateway Link:</strong>
</p>
<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <span style={{ fontSize: 12, wordBreak: "break-all" }}>
    {selectedLink.gateway_link_url || "(not generated yet)"}
  </span>
  {selectedLink.gateway_link_url && (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(selectedLink.gateway_link_url!);
          setCopyMessage("Gateway link copied!");
        } catch (e) {
          setCopyMessage("Could not copy gateway link");
        }
      }}
    >
      Copy gateway
    </button>
  )}
</div>

{copyMessage && <p style={{ fontSize: 12 }}>{copyMessage}</p>}

              </div>

              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
                <button
                  type="button"
                  onClick={() => {
                    alert("Invoice download will be added later.");
                  }}
                >
                  Invoice
                </button>

                <button type="button" onClick={() => setSelectedLink(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Journey Modal - ENHANCED VERSION */}
{selectedLinkForJourney && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30
  }}>
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '32px',
      maxWidth: '700px',
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>Payment Journey</h2>
        <button
          onClick={() => {
            setSelectedLinkForJourney(null);
            setJourneyEvents([]);
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280'
          }}
        >
          ×
        </button>
      </div>

      {journeyEvents.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
          No payment events yet. Events will appear once the customer starts the payment process.
        </p>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '40px' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: '15px',
            top: '10px',
            bottom: '10px',
            width: '2px',
            backgroundColor: '#e5e7eb'
          }} />

          {journeyEvents.map((event, index) => {
            const eventData = event.event_data || {};
            
            // Helper function to get event icon
            const getEventIcon = (eventType: string) => {
              switch (eventType) {
                case 'checkout_opened':
                  return '🔗';
                case 'form_name_entered':
                  return '✏️';
                case 'form_phone_entered':
                  return '📱';
                case 'form_email_entered':
                  return '📧';
                case 'form_validation_failed':
                  return '⚠️';
                case 'payment_button_clicked':
                  return '🖱️';
                case 'razorpay_order_created':
                  return '📝';
                case 'razorpay_sdk_loaded':
                  return '⚙️';
                case 'payment_gateway_opened':
                  return '💳';
                case 'payment_modal_opened':
                  return '📱';
                case 'payment_modal_closed':
                  return '❌';
                case 'payment.authorized':
                case 'payment_authorized':
                  return '⏳';
                case 'payment.captured':
                case 'payment_captured':
                case 'order.paid':
                  return '✅';
                case 'payment.failed':
                case 'payment_failed':
                case 'payment_failed_event':
                  return '❌';
                case 'payment_success_handler':
                  return '✅';
                case 'payment_verification_failed':
                  return '⚠️';
                case 'payment_error':
                  return '❌';
                default:
                  return '📌';
              }
            };

            // Helper function to get event title
            const getEventTitle = (eventType: string) => {
              switch (eventType) {
                case 'checkout_opened':
                  return 'Checkout Page Opened';
                case 'form_name_entered':
                  return 'Name Entered';
                case 'form_phone_entered':
                  return 'Phone Number Entered';
                case 'form_email_entered':
                  return 'Email Entered';
                case 'form_validation_failed':
                  return 'Form Validation Failed';
                case 'payment_button_clicked':
                  return 'Payment Button Clicked';
                case 'razorpay_order_created':
                  return 'Razorpay Order Created';
                case 'razorpay_sdk_loaded':
                  return 'Payment Gateway Loaded';
                case 'payment_gateway_opened':
                  return 'Payment Gateway Opened';
                case 'payment_modal_opened':
                  return 'Payment Modal Opened';
                case 'payment_modal_closed':
                  return 'Payment Modal Closed by User';
                case 'payment.authorized':
                case 'payment_authorized':
                  return 'Payment Authorized';
                case 'payment.captured':
                case 'payment_captured':
                  return 'Payment Captured';
                case 'order.paid':
                  return 'Order Paid';
                case 'payment.failed':
                case 'payment_failed':
                case 'payment_failed_event':
                  return 'Payment Failed';
                case 'payment_success_handler':
                  return 'Payment Successful';
                case 'payment_verification_failed':
                  return 'Payment Verification Failed';
                case 'payment_error':
                  return 'Payment Error';
                default:
                  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
              }
            };

            const isSuccess = event.event_type.includes('captured') || 
                             event.event_type.includes('paid') || 
                             event.event_type.includes('success');
            const isFailed = event.event_type.includes('failed') || 
                            event.event_type.includes('error');

            return (
              <div key={event.id || index} style={{ marginBottom: '32px', position: 'relative' }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: '-33px',
                  top: '5px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#3b82f6',
                  border: '3px solid white',
                  boxShadow: '0 0 0 2px ' + (isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#3b82f6')
                }} />

                <div style={{
                  backgroundColor: '#f9fafb',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{getEventIcon(event.event_type)}</span>
                      <span style={{ fontWeight: '600', color: '#1f2937' }}>
                        {getEventTitle(event.event_type)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {new Date(event.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>

                  {/* Event Details */}
                  {Object.keys(eventData).length > 0 && (
                    <div style={{ fontSize: '14px', color: '#4b5563', marginTop: '12px' }}>
                      {/* Payment Method */}
                      {eventData.method && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Payment Method:</strong>{' '}
                          <span style={{ textTransform: 'uppercase' }}>{eventData.method}</span>
                          {eventData.card_network && ` (${eventData.card_network})`}
                          {eventData.vpa && ` (${eventData.vpa})`}
                          {eventData.wallet && ` (${eventData.wallet})`}
                        </div>
                      )}

                      {/* Amount */}
                      {eventData.amount && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Amount:</strong> ₹{(eventData.amount / 100).toFixed(2)}
                        </div>
                      )}

                      {/* Status */}
                      {eventData.status && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Status:</strong>{' '}
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isSuccess ? '#dcfce7' : isFailed ? '#fee2e2' : '#dbeafe',
                            color: isSuccess ? '#166534' : isFailed ? '#991b1b' : '#1e40af',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {eventData.status}
                          </span>
                        </div>
                      )}

                      {/* Name */}
                      {eventData.name && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Name:</strong> {eventData.name}
                        </div>
                      )}

                      {/* Phone */}
                      {eventData.phone && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Phone:</strong> {eventData.phone}
                        </div>
                      )}

                      {/* Email */}
                      {eventData.email && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Email:</strong> {eventData.email}
                        </div>
                      )}

                      {/* Order ID */}
                      {eventData.order_id && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Order ID:</strong> {eventData.order_id}
                        </div>
                      )}

                      {/* Missing Field (for validation failures) */}
                      {eventData.missing_field && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Missing Field:</strong>{' '}
                          <span style={{ color: '#dc2626' }}>{eventData.missing_field}</span>
                        </div>
                      )}

                      {/* Reason (for modal closed) */}
                      {eventData.reason && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Reason:</strong> {eventData.reason}
                        </div>
                      )}

                      {/* User Agent (for checkout opened) */}
                      {eventData.user_agent && (
                        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
                          <strong>Device:</strong> {eventData.user_agent.includes('Mobile') ? '📱 Mobile' : '💻 Desktop'}
                        </div>
                      )}

                      {/* Error Description */}
                      {eventData.error_description && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#fef2f2',
                          borderLeft: '4px solid #ef4444',
                          borderRadius: '4px'
                        }}>
                          <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                            Error:
                          </div>
                          <div style={{ color: '#dc2626' }}>{eventData.error_description}</div>
                        </div>
                      )}

                      {/* Generic Error */}
                      {eventData.error && !eventData.error_description && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: '#fef2f2',
                          borderLeft: '4px solid #ef4444',
                          borderRadius: '4px'
                        }}>
                          <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                            Error:
                          </div>
                          <div style={{ color: '#dc2626' }}>{eventData.error}</div>
                        </div>
                      )}

                      {/* Payment IDs */}
                      {eventData.razorpay_payment_id && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                          Payment ID: {eventData.razorpay_payment_id}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}




      {/* 👇 NEW: Row 2 - Filters and Search */}
      <div style={{ marginBottom: 16, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Search */}
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Name, Phone, Email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "6px 12px", borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ flex: "0 1 150px" }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "6px 12px", borderRadius: 4, border: "1px solid #ddd" }}
            >
              <option value="all">All</option>
              <option value="link_created">Link Created</option>
              <option value="partial_paid">Partial Paid</option>
              <option value="paid">Paid</option>
              <option value="fully_paid">Fully Paid</option>
            </select>
          </div>

          {/* Date From */}
          <div style={{ flex: "0 1 150px" }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
              From Date
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              style={{ width: "100%", padding: "6px 12px", borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>

          {/* Date To */}
          <div style={{ flex: "0 1 150px" }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, fontWeight: 500 }}>
              To Date
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              style={{ width: "100%", padding: "6px 12px", borderRadius: 4, border: "1px solid #ddd" }}
            />
          </div>

          {/* Download Report */}
          <div style={{ flex: "0 1 auto" }}>
            <button
              onClick={handleDownloadReport}
              style={{
                padding: "7px 16px",
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Download CSV
            </button>
          </div>

          {/* Clear Filters */}
          <div style={{ flex: "0 1 auto" }}>
            <button
              onClick={() => {
                setFilterStatus("all");
                setFilterDateFrom("");
                setFilterDateTo("");
                setSearchQuery("");
              }}
              style={{
                padding: "7px 16px",
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Row 3 - list of payment links */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
              <th align="left" style={{ padding: "12px 8px" }}>
                Created At
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Customer
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Phone
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Course
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Amount
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Gateway
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Status
              </th>
              {/* 👇 NEW: Created By column */}
              <th align="left" style={{ padding: "12px 8px" }}>
                Created By
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "12px 8px" }}>{new Date(link.created_at).toLocaleString()}</td>
                <td style={{ padding: "12px 8px" }}>{link.customer_name}</td>
                <td style={{ padding: "12px 8px" }}>{link.customer_phone}</td>
                <td style={{ padding: "12px 8px" }}>{link.course_name || "-"}</td>
                <td style={{ padding: "12px 8px" }}>₹{link.link_amount}</td>
                <td style={{ padding: "12px 8px" }}>{link.gateway}</td>
                <td style={{ padding: "12px 8px" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 12,
                      background:
                        link.status === "paid"
                          ? "#d1fae5"
                          : link.status === "partial_paid"
                          ? "#fef3c7"
                          : "#e5e7eb",
                      color:
                        link.status === "Paid"
                          ? "#065f46"
                          : link.status === "partial_paid"
                          ? "#92400e"
                          : "#1f2937",
                    }}
                  >
                    {link.status}
                  </span>
                </td>
                {/* 👇 NEW: Show creator name */}
                <td style={{ padding: "12px 8px" }}>{link.creator_name || "-"}</td>
                <td style={{ padding: "12px 8px" }}>
  <div style={{ display: "flex", gap: 8 }}>
    
    {/* Copy Checkout Link */}
{link.checkout_link_url && (
  <button
    onClick={() => handleCopyLink(link.checkout_link_url!)}
    style={{
          padding: "6px 12px",
          fontSize: 12,
          background: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
    Copy Checkout
  </button>
)}
    
   {/* Copy Gateway Link */}
{link.gateway_link_url && (
  <button
    onClick={() => handleCopyLink(link.gateway_link_url!)}
    style={{
          padding: "6px 12px",
          fontSize: 12,
          background: "#d32008",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
    Copy Gateway
  </button>
)}
    
    {/* View details button */}
    <button
      onClick={() => {
        setSelectedLink(link);
        setCopyMessage("");
      }}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        background: "#6b7280",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      View details
    </button>

    {/* View Journey button */}
    <button
      onClick={() => fetchPaymentJourney(link.id)}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        background: "#8b5cf6",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      View Journey
    </button>
  </div>
</td>

              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
                  No payment links found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
