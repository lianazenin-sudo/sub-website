import { getAuthSession } from "@/lib/auth/session";
import { displayNameFromSession } from "@/lib/scanning/steps";
import { ScanningFlow } from "@/components/scanning/scanning-flow";

type ScanningPageProps = {
  searchParams: Promise<{ jobId?: string; demo?: string }>;
};

export default async function ScanningPage({ searchParams }: ScanningPageProps) {
  const session = await getAuthSession();
  const params = await searchParams;

  const username = displayNameFromSession({
    name: session?.name,
    email: session?.email,
    username: session?.username,
  });

  const initialJobId =
    params.jobId ??
    (params.demo === "complete"
      ? "demo-complete"
      : params.demo === "failed"
        ? "demo-failed"
        : null);

  return <ScanningFlow username={username} initialJobId={initialJobId} />;
}
