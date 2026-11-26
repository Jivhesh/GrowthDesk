import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const fetchingBusinessRef = useRef(false);

  const fetchBusiness = async (userId, userMetadata = null) => {
    if (!supabase || !userId || fetchingBusinessRef.current) return;
    fetchingBusinessRef.current = true;
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Notice: Business profile lookup:', error.message);
      } else if (data) {
        setBusiness(data);
      } else {
        // Fallback: If trigger hasn't fired yet, create business row
        const metaName = userMetadata?.business_name || 'My Business';
        const metaType = userMetadata?.business_type || 'General';
        const { data: created, error: createErr } = await supabase
          .from('businesses')
          .insert({
            id: userId,
            name: metaName,
            type: metaType,
            default_country_code: '+91'
          })
          .select()
          .maybeSingle();

        if (!createErr && created) {
          setBusiness(created);
        }
      }
    } catch (err) {
      console.warn('Unexpected error in fetchBusiness:', err);
    } finally {
      fetchingBusinessRef.current = false;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Safety timeout to guarantee the app never gets stuck on an infinite loading spinner
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('Error fetching session:', error);
        setAuthError(error.message);
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      clearTimeout(safetyTimer);

      if (initialSession?.user) {
        fetchBusiness(initialSession.user.id, initialSession.user.user_metadata);
      }
    }).catch((err) => {
      console.error('Session error:', err);
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    // Listen for auth state changes (sign-in, token refresh, email confirmation redirect)
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      clearTimeout(safetyTimer);

      if (newSession?.user) {
        fetchBusiness(newSession.user.id, newSession.user.user_metadata);
      } else {
        setBusiness(null);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async ({ email, password, businessName, businessType }) => {
    if (!supabase) throw new Error('Supabase client is not configured');
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        data: {
          business_name: businessName,
          business_type: businessType || 'General'
        }
      }
    });
    if (error) throw error;
    if (data?.session?.user) {
      setUser(data.session.user);
      setSession(data.session);
      fetchBusiness(data.session.user.id, data.session.user.user_metadata);
    }
    return data;
  };

  const signIn = async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase client is not configured');
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    if (data?.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      fetchBusiness(data.session.user.id, data.session.user.user_metadata);
    }
    return data;
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setBusiness(null);
  };

  const refreshBusiness = async () => {
    if (user?.id) {
      await fetchBusiness(user.id, user.user_metadata);
    }
  };

  const value = {
    session,
    user,
    business,
    loading,
    authError,
    signUp,
    signIn,
    signOut,
    refreshBusiness,
    isConfigured: isSupabaseConfigured
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
