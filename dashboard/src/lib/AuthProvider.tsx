import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin + '/dashboard/',
  },
  cache: {
    cacheLocation: 'localStorage',
  },
};

const loginScopes = ['openid', 'profile', 'email'];

const msalInstance = new PublicClientApplication(msalConfig);

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { name: string; email: string } | null;
  token: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    msalInstance.initialize().then(async () => {
      const response = await msalInstance.handleRedirectPromise();
      if (response) {
        setToken(response.idToken);
        setUser({
          name: response.account?.name || '',
          email: response.account?.username || '',
        });
        setIsAuthenticated(true);
      } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          try {
            const silentResult = await msalInstance.acquireTokenSilent({
              scopes: loginScopes,
              account: accounts[0],
            });
            setToken(silentResult.idToken);
            setUser({
              name: accounts[0].name || '',
              email: accounts[0].username || '',
            });
            setIsAuthenticated(true);
          } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
              setIsAuthenticated(false);
            }
          }
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(() => {
    msalInstance.loginRedirect({ scopes: loginScopes });
  }, []);

  const logout = useCallback(() => {
    msalInstance.logoutRedirect();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
