import { useRouter } from "expo-router";
import { ROUTES } from "@trace/shared";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function WelcomeBackScreen() {
  const router = useRouter();

  return (
    <PlaceholderScreen
      title="Welcome Back"
      description="Placeholder — sign-in will call the website API."
      primaryLabel="Back to onboarding"
      onPrimaryPress={() => router.push(ROUTES.onboarding)}
    />
  );
}
