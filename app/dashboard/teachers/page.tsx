"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Teacher = {
  id: string;
  name: string;
  qualification: string | null;
  experience: string | null;
  status: string;
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newQualification, setNewQualification] = useState("");
  const [newExperience, setNewExperience] = useState("");
  const [newStatus, setNewStatus] = useState("active");

  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    setError("");

    // Check role
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
    if (!(role === "admin" || role === "webinar_manager")) {
      setError("You do not have access to Teachers page.");
      setLoading(false);
      return;
    }
    setCanDelete(role === "admin");

    const { data, error } = await supabase
      .from("teachers")
      .select("id, name, qualification, experience, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setTeachers(data as Teacher[]);
    }

    setLoading(false);
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewQualification("");
    setNewExperience("");
    setNewStatus("active");
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");

    if (!newName) {
      setError("Teacher name is required");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("teachers").insert({
      name: newName,
      qualification: newQualification || null,
      experience: newExperience || null,
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
      .from("teachers")
      .update({
        name: editing.name,
        qualification: editing.qualification,
        experience: editing.experience,
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
    const sure = confirm("Are you sure you want to delete this teacher?");
    if (!sure) return;

    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }
    await init();
  };

  return (
    <div>
      <h1>Teachers</h1>
      <p>Manage teachers for your courses.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Row 1 - Add New Teacher */}
          <div style={{ margin: "16px 0", display: "flex", gap: 8 }}>
            <button onClick={() => setShowCreate(true)}>Add New Teacher</button>
            <button onClick={init}>Refresh</button>
            {/* Row 2 - Filter and Export placeholder */}
            <button
              onClick={() => alert("Export logic to be added (CSV download).")}
            >
              Export Report
            </button>
          </div>

          {/* Row 3 - List of teachers */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Teacher Name</th>
                <th align="left">Qualification</th>
                <th align="left">Experience</th>
                <th align="left">Status</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.qualification || "-"}</td>
                  <td>{t.experience || "-"}</td>
                  <td>{t.status}</td>
                  <td>
                    <button onClick={() => setEditing(t)}>Edit</button>
                    {canDelete && (
                      <button
                        style={{ marginLeft: 8 }}
                        onClick={() => handleDelete(t.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={5}>No teachers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* Create Teacher popup */}
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
              width: 420,
            }}
          >
            <h2>Add New Teacher</h2>

            <label>
              Teacher Name
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Qualification
              <input
                type="text"
                value={newQualification}
                onChange={(e) => setNewQualification(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Experience
              <input
                type="text"
                value={newExperience}
                onChange={(e) => setNewExperience(e.target.value)}
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Status
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

      {/* Edit Teacher popup */}
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
              width: 420,
            }}
          >
            <h2>Edit Teacher</h2>

            <label>
              Teacher Name
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
              Qualification
              <input
                type="text"
                value={editing.qualification || ""}
                onChange={(e) =>
                  setEditing({ ...editing, qualification: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Experience
              <input
                type="text"
                value={editing.experience || ""}
                onChange={(e) =>
                  setEditing({ ...editing, experience: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Status
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
