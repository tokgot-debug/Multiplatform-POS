"use client";

import { useState } from "react";

import { signInStaff } from "@/boot";

import { usePosSession } from "./pos-session";

/**
 * Staff sign-in.
 *
 * Replaces the PIN pad, which listed every account by name and compared a
 * four-digit code against a record seeded into the app bundle. Nothing is
 * verified here now - the password goes to Firebase Authentication and the
 * role comes back inside a signed token.
 */
export function SignIn() {
  const { signIn } = usePosSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      const user = await signInStaff(email, password);
      await signIn(user);
    } catch (caught) {
      const code = (caught as { code?: string }).code ?? "";
      // Never distinguish a wrong password from an unknown account: that tells
      // an attacker which addresses are real.
      setError(
        code === "auth/invalid-credential"
          || code === "auth/wrong-password"
          || code === "auth/user-not-found"
          || code === "auth/invalid-email"
          ? "Email or password is incorrect."
          : code === "auth/user-disabled"
            ? "This account has been disabled. Ask your manager."
            : code === "auth/too-many-requests"
              ? "Too many attempts. Wait a few minutes and try again."
              : (caught as Error).message || "Could not sign in.",
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="pin-modal" className="modal active">
      <div className="tablet-mockup">
        <div className="tablet-screen">
          <div
            className="modal-content pin-switcher-content"
            style={{ border: "none", background: "transparent", boxShadow: "none", padding: "24px 24px 12px 24px", maxWidth: "100%" }}
          >
            <h2>Sign In</h2>
            <p>Enter the email and password your manager gave you</p>

            {/* .modal-content centres its children, which would otherwise
                shrink the form to its content and leave the fields narrower
                than the card they sit in. */}
            <form onSubmit={(event) => void submit(event)} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20, textAlign: "left", alignSelf: "stretch" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>Email</span>
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: 16, fontFamily: "var(--font-main)" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>Password</span>
                <input
                  id="signin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", color: "#fff", fontSize: 16, fontFamily: "var(--font-main)" }}
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                style={{ marginTop: 6, padding: 14, borderRadius: 8, border: "none", background: "var(--accent-cyan)", color: "#1a1008", fontSize: 15, fontWeight: 800, fontFamily: "var(--font-main)", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="error-msg" id="signin-error" role="alert">{error}</p>

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
