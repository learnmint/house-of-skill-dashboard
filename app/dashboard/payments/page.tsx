"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type PaymentLink = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  course_id: string | null;
  pitched_amount: number | null;
  link_amount: number;
  state: string | null;
  gateway: string;
  status: string;
  gateway_link_url: string | null;
  created_at: string;
  discount_amount: number | null;

};

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");


  // form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [courseName, setCourseName] = useState("");
  const [pitchedAmount, setPitchedAmount] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [state, setState] = useState("");
  const [gateway, setGateway] = useState("razorpay");
  const [error, setError] = useState("");

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
    } else {
      setLinks(data as PaymentLink[]);
    }
  };

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

    const { data: insertData, error: insertError } = await supabase
  .from("payment_links")
  .insert({
    created_by: user.id,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail || null,
    course_id: null,
    pitched_amount: pitchedAmount ? Number(pitchedAmount) : null,
    link_amount: Number(linkAmount),
    state,
    gateway,
    status: "link_created",
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
        amount: Number(linkAmount),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        description: courseName || "Course payment",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Razorpay create link error:", data);
      setError(data.error || "Failed to create Razorpay link");
    } else {
      razorpayUrl = data.url;
      razorpayId = data.id;

      // Update payment_links with gateway fields
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
    setCourseName("");
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
          }}
        >
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 400 }}>
            <h2>Create Payment Link</h2>
            <form onSubmit={handleCreateLink}>
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
                Course Name
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
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
       {selectedLink && (
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

      <p><strong>Customer Name:</strong> {selectedLink.customer_name}</p>
      <p><strong>Email:</strong> {selectedLink.customer_email || "-"}</p>
      <p><strong>Mobile Number:</strong> {selectedLink.customer_phone}</p>
      <p><strong>Course Name:</strong> (we will map course_id to name later)</p>
      <p><strong>Course Fees:</strong> {selectedLink.pitched_amount ?? "-"}</p>
      <p><strong>Payment Amount:</strong> {selectedLink.link_amount}</p>
      <p><strong>Balance Amount:</strong> (we’ll compute when partial payments exist)</p>
      <p><strong>Discount Amount:</strong> {selectedLink.discount_amount ?? 0}</p>
      <p><strong>Payment Status:</strong> {selectedLink.status}</p>

      <div style={{ marginTop: 12 }}>
        <p><strong>Payment Link:</strong></p>
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
            // Placeholder: will generate real invoice later
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
     )}


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
      <td>{link.link_amount}</td>
      <td>{link.gateway}</td>
      <td>{link.status}</td>
      <td>
        <button onClick={() => {
          setSelectedLink(link);
          setCopyMessage("");
        }}>
          View details
        </button>
      </td>
    </tr>
  ))}
  {links.length === 0 && (
    <tr>
      <td colSpan={7}>No payment links yet.</td>
    </tr>
  )}
 </tbody>

      </table>
    </div>
  );
}
