"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  status: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    const { data: meData } = await supabase.auth.getUser();
    if (!meData.user) {
      setError("Not logged in");
      setLoading(false);
      return;
    }

    // Only allow admin for now
    const { data: myProfile, error: myErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", meData.user.id)
      .single();

    if (myErr || !myProfile || myProfile.role !== "admin") {
      setError("Only admin can view users for now.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, department, status")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
    } else {
      setUsers(data as Profile[]);
    }

    setLoading(false);
  };

  const openEdit = (user: Profile) => {
    setEditingUser(user);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editingUser.full_name,
        department: editingUser.department,
        role: editingUser.role,
        status: editingUser.status,
      })
      .eq("id", editingUser.id);

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingUser(null);
    await loadUsers();
  };

  return (
    <div>
      <h1>Users</h1>
      <p>Manage roles, departments, and status of your team.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div style={{ margin: "16px 0" }}>
            <button onClick={loadUsers}>Refresh</button>
            {/* Later: add "Create new user" button here */}
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Email</th>
                <th align="left">Role</th>
                <th align="left">Department</th>
                <th align="left">Status</th>
                <th align="left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || "-"}</td>
                  <td>{u.email || "-"}</td>
                  <td>{u.role}</td>
                  <td>{u.department || "-"}</td>
                  <td>{u.status}</td>
                  <td>
                    <button onClick={() => openEdit(u)}>Edit</button>
                    {/* Later: Delete button */}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {/* Edit popup */}
      {editingUser && (
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
          <div style={{ background: "white", padding: 24, borderRadius: 8, width: 420 }}>
            <h2>Edit User</h2>
            <p>
              <strong>Email:</strong> {editingUser.email}
            </p>

            <label>
              Full Name
              <input
                type="text"
                value={editingUser.full_name || ""}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, full_name: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Department
              <input
                type="text"
                value={editingUser.department || ""}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, department: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              />
            </label>

            <label>
              Role
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, role: e.target.value })
                }
                style={{ width: "100%", marginTop: 4, marginBottom: 8 }}
              >
                <option value="admin">Admin</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="team_leader">Team Leader</option>
                <option value="bda">BDA</option>
                <option value="webinar_manager">Webinar Manager</option>
                <option value="webinar_associate">Webinar Associate</option>
                <option value="onboarding">Onboarding Team</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={editingUser.status}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, status: e.target.value })
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
              <button onClick={() => setEditingUser(null)} disabled={saving}>
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
