import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

// Required for auth session redirect completion on native.
WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-In via expo-auth-session (native).
 * Do not use the web GIS script in the mobile app.
 *
 * Set EXPO_PUBLIC_GOOGLE_* client IDs before wiring the create-account screen.
 */
export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}
