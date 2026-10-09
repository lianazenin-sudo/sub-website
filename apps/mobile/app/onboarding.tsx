import { useRouter } from "expo-router";
import { ROUTES } from "@trace/shared";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <PlaceholderScreen
      title="Onboarding"
      description="One home for all your subscriptions."
      primaryLabel="Create New Account"
      onPrimaryPress={() => router.push(ROUTES.createAccount)}
      secondaryLabel="Already a member"
      onSecondaryPress={() => router.push(ROUTES.welcomeBack)}
    />
  );
}
