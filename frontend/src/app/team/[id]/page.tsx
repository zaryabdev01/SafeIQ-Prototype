import { TeamMemberClient } from "./TeamMemberClient";

// Static export requires generateStaticParams() to return at least one path
// (Next.js treats an empty array the same as not having the function at all).
// Real team-member ids are created at runtime (mock store or the real API)
// and can't be known at build time, so this only pre-renders the fixed demo
// personas' shells; every other id - and every real production account -
// relies on the CloudFront fallback rule below to reach this same
// client-rendered page (see TeamMemberClient).
const DEMO_USER_IDS = ["u-admin", "u-aisha", "u-daniel", "u-ellie", "u-priya", "u-safeiq-internal", "u-sam", "u-tom"];

export async function generateStaticParams() {
  return DEMO_USER_IDS.map((id) => ({ id }));
}

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamMemberClient userId={id} />;
}
