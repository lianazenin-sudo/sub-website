import { Redirect } from "expo-router";
import { ROUTES } from "@trace/shared";

export default function Index() {
  return <Redirect href={ROUTES.onboarding} />;
}
