"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setProfile(data as Profile);
      }
    };

    load();
  }, []);

  if (!profile) return <div>Loading...</div>;

  const canManageTeams =
    profile.role === "admin" ||
    profile.role === "sales_manager" ||
    profile.role === "webinar_manager";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #eee",
          padding: 16,
          background: "#f9fafb",
        }}
      >
        {/* Header / logo block */}
        <div
          style={{
            backgroundColor: "#a6b9ef",
            borderRadius: "16px 16px 0 0",
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <img
            src="/logo.png"
            alt="Learn Mint Logo"
            style={{ width: "50px", height: "50px", objectFit: "contain" }}
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "0.03em",
              }}
            >
              House of Skill
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "#e5fbe9",
                marginTop: "2px",
              }}
            >
              Learn New Skills & Earn More
            </span>
          </div>
        </div>

        <p style={{ marginTop: 16, fontSize: 13, color: "#4b5563" }}>
          Logged in as: {profile.full_name || profile.id.slice(0, 6)} (
          {profile.role})
        </p>

        <nav
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 14,
          }}
        >
          <a href="/dashboard">Dashboard</a>
          <a href="/dashboard/payments">Payments</a>

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "webinar_manager" ||
            profile.role === "webinar_associate") && (
            <a href="/dashboard/payment-pages">Payment Pages</a>
          )}

          {(profile.role === "admin" ||
            profile.role === "webinar_manager") && (
            <a href="/dashboard/teachers">Teachers</a>
          )}

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "webinar_manager") && (
            <a href="/dashboard/courses">Courses</a>
          )}

          <a href="/dashboard/onboarding">Onboarding</a>

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "team_leader") && (
            <a href="/dashboard/users">Users</a>
          )}

          {canManageTeams && <a href="/dashboard/teams">Teams</a>}

          <a href="/dashboard/profile">My Profile</a>

          <button
            style={{ marginTop: 24 }}
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          >
            Logout
          </button>
        </nav>
      </aside>

      <main style={{ flex: 1, padding: 24, background: "#ffffff" }}>
        {children}
      </main>
    </div>
  );
}
