import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { hasPassword, isAuthenticated, login as doLogin, logout as doLogout, setPassword, verifyPassword } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { seedDemo } from "@/lib/seed";

interface AuthCtx {
  ready: boolean;
  authed: boolean;
  needsSetup: boolean;
  signIn: (password: string) => Promise<boolean>;
  createPassword: (password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      await getSettings();
      await seedDemo();
      const setup = !(await hasPassword());
      setNeedsSetup(setup);
      setAuthed(isAuthenticated());
      setReady(true);
    })();
  }, []);

  const signIn = async (password: string) => {
    const ok = await verifyPassword(password);
    if (ok) {
      doLogin();
      setAuthed(true);
    }
    return ok;
  };

  const createPassword = async (password: string) => {
    await setPassword(password);
    doLogin();
    setAuthed(true);
    setNeedsSetup(false);
  };

  const signOut = () => {
    doLogout();
    setAuthed(false);
    navigate({ to: "/login" });
  };

  return <Ctx.Provider value={{ ready, authed, needsSetup, signIn, createPassword, signOut }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
};
