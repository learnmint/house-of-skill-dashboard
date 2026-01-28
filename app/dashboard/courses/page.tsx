"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Teacher = {
  id: string;
  name: string;
};

type Course = {
  id: string;
  name: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  max_price: number | null;
  min_price: number | null;
  min_part_payment: number | null;
  status: string;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTeacherId, setNewTeacherId] = useState<string | null>(null);
  const [newMaxPrice, setNewMaxPrice] = useState("");
  const [newMinPrice, setNewMinPrice] = useState("");
  const [newMinPartPayment, setNewMinPartPayment] = useState("");
  const [newStatus, setNewStatus] = useState("active");

  const [canDelete, setCanDelete] = useState(false);

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
    if (
      !(
        role === "admin" ||
        role === "sales_manager" ||
        role === "webinar_manager"
      )
    ) {
      setError("You do not have access to Courses page.");
      setLoading(false);
      return;
    }
    setCanDelete(role === "admin");

    const { data: teachersData, error: teachersErr } = await supabase
      .from("teachers")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (teachersErr) {
      console.error(teachersErr);
      setError(teachersErr.message);
      setLoading(false);
      return;
    }
    setTeachers((teachersData || []) as Teacher[]);

    const { data: coursesData, error: coursesErr } = await supabase
      .from("courses")
      .select("id, name, teacher_id, max_price, min_price, min_part_payment, status, teachers(name)")
      .order("created_at", { ascending: false });

    if (coursesErr) {
      console.error(coursesErr);
      setError(coursesErr.message);
      setLoading(false);
      return;
    }

    const mapped = (coursesData || []).map((c: any) => ({
      id: c.id as string,
      name: c.name as string,
      teacher_id: c.teacher_id as string | null,
      teacher_name: c.teachers?.name || null,
      max_price: c.max_price !== null ? Number(c.max_price) : null,
      min_price: c.min_price !== null ? Number(c.min_price) : null,
      min_part_payment:
        c.min_part_payment !== null ? Number(c.min_part_payment) : null,
      status: c.status as string,
    }));

    setCourses(mapped);
    setLoading(false);
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewTeacherId(null);
    setNewMaxPrice("");
    setNewMinPrice("");
    setNewMinPartPayment("");
    setNewStatus("active");
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");

    if (!newName) {
      setError("Course name is required");
      setSaving(false);
      return;
    }

    const maxPrice = newMaxPrice ? Number(newMaxPrice) : null;
    const minPrice = newMinPrice ? Number(newMinPrice) : null;
    const minPart = newMinPartPayment ? Number(newMinPartPayment) : null;

    const { error } = await supabase.from("courses").insert({
      name: newName,
      teacher_id: newTeacherId,
      max_price: maxPrice,
      min_price: minPrice,
      min_part_payment: minPart,
      status: newStatus,
    });

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    resetCreateForm();
    setShowCreate(false);
    setSaving(false);
    await init();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("courses")
      .update({
        name: editing.name,
        teacher_id: editing.teacher_id,
        max_price: editing.max_price,
        min_price: editing.min_price,
        min_part_payment: editing.min_part_payment,
        status: editing.status,
      })
      .eq("id", editing.id);

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    setSaving(false);
    await init();
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) return;
    const sure = confirm("Are you sure you want to delete this course?");
    if (!sure) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    await init();
  };

  return (
    <div>
      <h1>Courses</h1>
      <p>Manage courses that are linked with payment links and future website checkout.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Row 1 - Create new course */}
          <div style={{ margin: "16px 0", display: "flex", gap: 8 }}>
            <button onClick={() => setShowCreate(true)}>Create New Course</button>
            <button onClick={init}>Refresh</button>
            <button
              onClick={() => alert("Export logic (CSV) can be added later.")}
            >
              Export Report
            </button>
          </div>

          {/* Row 2 - Filter placeholder */}
          <div style={{ marginBottom: 16 }}>
            <strong>Filters</strong> (status / teacher filters can be added later)
          </div>

          {/* Row 3 - List of courses */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Course Name</th>
                <th align="left">Teacher Assigned</th>
                <th align="left">Maximum Selling Price</th>
                <th align="left">Minimum Selling Price</th>
                <th align="left">Minimum Part Payment</th>
                <th align="left">Course Status</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.teacher_name || "-"}</td>
                  <td>{c.max_price ?? "-"}</td>
                  <td>{c.min_price ?? "-"}</td>
                  <td>{c.min_part_payment ?? "-"}</td>
                  <td>{c.status}</td>
                  <td>
                    <button onClick={() => setEditing(c)}>Edit</button>
                    {canDelete && (
                      <button
                        style={{ marginLeft: 8 }}
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={7}>No courses found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* Create Course popup */}
      {showCreate && (
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
              width: 450,
            }}
          >
            <h2>Create New Course</h2>

            <label>
              Course Name
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Teacher Assigned
              <select
                value={newTeacherId || ""}
                onChange={(e) =>
                  setNewTeacherId(e.target.value || null)
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Maximum Selling Price
              <input
                type="number"
                value={newMaxPrice}
                onChange={(e) => setNewMaxPrice(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Minimum Selling Price
              <input
                type="number"
                value={newMinPrice}
                onChange={(e) => setNewMinPrice(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Minimum Part Payment
              <input
                type="number"
                value={newMinPartPayment}
                onChange={(e) => setNewMinPartPayment(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Course Status
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course popup */}
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
              width: 450,
            }}
          >
            <h2>Edit Course</h2>

            <label>
              Course Name
              <input
                type="text"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Teacher Assigned
              <select
                value={editing.teacher_id || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    teacher_id: e.target.value || null,
                  })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Maximum Selling Price
              <input
                type="number"
                value={editing.max_price ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    max_price: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Minimum Selling Price
              <input
                type="number"
                value={editing.min_price ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    min_price: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Minimum Part Payment
              <input
                type="number"
                value={editing.min_part_payment ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    min_part_payment: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Course Status
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
              <button onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
