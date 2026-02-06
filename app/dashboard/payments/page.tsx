"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type CourseOption = {
  id: string;
  name: string;
  maxprice: number | null;
  minprice: number | null;
  minpartpayment: number | null;
};

type PaymentLink = {
  id: string;
  customername: string;
  customerphone: string;
  customeremail: string | null;
  courseid: string | null;
  coursename: string | null;
  pitchedamount: number | null;
  linkamount: number;
  state: string | null;
  gateway: string;
  status: string;
  gatewaylinkurl: string | null;
  checkoutlinkurl?: string | null;
  short_code?: string | null;
  createdat: string;
  discountamount: number | null;
  balanceamount?: number | null;
  createdby?: string | null;
  creatorname?: string | null;
};

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  // filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [pitchedAmount, setPitchedAmount] = useState("");
  const [linkAmount, setLinkAmount] = useState("");
  const [state, setState] = useState("");
  const [gateway, setGateway] = useState("razorpay");
  const [error, setError] = useState("");
  const [selectedLinkForJourney, setSelectedLinkForJourney] =
    useState<string | null>(null);
  const [journeyEvents, setJourneyEvents] = useState<any[]>([]);

  function generateShortCode(length = 8) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}


  useEffect(() => {
    loadCourses();
    loadLinks();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    loadLinks();
  }, [filterStatus, filterDateFrom, filterDateTo, searchQuery]);

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
        maxprice: c.max_price ? Number(c.max_price) : null,
        minprice: c.min_price ? Number(c.min_price) : null,
        minpartpayment: c.min_part_payment
          ? Number(c.min_part_payment)
          : null,
      }))
    );
  };

  const loadLinks = async () => {
    setError("");

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Not logged in");
      return;
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("id, role, team_id")
      .eq("id", auth.user.id)
      .single();

    if (meErr || !me) {
      console.error("Error loading current profile", meErr);
      setError("Could not load your profile");
      return;
    }

          let query = supabase
  .from("payment_links")
  .select(
    `
    id,
    created_at,
    customer_name,
    customer_phone,
    customer_email,
    course_id,
    course_name,
    link_amount,
    gateway,
    status,
    gateway_link_url,
    checkout_link_url,
    discount_amount,
    balance_amount,
    pitched_amount,
    created_by,
    team_id,
    profiles!payment_links_created_by_fkey (
      id,
      full_name
    )
  `
  )
  .order("created_at", { ascending: false });





    // role-wise visibility
if (me.role === "bda") {
  // only own links
  query = query.eq("created_by", me.id);
} else if (me.role === "team_leader") {
  // own links + links from BDAs in this team
  // condition: created_by = me.id OR team_id = my team_id
  if (me.team_id) {
    query = query.or(
      `created_by.eq.${me.id},team_id.eq.${me.team_id}`
    );
  } else {
    // if somehow no team_id set, fall back to own links only
    query = query.eq("created_by", me.id);
  }
} else if (me.role === "sales_manager" || me.role === "admin") {
  // see all links: no extra filter
} else {
  // any other role: own links
  query = query.eq("created_by", me.id);
}


    // filters
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
      const q = `%${searchQuery.trim()}%`;
      query = query.or(
        `customer_name.ilike.${q},customer_phone.ilike.${q},customer_email.ilike.${q}`
      );
    }

    query = query.limit(50);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

      const formatted = (data || []).map((row: any) => ({
  id: row.id,
  createdat: row.created_at,
  customername: row.customer_name,
  customerphone: row.customer_phone,
  customeremail: row.customer_email,
  courseid: row.course_id,
  coursename: row.course_name,
  linkamount: Number(row.link_amount),
  gateway: row.gateway,
  status: row.status,
  gatewaylinkurl: row.gateway_link_url,
      checkoutlinkurl: row.checkout_link_url,
      short_code: row.short_code,
  discountamount: row.discount_amount,
  balanceamount: row.balance_amount,
  pitchedamount: row.pitched_amount,          // ← this line is the key
  createdby: row.created_by,
  creatorname: row.profiles?.full_name || "-",
  state: row.state ?? null,
}));



    setLinks(formatted as PaymentLink[]);
  };
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
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
    const maxPrice = selectedCourse?.maxprice ?? 0;
    const pitched = pitchedAmount ? Number(pitchedAmount) : 0;
    const linkAmt = Number(linkAmount);
    const discountAmount = Math.max(maxPrice - pitched, 0);
    const balanceAmount = Math.max(pitched - linkAmt, 0);

    let paymentStatus: string = "link_created";

   const { data: insertData, error: insertError } = await supabase
      .from("payment_links")
      .insert({
        created_by: userRes.user.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        course_id: selectedCourse ? selectedCourse.id : null,
        course_name: selectedCourse ? selectedCourse.name : null,
        pitched_amount: pitched || null,
        link_amount: linkAmt,
        state,
        gateway,
        status: paymentStatus,
        discount_amount: discountAmount,
        balance_amount: balanceAmount,
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
    let checkoutPageUrl: string | null = null;

    if (gateway === "razorpay") {
      try {
        const res = await fetch("/api/razorpay/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: linkAmt,
            customername: customerName,
            customeremail: customerEmail,
            customerphone: customerPhone,
            description: selectedCourse
              ? `${selectedCourse.name} Course payment`
              : "Course payment",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("Razorpay create link error", data);
          setError(data.error || "Failed to create Razorpay link");
        } else {
          razorpayUrl = data.url;
          razorpayId = data.id;
        }

        checkoutPageUrl = `${window.location.origin}/checkout/${insertData.id}`;

        const { error: updateError } = await supabase
          .from("payment_links")
          .update({
            gateway_link_id: razorpayId,
            gateway_link_url: razorpayUrl,
            checkout_link_url: checkoutPageUrl,
          })
          .eq("id", insertData.id);
          const shortCode = generateShortCode();

// update row with short_code and canonical checkout URL (short-code based)
const shortCheckoutUrl = `${window.location.origin}/checkout/${shortCode}`;
const { error: shortErr } = await supabase
  .from("payment_links")
  .update({ short_code: shortCode, checkout_link_url: shortCheckoutUrl })
  .eq("id", insertData.id);

checkoutPageUrl = shortCheckoutUrl;


        if (updateError) {
          console.error(updateError);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Error talking to Razorpay");
      }
    }

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

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (e) {
      alert("Failed to copy link");
    }
  };

  const getCheckoutUrl = (link: PaymentLink) => {
    try {
      if (link.short_code) return `${window.location.origin}/checkout/${link.short_code}`;
      if (link.checkoutlinkurl) return link.checkoutlinkurl;
      return `${window.location.origin}/checkout/${link.id}`;
    } catch (e) {
      return link.checkoutlinkurl || `${window.location.origin}/checkout/${link.id}`;
    }
  };

  const fetchPaymentJourney = async (paymentLinkId: string) => {
    const { data, error } = await supabase
      .from("payment_events")
      .select("*")
      .eq("payment_link_id", paymentLinkId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching journey", error);
      return;
    }

    setJourneyEvents(data || []);
    setSelectedLinkForJourney(paymentLinkId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedLinkForJourney) {
        setSelectedLinkForJourney(null);
        setJourneyEvents([]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLinkForJourney]);

  return (
    <div style={{ 
      height: "100vh", 
      display: "flex", 
      flexDirection: "column",
      overflow: "hidden",
      padding: 20,
    }}>
      <h1 style={{ margin: "0 0 5px 0" }}>Payments</h1>
      
      {/* Row 1 - Generate Link */}
      <div
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}
      >
        <button onClick={() => setShowForm(true)}>Generate Link</button>
      </div>

      {/* Row 2 - Filters */}
      <div className="filter-section" style={{ 
        flexShrink: 0,
      }}>
        <div style={{ flex: "1 1 100px" }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--filter-label-color, #0f172a)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Search
          </label>
          <input
            className="filter-input"
            type="text"
            placeholder="Name, Phone, Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ flex: "0 1 100px" }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--filter-label-color, #0f172a)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Status
          </label>
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="link_created">Link Created</option>
            <option value="partial_paid">Partial Paid</option>
            <option value="paid">Paid</option>
            <option value="fully_paid">Fully Paid</option>
          </select>
        </div>

        <div style={{ flex: "0 1 100px" }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--filter-label-color, #0f172a)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            From Date
          </label>
          <input
            className="filter-input"
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        <div style={{ flex: "0 1 100px" }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--filter-label-color, #0f172a)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            To Date
          </label>
          <input
            className="filter-input"
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        <div style={{ flex: "0 1 auto" }}>
          <button
            className="filter-button"
            onClick={() => {
              setFilterStatus("all");
              setFilterDateFrom("");
              setFilterDateTo("");
              setSearchQuery("");
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {/* Row 3 - Table Container with Internal Scroll */}
      <div style={{ 
        overflowY: "auto", 
        overflowX: "auto",
        flex: 1,
        marginBottom: 5,
        borderRadius: 5,
        marginTop: 5,
      }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}>
            <tr>
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
              <th align="left" style={{ padding: "12px 8px" }}>
                Created By
              </th>
              <th align="left" style={{ padding: "12px 8px" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const startIdx = (currentPage - 1) * itemsPerPage;
              const endIdx = startIdx + itemsPerPage;
              const paginatedLinks = links.slice(startIdx, endIdx);
              
              return paginatedLinks.length > 0 ? paginatedLinks.map((link) => (
              <tr key={link.id}>
                <td style={{ padding: "12px 8px" }}>
                  {new Date(link.createdat).toLocaleString()}
                </td>
                <td style={{ padding: "12px 8px" }}>{link.customername}</td>
                <td style={{ padding: "12px 8px" }}>{link.customerphone}</td>
                <td style={{ padding: "12px 8px" }}>
                  {link.coursename || "-"}
                </td>
                <td style={{ padding: "12px 8px" }}>{link.linkamount}</td>
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
                        link.status === "paid"
                          ? "#065f46"
                          : link.status === "partial_paid"
                          ? "#92400e"
                          : "#1f2937",
                    }}
                  >
                    {link.status}
                  </span>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  {link.creatorname || "-"}
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleCopyLink(getCheckoutUrl(link))}
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
                    {link.gatewaylinkurl && (
                      <button
                        onClick={() => handleCopyLink(link.gatewaylinkurl!)}
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
                    <button
                      onClick={() => setSelectedLink(link)}
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
              )) : (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--filter-text)",
                  }}
                >
                  No payment links found.
                </td>
              </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - Fixed at Bottom */}
      {links.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 16,
            padding: 16,
            borderTop: "1px solid rgba(99, 102, 241, 0.2)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="filter-button"
            style={{
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>

          <div
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(99, 102, 241, 0.15)",
              color: "var(--filter-text)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Page {currentPage} of {Math.ceil(links.length / itemsPerPage)}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(links.length / itemsPerPage), prev + 1))}
            disabled={currentPage >= Math.ceil(links.length / itemsPerPage)}
            className="filter-button"
            style={{
              opacity: currentPage >= Math.ceil(links.length / itemsPerPage) ? 0.5 : 1,
              cursor: currentPage >= Math.ceil(links.length / itemsPerPage) ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Create Link popup */}
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
          <div
            style={{
              background: "white",
              padding: 24,
              borderRadius: 8,
              width: 400,
            }}
          >
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
                    if (course && course.maxprice) {
                      setLinkAmount(course.maxprice.toString());
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
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                >
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

      
           {/* Payment Journey Modal - glass theme */}
      {selectedLinkForJourney && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(30,64,175,0.45), rgba(8,47,73,0.65))",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(22px)",
              WebkitBackdropFilter: "blur(22px)",
              borderRadius: 20,
              padding: 24,
              maxWidth: 720,
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow:
                "0 25px 50px -12px rgba(15,23,42,0.45)",
              border: "1px solid rgba(148,163,184,0.7)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  color: "#0f172a",
                }}
              >
                Payment Journey
              </h2>
              <button
                onClick={() => {
                  setSelectedLinkForJourney(null);
                  setJourneyEvents([]);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>

            {journeyEvents.length === 0 ? (
              <p
                style={{
                  color: "#e5e7eb",
                  textAlign: "center",
                  padding: "40px 0",
                }}
              >
                No payment events yet. Events will appear once the customer starts
                the payment process.
              </p>
            ) : (
              <div style={{ position: "relative", paddingLeft: 40 }}>
                {/* Timeline line */}
                <div
                  style={{
                    position: "absolute",
                    left: 15,
                    top: 10,
                    bottom: 10,
                    width: 2,
                    backgroundColor: "rgba(148,163,184,0.7)",
                  }}
                />

                {journeyEvents.map((event, index) => {
                  const eventData = event.event_data || {};

                  const getEventIcon = (eventType: string) => {
                    switch (eventType) {
                      case "checkout_opened":
                        return "🔗";
                      case "form_name_entered":
                        return "✏️";
                      case "form_phone_entered":
                        return "📱";
                      case "form_email_entered":
                        return "📧";
                      case "form_validation_failed":
                        return "⚠️";
                      case "payment_button_clicked":
                        return "🖱️";
                      case "razorpay_order_created":
                        return "📝";
                      case "razorpay_sdk_loaded":
                        return "⚙️";
                      case "payment_gateway_opened":
                        return "💳";
                      case "payment_modal_opened":
                        return "📱";
                      case "payment_modal_closed":
                        return "❌";
                      case "payment.authorized":
                      case "payment_authorized":
                        return "⏳";
                      case "payment.captured":
                      case "payment_captured":
                      case "order.paid":
                        return "✅";
                      case "payment.failed":
                      case "payment_failed":
                      case "payment_failed_event":
                        return "❌";
                      case "payment_success_handler":
                        return "✅";
                      case "payment_verification_failed":
                        return "⚠️";
                      case "payment_error":
                        return "❌";
                      default:
                        return "📌";
                    }
                  };

                  const getEventTitle = (eventType: string) => {
                    switch (eventType) {
                      case "checkout_opened":
                        return "Checkout Page Opened";
                      case "form_name_entered":
                        return "Name Entered";
                      case "form_phone_entered":
                        return "Phone Number Entered";
                      case "form_email_entered":
                        return "Email Entered";
                      case "form_validation_failed":
                        return "Form Validation Failed";
                      case "payment_button_clicked":
                        return "Payment Button Clicked";
                      case "razorpay_order_created":
                        return "Razorpay Order Created";
                      case "razorpay_sdk_loaded":
                        return "Payment Gateway Loaded";
                      case "payment_gateway_opened":
                        return "Payment Gateway Opened";
                      case "payment_modal_opened":
                        return "Payment Modal Opened";
                      case "payment_modal_closed":
                        return "Payment Modal Closed by User";
                      case "payment.authorized":
                      case "payment_authorized":
                        return "Payment Authorized";
                      case "payment.captured":
                      case "payment_captured":
                        return "Payment Captured";
                      case "order.paid":
                        return "Order Paid";
                      case "payment.failed":
                      case "payment_failed":
                      case "payment_failed_event":
                        return "Payment Failed";
                      case "payment_success_handler":
                        return "Payment Successful";
                      case "payment_verification_failed":
                        return "Payment Verification Failed";
                      case "payment_error":
                        return "Payment Error";
                      default:
                        return eventType
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase());
                    }
                  };

                  const isSuccess =
                    event.event_type.includes("captured") ||
                    event.event_type.includes("paid") ||
                    event.event_type.includes("success");
                  const isFailed =
                    event.event_type.includes("failed") ||
                    event.event_type.includes("error");

                  return (
                    <div
                      key={event.id || index}
                      style={{ marginBottom: 32, position: "relative" }}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: "absolute",
                          left: -33,
                          top: 5,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: isSuccess
                            ? "#22c55e"
                            : isFailed
                            ? "#ef4444"
                            : "#3b82f6",
                          border: "3px solid white",
                          boxShadow:
                            "0 0 0 2px " +
                            (isSuccess
                              ? "#22c55e"
                              : isFailed
                              ? "#ef4444"
                              : "#3b82f6"),
                        }}
                      />

                      <div
                        style={{
                          background: "rgba(15,23,42,0.06)",
                          padding: 16,
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.6)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 20 }}>
                              {getEventIcon(event.event_type)}
                            </span>
                            <span
                              style={{
                                fontWeight: 600,
                                color: "#e5e7eb",
                              }}
                            >
                              {getEventTitle(event.event_type)}
                            </span>
                          </div>
                          <span
                            style={{ fontSize: 12, color: "#cbd5f5" }}
                          >
                            {new Date(event.created_at).toLocaleString(
                              "en-IN",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }
                            )}
                          </span>
                        </div>

                        {Object.keys(eventData).length > 0 && (
                          <div
                            style={{
                              fontSize: 14,
                              color: "#e5e7eb",
                              marginTop: 12,
                            }}
                          >
                            {eventData.method && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Payment Method:</strong>{" "}
                                <span style={{ textTransform: "uppercase" }}>
                                  {eventData.method}
                                </span>
                                {eventData.card_network &&
                                  ` (${eventData.card_network})`}
                                {eventData.vpa && ` (${eventData.vpa})`}
                                {eventData.wallet && ` (${eventData.wallet})`}
                              </div>
                            )}

                            {eventData.amount && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Amount:</strong> ₹
                                {(eventData.amount / 100).toFixed(2)}
                              </div>
                            )}

                            {eventData.status && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Status:</strong>{" "}
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    backgroundColor: isSuccess
                                      ? "#dcfce7"
                                      : isFailed
                                      ? "#fee2e2"
                                      : "#dbeafe",
                                    color: isSuccess
                                      ? "#166534"
                                      : isFailed
                                      ? "#991b1b"
                                      : "#1e40af",
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  {eventData.status}
                                </span>
                              </div>
                            )}

                            {eventData.name && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Name:</strong> {eventData.name}
                              </div>
                            )}

                            {eventData.phone && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Phone:</strong> {eventData.phone}
                              </div>
                            )}

                            {eventData.email && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Email:</strong> {eventData.email}
                              </div>
                            )}

                            {eventData.order_id && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Order ID:</strong>{" "}
                                {eventData.order_id}
                              </div>
                            )}

                            {eventData.missing_field && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Missing Field:</strong>{" "}
                                <span style={{ color: "#fecaca" }}>
                                  {eventData.missing_field}
                                </span>
                              </div>
                            )}

                            {eventData.reason && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Reason:</strong>{" "}
                                {eventData.reason}
                              </div>
                            )}

                            {eventData.user_agent && (
                              <div
                                style={{
                                  marginBottom: 8,
                                  fontSize: 12,
                                  color: "#9ca3af",
                                }}
                              >
                                <strong>Device:</strong>{" "}
                                {eventData.user_agent.includes("Mobile")
                                  ? "📱 Mobile"
                                  : "💻 Desktop"}
                              </div>
                            )}

                            {eventData.error_description && (
                              <div
                                style={{
                                  marginTop: 12,
                                  padding: 12,
                                  backgroundColor: "#fef2f2",
                                  borderLeft:
                                    "4px solid #ef4444",
                                  borderRadius: 4,
                                  color: "#991b1b",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  Error:
                                </div>
                                <div>{eventData.error_description}</div>
                              </div>
                            )}

                            {eventData.error &&
                              !eventData.error_description && (
                                <div
                                  style={{
                                    marginTop: 12,
                                    padding: 12,
                                    backgroundColor: "#fef2f2",
                                    borderLeft:
                                      "4px solid #ef4444",
                                    borderRadius: 4,
                                    color: "#991b1b",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      marginBottom: 4,
                                    }}
                                  >
                                    Error:
                                  </div>
                                  <div>{eventData.error}</div>
                                </div>
                              )}

                            {eventData.razorpay_payment_id && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#9ca3af",
                                  marginTop: 8,
                                }}
                              >
                                Payment ID:{" "}
                                {eventData.razorpay_payment_id}
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

            {/* View Details popup */}
{selectedLink && (() => {
  const selectedCourse = courses.find(
    (c) => c.id === selectedLink.courseid
  );
  const maxPrice = selectedCourse?.maxprice ?? 0;

  const pitched = selectedLink.pitchedamount ?? 0;
  const linkAmt = selectedLink.linkamount;
  const paidAmount = 0;

  

  const balanceAmount = selectedLink.balanceamount ?? 0;
  const discountAmount = selectedLink.discountamount ?? 0;
  const computedStatus = selectedLink.status;

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.4fr 1.6fr",
    padding: "3px 14px",
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    color: "#111827",
  };

  const valueStyle: React.CSSProperties = {
    color: "#1f2937",
  };

  const sectionStyle: React.CSSProperties = {
    borderRadius: 16,
    marginBottom: 16,
    background: "rgba(15,23,42,0.04)",
    border: "1px solid rgba(148,163,184,0.4)",
    paddingBottom: 8,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "center",
    fontWeight: 700,
    fontSize: 15,
    padding: "10px 0",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    background: "rgba(56,189,248,0.28)",
    color: "#075985",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(135deg, rgba(30,64,175,0.4), rgba(8,47,73,0.25))",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(14px)",
          padding: 24,
          borderRadius: 20,
          width: 560,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow:
            "0 25px 50px -12px rgba(15,23,42,0.45)",
          border: "1px solid rgba(148,163,184,0.7)",
        }}
      >
        {/* Enrollment Form Title */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div
            style={{
              display: "inline-block",
              padding: "8px 26px",
              borderRadius: 9999,
              background: "rgba(56,189,248,0.35)",
              fontSize: 22,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Enrollment Form
          </div>
        </div>

        {/* Customer Details */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Customer Details</div>

          <div style={rowStyle}>
            <span style={labelStyle}>Customer Name</span>
            <span style={valueStyle}>{selectedLink.customername}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Email</span>
            <span style={valueStyle}>
              {selectedLink.customeremail || "-"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Mobile Number</span>
            <span style={valueStyle}>
              {selectedLink.customerphone}
            </span>
          </div>
        </div>

        {/* Course Details */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Course Details</div>

          <div style={rowStyle}>
            <span style={labelStyle}>Course Name</span>
            <span style={valueStyle}>
              {selectedLink.coursename || "-"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>
              Course Fees
            </span>
            <span style={valueStyle}>₹{maxPrice}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Discount</span>
            <span style={valueStyle}>
              ₹{discountAmount}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>
              Final Payable Amount
            </span>
            <span style={valueStyle}>₹{pitched}</span>
          </div>
          
        </div>

        {/* Payment Details */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Payment Details</div>

          <div style={rowStyle}>
            <span style={labelStyle}>Link Amount</span>
            <span style={valueStyle}>₹{linkAmt}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Paid Amount</span>
            <span style={valueStyle}>₹{paidAmount}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Balance Amount</span>
            <span style={valueStyle}>₹{balanceAmount}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Payment Status</span>
            <span style={valueStyle}>{computedStatus}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Created By</span>
            <span style={valueStyle}>
              {selectedLink.creatorname || "Unknown"}
            </span>
          </div>
        </div>

        {/* Links Section */}
        <div
          style={{
            borderTop: "1px solid rgba(148,163,184,0.6)",
            paddingTop: 12,
            marginTop: 8,
          }}
        >
          <p><strong>Checkout Page Link:</strong></p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <span
              style={{
                fontSize: 12,
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {getCheckoutUrl(selectedLink)}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(getCheckoutUrl(selectedLink));
                  setCopyMessage("Link copied");
                  setTimeout(() => setCopyMessage(""), 500);
                } catch (e) {
                  setCopyMessage("Could not copy link");
                  setTimeout(() => setCopyMessage(""), 500);
                }
              }}
              style={{
                padding: "6px 10px",
                borderRadius: 9999,
                border: "none",
                background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                color: "white",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>

          <p><strong>Gateway Link:</strong></p>
          <div style={{ display: "flex", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {selectedLink.gatewaylinkurl || "(not generated yet)"}
            </span>
            {selectedLink.gatewaylinkurl && (
  <button
    type="button"
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(selectedLink.gatewaylinkurl!);
        setCopyMessage("Link copied");
        setTimeout(() => setCopyMessage(""), 500);
      } catch (e) {
        setCopyMessage("Could not copy link");
        setTimeout(() => setCopyMessage(""), 500);
      }
    }}
    style={{
      padding: "6px 10px",
      borderRadius: 9999,
      border: "none",
      background: "linear-gradient(135deg,#ec4899,#db2777)",
      color: "white",
      fontSize: 12,
      cursor: "pointer",
    }}
  >
    Copy
  </button>
)}


          </div>
        </div>
        

        {/* Footer Buttons */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <button
          type="button"
          onClick={() => {
          setCopyMessage("Invoice function will be implemented soon");
         setTimeout(() => setCopyMessage(""), 1000);
         }}
            style={{
              padding: "6px 14px",
              borderRadius: 9999,
              border: "1px solid rgba(148,163,184,0.9)",
              background: "white",
            }}
          >
            Invoice
          </button>
            {copyMessage && (
            <p style={{ fontSize: 12, marginTop: 6, color: "#16a34a" }}>
           {copyMessage}
            </p>
            )}
          <button
            onClick={() => setSelectedLink(null)}
            style={{
              padding: "6px 14px",
              borderRadius: 9999,
              border: "none",
              background:
                "linear-gradient(135deg,#4b5563,#111827)",
              color: "white",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
})()}
    </div>
  );
}
