"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Summary = {
  today: number;
  month: number;
  allTime: number;
};

type FilterOption = "today" | "this_month" | "all_time";

export default function DashboardHome() {
  const [summary, setSummary] = useState<Summary>({
    today: 0,
    month: 0,
    allTime: 0,
  });
  const [filter, setFilter] = useState<FilterOption>("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await supabase
      .from("payment_links")
      .select("link_amount, amount_paid, status, created_at")
      .in("status", ["fully_paid", "partial_paid"]);

    if (error || !data) {
      console.error(error);
      setLoading(false);
      return;
    }

    let today = 0;
    let month = 0;
    let allTime = 0;

    data.forEach((row) => {
      const created = new Date(row.created_at as string);
      const paidAmount =
        row.status === "fully_paid"
          ? Number(row.link_amount)
          : Number(row.amount_paid || 0);

      allTime += paidAmount;

      if (created >= startOfMonth) {
        month += paidAmount;
      }
      if (created >= startOfToday) {
        today += paidAmount;
      }
    });

    setSummary({ today, month, allTime });
    setLoading(false);
  };

  const getDisplayedValue = () => {
    switch (filter) {
      case "today":
        return summary.today;
      case "this_month":
        return summary.month;
      case "all_time":
        return summary.allTime;
    }
  };

  return (
    <div>
      <h1>Dashboard</h1>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <strong>Revenue Summary (INR)</strong>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              minWidth: 160,
            }}
          >
            <p>Today</p>
            <h2>{summary.today}</h2>
          </div>
          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              minWidth: 160,
            }}
          >
            <p>This Month</p>
            <h2>{summary.month}</h2>
          </div>
          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              minWidth: 160,
            }}
          >
            <p>All Time</p>
            <h2>{summary.allTime}</h2>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <strong>Graph filter (placeholder)</strong>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter("today")}>Today</button>
        <button onClick={() => setFilter("this_month")}>This Month</button>
        <button onClick={() => setFilter("all_time")}>All Time</button>
      </div>

      <p>
        Selected filter value: <strong>{getDisplayedValue()}</strong>
      </p>
      <p style={{ marginTop: 8 }}>
        Later we’ll replace this with an actual graph (revenue trend over time) and add role-wise breakdown.
      </p>
    </div>
  );
}
