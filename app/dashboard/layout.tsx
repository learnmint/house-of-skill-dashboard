"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
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
  const [theme, setTheme] = useState<'day' | 'night'>(() => {
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('theme');
      return (t === 'day' || t === 'night') ? (t as 'day'|'night') : 'night';
    }
    return 'night';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // apply theme class to document element for global styles
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('theme-day', 'theme-night');
      document.documentElement.classList.add(theme === 'day' ? 'theme-day' : 'theme-night');
    }
  }, [theme]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!profile) return <div>Loading...</div>;

  const canManageTeams =
    profile.role === "admin" ||
    profile.role === "sales_manager" ||
    profile.role === "webinar_manager";

  const formatRole = (r: string) =>
    r
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const isBda = profile.role?.toLowerCase() === "bda";
  const displayName = profile.full_name
    ? isBda
      ? profile.full_name.toUpperCase()
      : profile.full_name
    : profile.id.slice(0, 6);
  const roleDisplay = isBda ? profile.role.toUpperCase() : formatRole(profile.role);

  const pathname = usePathname();

  return (
    <div className={theme === 'day' ? 'theme-day' : 'theme-night'} style={{ display: "flex", flexDirection: 'column', height: "100vh", gap: 0, padding: 0 }}>

      <header className="app-header glass" style={{ 
        padding: '8px 18px', 
        position: 'fixed',
        top: 5,
        left: 5,
        right: 5,
        zIndex: 900,
        gap: 12,
      }}>
         <div style={{ flex: 1, textAlign: 'center' }}>

          
          <div className="brand" style={{ color: 'inherit' }}>
           
          House of Skill
          <span className="subtitle" style={{ color: "#6b7280"}}>Learn New Skills & Earn More</span></div>
        </div>
        <div style={{ position: 'relative', right: 22 }} ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <div className="avatar-circle" style={{ cursor: 'pointer' }}>
              {(displayName || '').charAt(0) || 'U'}
            </div>
          </button>

          {dropdownOpen && (
            <div
              className="profile-dropdown glass"
              style={{
                position: 'absolute',
                right: 0,
                top: 50,
                width: 240,
                borderRadius: 12,
                padding: 12,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* User info */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{roleDisplay}</div>
              </div>

              {/* My Profile link */}
              <a
                href="/dashboard/profile"
                onClick={() => setDropdownOpen(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: 'inherit',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                👤 My Profile
              </a>

              {/* Theme toggle */}
              <button
                onClick={() => {
                  const next = theme === 'day' ? 'night' : 'day';
                  setTheme(next);
                  try { localStorage.setItem('theme', next); } catch (e) {}
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: 'inherit',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {theme === 'day' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </button>

              {/* Logout */}
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: 'inherit',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: 24, marginTop: 80, flex: 1 }}>
        <aside className="sidebar-glass sidebar"
          style={{
            width: 240,
            flexShrink: 0,
            position: 'fixed',
            left: 12,
            top: 112,
            bottom: 12,
            zIndex: 900,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
        {/* Header / logo block */}
        <div
          className="glass"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            borderRadius: 12,
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
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
                letterSpacing: "0.03em",
                color: 'inherit' 
              }}
            >
              House of Skill
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "#6b7280",
                marginTop: "2px",
              }}
            >
              Learn New Skills & Earn More
            </span>
          </div>
        </div>

        <p style={{ marginTop: 5, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
          I AM - {displayName} <span style={{ color: '#6b7280', fontWeight: 500 }}>({roleDisplay})</span>
        </p>

        <nav
          style={{
            marginTop: 2,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 14,
          }}
        >
          <a className={`nav-link ${pathname?.startsWith('/dashboard') && !pathname?.startsWith('/dashboard/payments') ? 'active' : ''}`} href="/dashboard">🏠 Home</a>
          <a className={`nav-link ${pathname?.startsWith('/dashboard/payments') ? 'active' : ''}`} href="/dashboard/payments">💳 Payments</a>

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "webinar_manager" ||
            profile.role === "webinar_associate") && (
            <a className="nav-link" href="/dashboard/payment-pages">Payment Pages</a>
          )}

          {(profile.role === "admin" ||
            profile.role === "webinar_manager") && (
            <a className="nav-link" href="/dashboard/teachers">Teachers</a>
          )}

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "webinar_manager") && (
            <a className="nav-link" href="/dashboard/courses">Courses</a>
          )}

          <a className={`nav-link ${pathname?.startsWith('/dashboard/onboarding') ? 'active' : ''}`} href="/dashboard/onboarding">📋 Onboarding</a>

          {(profile.role === "admin" ||
            profile.role === "sales_manager" ||
            profile.role === "team_leader") && (
            <a className="nav-link" href="/dashboard/users">Users</a>
          )}

          {canManageTeams && <a className="nav-link" href="/dashboard/teams">Teams</a>}
        </nav>
        </aside>

        <main style={{ flex: 1, padding: 24, position: 'relative', marginLeft: 274, marginBottom:1 }}>
        <div className="glass" style={{ padding: 24, minHeight: '80vh' }}>
          {children}
        </div>
      </main>
    </div>
    </div>
  );
}
