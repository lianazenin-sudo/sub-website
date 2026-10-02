"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleSignInResult = {
  email: string;
  name: string | null;
  picture: string | null;
};

type UseGoogleSignInOptions = {
  onSuccess: (result: GoogleSignInResult) => void;
  onError: (message: string) => void;
};

export function useGoogleSignIn({ onSuccess, onError }: UseGoogleSignInOptions) {
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );

    if (existing) {
      if (window.google?.accounts?.oauth2) {
        setIsScriptReady(true);
      } else {
        existing.addEventListener("load", () => setIsScriptReady(true), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsScriptReady(true);
    script.onerror = () => {
      onErrorRef.current("Unable to load Google sign-in. Please try again.");
    };
    document.head.appendChild(script);
  }, []);

  const signIn = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      onErrorRef.current(
        "Google sign-in is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
      );
      return;
    }

    if (!isScriptReady || !window.google?.accounts?.oauth2) {
      onErrorRef.current("Google sign-in is still loading. Please try again.");
      return;
    }

    setIsLoading(true);

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (response) => {
        if (response.error || !response.access_token) {
          setIsLoading(false);
          onErrorRef.current(
            "Google sign-in was cancelled. Please try again.",
          );
          return;
        }

        try {
          const result = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: response.access_token }),
          });

          if (!result.ok) {
            throw new Error("Google sign-in failed");
          }

          const data = (await result.json()) as GoogleSignInResult;
          onSuccessRef.current(data);
        } catch {
          onErrorRef.current(
            "Google sign-in was cancelled. Please try again.",
          );
        } finally {
          setIsLoading(false);
        }
      },
      error_callback: () => {
        setIsLoading(false);
        onErrorRef.current("Google sign-in was cancelled. Please try again.");
      },
    });

    tokenClient.requestAccessToken({ prompt: "select_account" });
  }, [isScriptReady]);

  return { signIn, isLoading, isScriptReady };
}
