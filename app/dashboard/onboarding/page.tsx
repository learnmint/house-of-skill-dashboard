"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type OnboardingRow = {
  id: string;
  payment_link_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  alt_phone: string | null;
  customer_email: string | null;
  alt_email: string | null;
  city: string | null;
  state: string | null;
  course_name: string | null;
  course_duration: number | null;
  course_start_date: string | null;
  course_end_date: string | null;
  onboarding_call_status: string | null;
  onboarding_email_status: string | null;
  community_added_status: string | null;
};

type PaymentWithOnboarding = {
  id: string; // payment_link id
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  link_amount: number;
  status: string;
  onboarding: OnboardingRow | null;
};

export default function OnboardingPage() {
  const [rows, setRows] = useState<PaymentWithOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PaymentWithOnboarding | null>(null);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    // Determine if user can edit (admin or onboarding)
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (meErr || !me) {
      setError("Unable to load current user role");
      setLoading(false);
      return;
    }

    const role = me.role as string;
    setCanEdit(role === "admin" || role === "onboarding");

    // Fetch paid / partially paid payment links and join onboarding
    const { data, error } = await supabase
      .from("payment_links")
      .select(
        "id, customer_name, customer_phone, customer_email, link_amount, status, onboarding:onboarding(*)"
      )
      .in("status", ["fully_paid", "partial_paid"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((p: any) => ({
      id: p.id as string,
      customer_name: p.customer_name as string,
      customer_phone: p.customer_phone as string,
      customer_email: (p.customer_email || null) as string | null,
      link_amount: Number(p.link_amount),
      status: p.status as string,
      onboarding: p.onboarding?.[0] || null,
    }));

    setRows(mapped);
    setLoading(false);
  };

  const openEdit = (row: PaymentWithOnboarding) => {
    setEditing(row);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");

    const ob = editing.onboarding;

    const payload = {
      payment_link_id: editing.id,
      customer_name: ob?.customer_name ?? editing.customer_name,
      customer_phone: ob?.customer_phone ?? editing.customer_phone,
      alt_phone: ob?.alt_phone ?? null,
      customer_email: ob?.customer_email ?? editing.customer_email,
      alt_email: ob?.alt_email ?? null,
      city: ob?.city ?? null,
      state: ob?.state ?? null,
      course_name: ob?.course_name ?? null,
      course_duration: ob?.course_duration ?? null,
      course_start_date: ob?.course_start_date ?? null,
      course_end_date: ob?.course_end_date ?? null,
      onboarding_call_status: ob?.onboarding_call_status ?? null,
      onboarding_email_status: ob?.onboarding_email_status ?? null,
      community_added_status: ob?.community_added_status ?? null,
      updated_at: new Date().toISOString(),
    };

    if (ob && ob.id) {
      // update
      const { error } = await supabase
        .from("onboarding")
        .update(payload)
        .eq("id", ob.id);
      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      // insert
      const { error } = await supabase.from("onboarding").insert(payload);
      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setEditing(null);
    await init();
  };

  const getOnboardingStatus = (row: PaymentWithOnboarding) => {
    const ob = row.onboarding;
    if (!ob) return "Pending";
    const call = ob.onboarding_call_status || "pending";
    const email = ob.onboarding_email_status || "pending";
    const comm = ob.community_added_status || "pending";
    return `Call: ${call}, Email: ${email}, Community: ${comm}`;
  };

  return (
    <div>
      <h1>Onboarding</h1>
      <p>
        View all paid customers and update their onboarding details. Only admin and onboarding team can edit.
      </p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div style={{ margin: "16px 0" }}>
            <button onClick={init}>Refresh</button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Customer</th>
                <th align="left">Contact</th>
                <th align="left">Course / Amount</th>
                <th align="left">Payment Status</th>
                <th align="left">Onboarding Status</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.customer_name}</td>
                  <td>
                    {r.customer_phone}
                    {r.customer_email ? <><br />{r.customer_email}</> : null}
                  </td>
                  <td>
                    {r.onboarding?.course_name || "-"}
                    <br />
                    ₹{r.link_amount}
                  </td>
                  <td>{r.status}</td>
                  <td>{getOnboardingStatus(r)}</td>
                  <td>
                    {canEdit ? (
                      <button onClick={() => openEdit(r)}>Edit</button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>No paid customers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* Edit popup */}
      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 24,
              borderRadius: 8,
              width: 520,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2>Onboarding Details</h2>
            <p>
              <strong>Payment Customer:</strong> {editing.customer_name} ({editing.customer_phone})
            </p>

            {(() => {
              const ob = editing.onboarding || ({} as any);

              const updateOb = (field: string, value: any) => {
                const current = editing.onboarding || ({} as any);
                setEditing({
                  ...editing,
                  onboarding: { ...current, [field]: value },
                });
              };

              return (
                <>
                  <h3>Contact</h3>
                  <label>
                    Customer Name
                    <input
                      type="text"
                      value={ob.customer_name ?? editing.customer_name ?? ""}
                      onChange={(e) => updateOb("customer_name", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Mobile Number
                    <input
                      type="text"
                      value={ob.customer_phone ?? editing.customer_phone ?? ""}
                      onChange={(e) => updateOb("customer_phone", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Alternate Mobile
                    <input
                      type="text"
                      value={ob.alt_phone ?? ""}
                      onChange={(e) => updateOb("alt_phone", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={ob.customer_email ?? editing.customer_email ?? ""}
                      onChange={(e) => updateOb("customer_email", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Alternate Email
                    <input
                      type="email"
                      value={ob.alt_email ?? ""}
                      onChange={(e) => updateOb("alt_email", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    City
                    <input
                      type="text"
                      value={ob.city ?? ""}
                      onChange={(e) => updateOb("city", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    State
                    <input
                      type="text"
                      value={ob.state ?? ""}
                      onChange={(e) => updateOb("state", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>

                  <h3>Course</h3>
                  <label>
                    Course Name
                    <input
                      type="text"
                      value={ob.course_name ?? ""}
                      onChange={(e) => updateOb("course_name", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Course Duration (days)
                    <input
                      type="number"
                      value={ob.course_duration ?? ""}
                      onChange={(e) =>
                        updateOb(
                          "course_duration",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Course Start Date
                    <input
                      type="date"
                      value={ob.course_start_date ?? ""}
                      onChange={(e) => updateOb("course_start_date", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>
                  <label>
                    Course End Date
                    <input
                      type="date"
                      value={ob.course_end_date ?? ""}
                      onChange={(e) => updateOb("course_end_date", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    />
                  </label>

                  <h3>Status</h3>
                  <label>
                    Onboarding Call Status
                    <select
                      value={ob.onboarding_call_status ?? "pending"}
                      onChange={(e) => updateOb("onboarding_call_status", e.target.value)}
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    >
                      <option value="pending">Pending</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                  <label>
                    Onboarding Email Status
                    <select
                      value={ob.onboarding_email_status ?? "pending"}
                      onChange={(e) =>
                        updateOb("onboarding_email_status", e.target.value)
                      }
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    >
                      <option value="pending">Pending</option>
                      <option value="sent">Sent</option>
                    </select>
                  </label>
                  <label>
                    Community Added Status
                    <select
                      value={ob.community_added_status ?? "pending"}
                      onChange={(e) =>
                        updateOb("community_added_status", e.target.value)
                      }
                      style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
                    >
                      <option value="pending">Pending</option>
                      <option value="done">Done</option>
                    </select>
                  </label>
                </>
              );
            })()}

            {error && <p style={{ color: "red" }}>{error}</p>}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 12,
              }}
            >
              <button onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
