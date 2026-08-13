import { RagDetailClient } from "./RagDetailClient";

export default async function RagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RagDetailClient ragId={id} />;
}
