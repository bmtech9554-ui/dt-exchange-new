import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
export default function NotFound() {
  return (
    <Card>
      <EmptyState
        title="Page not found"
        description="Choose a workspace from the navigation."
      />
      <Link className="button secondary" href="/">
        Back to foundation
      </Link>
    </Card>
  );
}
