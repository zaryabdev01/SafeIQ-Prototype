import { RagDetailClient } from "./RagDetailClient";

// Static export requires generateStaticParams() to return at least one path
// (Next.js treats an empty array the same as not having the function at all).
// Real RAG ids are created at runtime (mock store or the real API) and can't
// be known at build time, so this only pre-renders the fixed demo RAGs'
// shells; every other id - including every RAG created after this build -
// relies on the CloudFront fallback rule below to reach this same
// client-rendered page (see RagDetailClient).
const DEMO_RAG_IDS = ["rag-careplans", "rag-healthsafety", "rag-safeguarding"];

export async function generateStaticParams() {
  return DEMO_RAG_IDS.map((id) => ({ id }));
}

export default async function RagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RagDetailClient ragId={id} />;
}
