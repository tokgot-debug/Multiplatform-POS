"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/db/schema";

/**
 * M-Pesa payments viewer, ported from src/ui/mpesa.js.
 *
 * Markup and inline styles are reproduced exactly; visual/baselines/mpesa.png
 * is the contract. Behaviour is preserved as-is, including the 'Mobile Money'
 * method filter that never matches what the till actually writes ('MPESA') -
 * changing that is a product decision, not part of this port.
 */

type Payment = {
  id: string;
  amount: number;
  reference?: string;
  status?: string;
  created_at?: string;
  metadata?: { phone?: string };
};

const CELL = { padding: "12px 16px", fontSize: 13 } as const;
const HEAD_CELL = { padding: "12px 16px", fontSize: 11, color: "var(--text-secondary)" } as const;

function formatDate(value?: string) {
  return new Date(value ?? "").toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "numeric", hour12: true,
  });
}

export function MpesaScreen() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    db.payments
      .where("method").equals("Mobile Money").toArray()
      .then((rows: Payment[]) => {
        rows.sort((a, b) => Number(new Date(b.created_at ?? "")) - Number(new Date(a.created_at ?? "")));
        setPayments(rows);
      })
      .catch(() => setPayments([]));
  }, []);

  // Totals count every payment; only the table is filtered, as in the original.
  const { successTotal, failedTotal, rows } = useMemo(() => {
    const needle = search.toLowerCase();
    let success = 0;
    let failed = 0;
    const visible: Payment[] = [];

    for (const payment of payments) {
      const status = payment.status || "SUCCESS";
      if (status === "SUCCESS") success += payment.amount;
      else failed += payment.amount;

      if (filter !== "ALL" && status !== filter) continue;
      const reference = (payment.reference || "N/A").toLowerCase();
      const phone = (payment.metadata?.phone || "N/A").toLowerCase();
      if (needle && !reference.includes(needle) && !phone.includes(needle)) continue;
      visible.push(payment);
    }

    return { successTotal: success, failedTotal: failed, rows: visible };
  }, [payments, search, filter]);

  return (
    <div style={{ padding: 24, color: "var(--text-primary)", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "var(--bg-element)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.5px" }}>TOTAL SUCCESSFUL</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-green)" }} id="mpesa-total-success">{`KES ${successTotal.toLocaleString()}`}</div>
        </div>
        <div style={{ background: "var(--bg-element)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 16, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.5px" }}>TOTAL CANCELLED/FAILED</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--accent-rose)" }} id="mpesa-total-failed">{`KES ${failedTotal.toLocaleString()}`}</div>
        </div>
      </div>

      <div style={{ background: "var(--bg-element)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#F59E0B" }}>💵</span> Payments Viewer
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>🔍</span>
              <input
                type="text"
                id="mpesa-search"
                placeholder="Search Phone/Reference..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "8px 12px 8px 32px", color: "var(--text-primary)", fontFamily: "var(--font-main)", fontSize: 13, width: 250 }}
              />
            </div>
            <select
              id="mpesa-status-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "8px 12px", color: "var(--text-primary)", fontFamily: "var(--font-main)", fontSize: 13 }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="pos-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr>
                <th style={HEAD_CELL}>DATE/TIME</th>
                <th style={HEAD_CELL}>REFERENCE (ORDER ID)</th>
                <th style={HEAD_CELL}>PHONE</th>
                <th style={HEAD_CELL}>AMOUNT (KES)</th>
                <th style={HEAD_CELL}>STATUS</th>
                <th style={HEAD_CELL}>MESSAGE</th>
              </tr>
            </thead>
            <tbody id="mpesa-table-body">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                    No Mpesa transactions found.
                  </td>
                </tr>
              ) : (
                rows.map((payment) => {
                  const status = payment.status || "SUCCESS";
                  const isSuccess = status === "SUCCESS";
                  return (
                    <tr key={payment.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ ...CELL, color: "var(--text-muted)" }}>{formatDate(payment.created_at)}</td>
                      <td style={{ ...CELL, fontFamily: "monospace", fontWeight: 600 }}>
                        <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: 4 }}>
                          {payment.reference || payment.id.split("-")[0].toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...CELL, fontWeight: 700 }}>{payment.metadata?.phone || "-"}</td>
                      <td style={{ ...CELL, fontWeight: 700, color: "#F59E0B" }}>{payment.amount}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: isSuccess ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)", color: isSuccess ? "var(--accent-green)" : "var(--accent-rose)", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800 }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                        {isSuccess
                          ? "The service request is processed successfully."
                          : "Transaction failed or cancelled by user."}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
