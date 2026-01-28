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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("Current user:", user, "userError:", userError);

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    console.log("Profile data:", data, "profileError:", error);

    if (error) {
      console.error(error);
    } else {
      setProfile(data as Profile);
    }
  };
  load(); 
 }, []);


  if (!profile) return <div>Loading...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #eee",
          padding: 16,
        }}
      >
        <h2>House of Skill</h2>
        <p>Asli skill yahi milegi</p>
        <p style={{ marginTop: 16 }}>
          Logged in as: {profile.full_name || profile.id.slice(0, 6)} (
          {profile.role})
        </p>

        <nav
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
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

           {(profile.role === "admin" || profile.role === "webinar_manager") && (
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

      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
