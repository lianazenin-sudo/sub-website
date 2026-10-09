import { useRouter } from "expo-router";
import { ROUTES } from "@trace/shared";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function CreateAccountScreen() {
  const router = useRouter();

  return (
    <PlaceholderScreen
      title="Create Account"
      description="Placeholder — Google and email sign-up will call the website API."
      primaryLabel="Continue with Email"
      onPrimaryPress={() => router.push(ROUTES.enterEmail)}
      secondaryLabel="Back"
      onSecondaryPress={() => router.push(ROUTES.onboarding)}
    />
  );
}
