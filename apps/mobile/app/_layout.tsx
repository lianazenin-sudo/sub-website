import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ensureNotificationPermissions } from "@/lib/notifications";

export { ErrorBoundary } from "expo-router";

export default function RootLayout() {
  useEffect(() => {
    void ensureNotificationPermissions();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#111111" },
        }}
      />
    </>
  );
}
