"use client";

import { useEffect, useState } from "react";

import { listActiveUsers, verifyLocalPin } from "@/boot";
import { db } from "@/db/schema";

import { usePosSession } from "./pos-session";

type ActiveUser = { id: string; name: string; role: string };

/**
 * Fast user PIN switch. Markup and inline styles are transcribed verbatim from
 * the original index.html so the tablet mock-up renders identically.
 */
export function PinLock() {
  const { ready, signIn } = usePosSession();
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // The lock screen paints before boot finishes, so the account list has to
    // wait for seeding - querying earlier returns an empty table.
    if (!ready) return;
    listActiveUsers()
      .then((rows: ActiveUser[]) => setUsers(rows))
      .catch(() => setUsers([]))
      .finally(() => setLoaded(true));
  }, [ready]);

  function press(value: string) {
    if (pin.length < 4) setPin(pin + value);
  }

  function clear() {
    setPin("");
    setError("");
  }

  async function submit() {
    if (!userId) {
      setError("Please select a user.");
      return;
    }
    const user = await verifyLocalPin(userId, pin);
    if (!user) {
      setPin("");
      setError("Incorrect PIN. Try again.");
      return;
    }
    await signIn(user, pin);
  }

  async function hardReset() {
    await db.delete();
    window.location.reload();
  }

  const noUsers = loaded && users.length === 0;

  return (
    <div id="pin-modal" className="modal active">
      <div className="tablet-mockup">
        <div className="tablet-screen">
          <div
            className="modal-content pin-switcher-content"
            style={{ border: "none", background: "transparent", boxShadow: "none", padding: "24px 24px 12px 24px", maxWidth: "100%" }}
          >
            <h2>Enter Till PIN</h2>
            <p>Select your user account and enter your 4-digit PIN</p>

            <div className="user-select-dropdown" style={{ marginBottom: 24 }}>
              <select
                id="pin-user-select"
                value={userId}
                onChange={(event) => {
                  setUserId(event.target.value);
                  setPin("");
                  setError("");
                }}
                style={{ width: "100%", padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: 16, fontFamily: "var(--font-main)" }}
              >
                <option value="" disabled>
                  {noUsers ? "No active users found. Click Hard Reset." : "Select your user account..."}
                </option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {`${user.name} (${user.role})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="pin-input-area">
              <input type="password" id="pin-input" readOnly maxLength={4} placeholder="••••" value={pin} />
              <div className="numpad">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button key={digit} type="button" className="numpad-btn" onClick={() => press(digit)}>
                    {digit}
                  </button>
                ))}
                <button type="button" className="numpad-btn clear" id="numpad-clear" onClick={clear}>C</button>
                <button type="button" className="numpad-btn" onClick={() => press("0")}>0</button>
                <button type="button" className="numpad-btn ok" id="numpad-ok" onClick={() => void submit()}>OK</button>
              </div>
            </div>
            <p className="error-msg" id="pin-error">{error}</p>

            {noUsers ? (
              <button
                id="hard-reset-btn"
                type="button"
                onClick={() => void hardReset()}
                style={{ marginTop: 16, padding: 10, background: "#f43f5e", color: "white", border: "none", borderRadius: 5, cursor: "pointer", width: "100%" }}
              >
                Hard Reset Database
              </button>
            ) : null}

            <div className="brand-footer" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(200, 130, 42, 0.15)", width: "100%", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 800, color: "var(--accent-amber)", letterSpacing: 2, textTransform: "uppercase", opacity: 0.85 }}>
                Vanbransa ProPos
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Enterprise Edition
              </div>
            </div>
          </div>
        </div>
        <div className="bezel-logo">Vanbransa</div>
      </div>
    </div>
  );
}
