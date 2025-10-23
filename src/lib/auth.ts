import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = 'rent_app_session';

export interface Session {
  token: string;
  expiresAt: number;
}

export const setSession = (session: Session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const getSession = (): Session | null => {
  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;
  
  try {
    const session = JSON.parse(sessionStr) as Session;
    
    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const login = async (password: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('auth-login', {
      body: { password }
    });

    if (error) throw error;

    if (data.success) {
      setSession({
        token: data.token,
        expiresAt: data.expiresAt
      });
      return { success: true };
    }

    return { success: false, error: data.error || 'Login failed' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
};

export const isAuthenticated = (): boolean => {
  return getSession() !== null;
};
