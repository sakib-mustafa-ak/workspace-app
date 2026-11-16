import { notFound } from "next/navigation";
import { DevMailInbox } from "@/components/dev-mail-inbox";

export default function DevMailPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevMailInbox />;
}
