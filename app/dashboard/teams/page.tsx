'use client';

import { useEffect, useState } from 'react';
import { supabase } from "../../lib/supabaseClient";

type Team = {
  id: string;
  name: string;
  team_leader_id: string | null;
  manager_id: string | null;
};

type UserOption = { id: string; full_name: string; role: string };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [name, setName] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
  const { data: teamsData, error: tErr } = await supabase
    .from("teams")
    .select("id, name, team_leader_id, manager_id")
    .order("created_at", { ascending: true });

  if (tErr) {
    console.error("Teams load error", tErr);
  }

  const { data: usersData, error: uErr } = await supabase
    .from("profiles")
    .select("id, full_name, role");

  if (uErr) {
    console.error("Users load error", uErr);
  }

  setTeams(teamsData || []);
  setUsers(usersData || []);
};


  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    await supabase.from('teams').insert({
      name,
      team_leader_id: teamLeaderId || null,
      manager_id: managerId || null,
    });
    setName('');
    setTeamLeaderId('');
    setManagerId('');
    setLoading(false);
    loadData();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Teams</h1>

      <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
        <div>
          <label>Team Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ display: 'block', width: 300 }}
          />
        </div>

        <div>
          <label>Team Leader</label>
          <select
            value={teamLeaderId}
            onChange={e => setTeamLeaderId(e.target.value)}
            style={{ display: 'block', width: 300 }}
          >
            <option value="">Select team leader</option>
            {users
              .filter(u => u.role === 'team_leader')
              .map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label>Manager</label>
          <select
            value={managerId}
            onChange={e => setManagerId(e.target.value)}
            style={{ display: 'block', width: 300 }}
          >
            <option value="">Select manager</option>
            {users
              .filter(u =>
                ['sales_manager', 'webinar_manager', 'admin'].includes(u.role),
              )
              .map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
          </select>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Create Team'}
        </button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>Team Name</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Team Leader</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Manager</th>
          </tr>
        </thead>
        <tbody>
          {teams.map(t => {
            const leader = users.find(u => u.id === t.team_leader_id);
            const manager = users.find(u => u.id === t.manager_id);
            return (
              <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: 8 }}>{t.name}</td>
                <td style={{ padding: 8 }}>{leader?.full_name || '-'}</td>
                <td style={{ padding: 8 }}>{manager?.full_name || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
