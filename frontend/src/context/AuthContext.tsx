import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Unsubscribe,
} from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import {
  DEFAULT_TENANT_ID,
  ensureManagerProfile,
  fetchUserProfileByEmail,
  findTeamByJoinCode,
  registerDeveloperProfile,
  type UserProfile,
} from '../lib/authService';
import type { UserRole } from '../types/auth';

export interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  uid?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  organization?: string;
  teamId?: string;
  teamName?: string;
  tenantId?: string;
  error?: string | null;
}

export interface RegisterPayload {
  role: UserRole;
  name: string;
  email: string;
  password: string;
  organization?: string;
  accessCode?: string;
  teamName?: string;
}

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILE_FALLBACKS: Record<string, UserProfile> = {
  'manager@bountyai.dev': {
    email: 'manager@bountyai.dev',
    displayName: 'Avery Holt',
    role: 'manager',
    tenantId: DEFAULT_TENANT_ID,
    organization: 'Orion Command',
  },
  'developer@bountyai.dev': {
    email: 'developer@bountyai.dev',
    displayName: 'Lena Park',
    role: 'developer',
    tenantId: DEFAULT_TENANT_ID,
    teamId: 'team_echo',
    teamName: 'Echo Knights',
  },
};

function resolveDemoProfileFallback(email?: string | null): UserProfile | null {
  if (!email) {
    return null;
  }
  return DEMO_PROFILE_FALLBACKS[email.toLowerCase()] ?? null;
}

function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Invalid email or password.';
      case 'auth/user-not-found':
        return 'No account found with that email address.';
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/weak-password':
        return 'Choose a stronger password (minimum 6 characters).';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'Authentication failed. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', error: null });

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const initializeAuth = async () => {
      try {
        const auth = firebaseAuth();
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            setState({ status: 'unauthenticated', error: null });
            return;
          }

          setState((prev) => ({ ...prev, status: 'loading', error: null }));

          try {
            const profile = await fetchUserProfileByEmail(user.email ?? '', DEFAULT_TENANT_ID)
              .catch((error) => {
                console.warn('Profile lookup failed, checking demo fallbacks', error);
                return null;
              });

            const resolvedProfile = profile ?? resolveDemoProfileFallback(user.email);

            if (!resolvedProfile) {
              await signOut(auth);
              setState({ status: 'unauthenticated', error: 'No profile found for this account.' });
              return;
            }

            setState({
              status: 'authenticated',
              uid: user.uid,
              email: user.email ?? resolvedProfile.email,
              name: user.displayName ?? resolvedProfile.displayName ?? resolvedProfile.email,
              role: resolvedProfile.role,
              organization: resolvedProfile.organization,
              teamId: resolvedProfile.teamId,
              teamName: resolvedProfile.teamName,
              tenantId: resolvedProfile.tenantId,
              error: null,
            });
          } catch (error) {
            console.error('Failed to load user profile', error);
            setState({ status: 'unauthenticated', error: mapAuthError(error) });
          }
        });
      } catch (error) {
        console.error('Failed to initialize Firebase authentication', error);
        setState({ status: 'unauthenticated', error: mapAuthError(error) });
      }
    };

    void initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const auth = firebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed', error);
      const message = mapAuthError(error);
      setState({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const auth = firebaseAuth();
      const credentials = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      await updateProfile(credentials.user, { displayName: payload.name });

      if (payload.role === 'manager') {
        await ensureManagerProfile(
          {
            uid: credentials.user.uid,
            email: payload.email,
            displayName: payload.name,
            organization: payload.organization,
          },
          DEFAULT_TENANT_ID,
        );
      } else {
        if (!payload.accessCode) {
          throw new Error('A manager access code is required for developer registration.');
        }

        const { teamId, teamName } = await findTeamByJoinCode(payload.accessCode, DEFAULT_TENANT_ID);
        await registerDeveloperProfile(
          {
            uid: credentials.user.uid,
            email: payload.email,
            displayName: payload.name,
            teamId,
            teamName: payload.teamName?.trim() || teamName,
          },
          DEFAULT_TENANT_ID,
        );
      }
    } catch (error) {
      console.error('Registration failed', error);
      const message = mapAuthError(error);
      try {
        const auth = firebaseAuth();
        await signOut(auth);
      } catch (signOutError) {
        console.warn('Failed to sign out after registration error', signOutError);
      }
      setState({ status: 'unauthenticated', error: message });
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const auth = firebaseAuth();
      await signOut(auth);
    } finally {
      setState({ status: 'unauthenticated', error: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
