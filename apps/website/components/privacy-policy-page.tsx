import { PolicyPage } from "@/components/policy-page";
import { policyIntro, policySections, policyUpdated } from "@/lib/privacy-policy";

export function PrivacyPolicyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      updated={policyUpdated}
      intro={policyIntro}
      sections={policySections}
    />
  );
}
