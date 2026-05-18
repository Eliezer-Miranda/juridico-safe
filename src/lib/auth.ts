import bcrypt from "bcryptjs";
import { db, getSettings } from "./db";

const SESSION_KEY = "legal-session-v1";

export const hasPassword = async () => {
  const s = await getSettings();
  return !!s.passwordHash;
};

export const setPassword = async (password: string) => {
  const hash = bcrypt.hashSync(password, 8);
  await db.settings.update(1, { passwordHash: hash });
};

export const verifyPassword = async (password: string) => {
  const s = await getSettings();
  if (!s.passwordHash) return false;
  return bcrypt.compareSync(password, s.passwordHash);
};

export const login = () => sessionStorage.setItem(SESSION_KEY, "1");
export const logout = () => sessionStorage.removeItem(SESSION_KEY);
export const isAuthenticated = () => sessionStorage.getItem(SESSION_KEY) === "1";
