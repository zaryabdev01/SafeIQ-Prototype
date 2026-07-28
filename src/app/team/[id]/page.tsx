import { TeamMemberClient } from "./TeamMemberClient";

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamMemberClient userId={id} />;
}
