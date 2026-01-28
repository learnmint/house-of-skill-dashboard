import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client with service role key
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      password,
      full_name,
      department,
      role,
      status,
    } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "email, password, and role are required" },
        { status: 400 }
      );
    }

    // Optional: basic password requirement
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // 1) Create auth user (auto-confirm email)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        department,
      },
    });

    if (createErr || !created?.user) {
      console.error("Create user error:", createErr);
      return NextResponse.json(
        { error: createErr?.message || "Failed to create user" },
        { status: 500 }
      );
    }

    const userId = created.user.id;

    // 2) Update profile row with role/department/status
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        full_name: full_name || null,
        email,
        department: department || null,
        role,
        status: status || "active",
      })
      .eq("id", userId);

    if (profileErr) {
      console.error("Update profile error:", profileErr);
      return NextResponse.json(
        { error: profileErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("Admin create-user error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
