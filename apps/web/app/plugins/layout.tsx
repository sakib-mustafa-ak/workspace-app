import { AuthenticatedLayout } from "@/components/authenticated-layout";

export default function PluginsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
