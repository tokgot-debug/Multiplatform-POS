"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  bootPos,
  endCloudSession,
  establishCloudSession,
  reportStockAlerts,
} from "@/boot";
import { state } from "@/context";

type PosUser = {
  id: string;
  name: string;
  role: string;
  [key: string]: unknown;
};

type PosSessionValue = {
  ready: boolean;
  bootError: string | null;
  user: PosUser | null;
  queueCount: number;
  online: boolean;
  signIn: (user: PosUser, pin: string) => Promise<void>;
  signOut: () => void;
  setOnline: (value: boolean) => void;
};

const PosSessionContext = createContext<PosSessionValue | null>(null);

export function usePosSession() {
  const value = useContext(PosSessionContext);
  if (!value) throw new Error("usePosSession must be used inside PosSessionProvider.");
  return value;
}

export function PosSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [user, setUser] = useState<PosUser | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnlineState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bootPos((_status: string, count: number) => {
      if (!cancelled) setQueueCount(count);
    })
      .then(() => !cancelled && setReady(true))
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setBootError(`${message}. Try refreshing or clearing site data.`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (nextUser: PosUser, pin: string) => {
    state.currentUser = nextUser;
    setUser(nextUser);
    // Backend session and the stock sweep are both advisory; neither may block
    // the operator from reaching the till.
    void establishCloudSession(nextUser, pin);
    setTimeout(() => void reportStockAlerts(), 3000);
  }, []);

  const signOut = useCallback(() => {
    state.currentUser = null;
    setUser(null);
    void endCloudSession();
  }, []);

  const setOnline = useCallback((value: boolean) => {
    setOnlineState(value);
    if (state.syncManager) {
      state.syncManager.setConnectionStatus(value ? "ONLINE" : "OFFLINE");
      if (value) state.syncManager.syncOutbox();
    }
  }, []);

  const value = useMemo<PosSessionValue>(
    () => ({ ready, bootError, user, queueCount, online, signIn, signOut, setOnline }),
    [ready, bootError, user, queueCount, online, signIn, signOut, setOnline],
  );

  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>;
}
