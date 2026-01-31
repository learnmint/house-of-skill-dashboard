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
  gateway_link_url: string | null;
  created_at: string;
  discount_amount: number | null;
  // 👇 NEW: Add these fields if not already in your table
  balance_amount?: number | null;
};

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  // form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [pitchedAmount, setPitchedAmount] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [state, setState] = useState("");
  const [gateway, setGateway] = useState("razorpay");
  const [error, setError] = useState("");

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
    // 👇 ADD balance_amount, payment_status to the select query
    const { data, error } = await supabase
      .from("payment_links")
      .select("id, customer_name, customer_phone, customer_email, course_id, course_name, link_amount, gateway, status, gateway_link_url, created_at, pitched_amount, discount_amount, state, balance_amount, payment_status")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
    } else {
      setLinks(data as PaymentLink[]);
    }
  };

  useEffect(() => {
    loadLinks();
    loadCourses();
  }, []);

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

    // 👇 CALCULATE DISCOUNT, BALANCE, PAYMENT_STATUS before inserting
    // Calculate values (around line 110-125)
const maxPrice = selectedCourse?.max_price ?? 0;
const pitched = pitchedAmount ? Number(pitchedAmount) : 0;
const linkAmt = Number(linkAmount);

const discountAmount = Math.max(maxPrice - pitched, 0);
const balanceAmount = Math.max(pitched - linkAmt, 0);

// 👇 Determine status based on balance
let paymentStatus: string = "link_created";
if (balanceAmount === 0 && linkAmt > 0) {
  paymentStatus = "paid";
} else if (balanceAmount > 0 && linkAmt > 0) {
  paymentStatus = "partial_paid";
}

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
    status: paymentStatus,  // 👈 Use existing status column
    discount_amount: discountAmount,  // 👈 Already exists
    balance_amount: balanceAmount,    // 👈 New column
  })
  .select("id")
  .single();


    if (insertError || !insertData) {
      console.error(insertError);
      setError(insertError?.message || "Insert failed");
      setLoading(false);
      return;
    }

    let razorpayUrl: string | null = null;
    let razorpayId: string | null = null;

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

          const { error: updateError } = await supabase
            .from("payment_links")
            .update({
              gateway_link_id: razorpayId,
              gateway_link_url: razorpayUrl,
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

  return (
    <div>
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
        // 👇 COMPUTE VALUES FOR THE SELECTED LINK
        const selectedCourse = courses.find((c) => c.id === selectedLink.course_id);
        const maxPrice = selectedCourse?.max_price ?? 0;
        const pitched = selectedLink.pitched_amount ?? 0;
        const linkAmt = selectedLink.link_amount;

        // For now, assume link_amount = paid_amount (single payment)
        // Later, you'll sum all payments for this customer+course
        const paidAmount = linkAmt;

        const balanceAmount = Math.max(pitched - paidAmount, 0);
        const discountAmount = Math.max(maxPrice - pitched, 0);

        let computedStatus: string = "link_created";
        if (balanceAmount === 0 && paidAmount > 0) {
          computedStatus = "paid";
        } else if (balanceAmount > 0 && paidAmount > 0) {
          computedStatus = "partial_paid";
        }

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
                <strong>Course Fees:</strong> ₹{maxPrice}
              </p>
              <p>
                <strong>Payment Amount:</strong> ₹{paidAmount}
              </p>
              {/* 👇 UPDATED FIELDS */}
              <p>
                <strong>Balance Amount:</strong> ₹{balanceAmount}
              </p>
              <p>
                <strong>Discount Amount:</strong> ₹{discountAmount}
              </p>
              <p>
                <strong>Payment Status:</strong> {computedStatus}
              </p>

              <div style={{ marginTop: 12 }}>
                <p>
                  <strong>Payment Link:</strong>
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, wordBreak: "break-all" }}>
                    {selectedLink.gateway_link_url || "(not generated yet)"}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedLink.gateway_link_url) return;
                      try {
                        await navigator.clipboard.writeText(selectedLink.gateway_link_url);
                        setCopyMessage("Link copied!");
                      } catch (e) {
                        setCopyMessage("Could not copy");
                      }
                    }}
                  >
                    Copy link
                  </button>
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

      {/* Row 2 - filters (placeholder for now) */}
      <div style={{ marginBottom: 12 }}>
        <strong>Filters</strong> (we will implement Status/Date filters next)
      </div>

      {/* Row 3 - list of payment links */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Created At</th>
            <th align="left">Customer</th>
            <th align="left">Phone</th>
            <th align="left">Course</th>
            <th align="left">Amount</th>
            <th align="left">Gateway</th>
            <th align="left">Status</th>
            <th align="left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id}>
              <td>{new Date(link.created_at).toLocaleString()}</td>
              <td>{link.customer_name}</td>
              <td>{link.customer_phone}</td>
              <td>{link.course_name || "-"}</td>
              <td>{link.link_amount}</td>
              <td>{link.gateway}</td>
              <td>{link.status}</td>
              <td>
                <button
                  onClick={() => {
                    setSelectedLink(link);
                    setCopyMessage("");
                  }}
                >
                  View details
                </button>
              </td>
            </tr>
          ))}
          {links.length === 0 && (
            <tr>
              <td colSpan={8}>No payment links yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
