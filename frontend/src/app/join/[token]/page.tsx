import { AcceptInviteClient } from "../../invite/[token]/AcceptInviteClient";

// Public magic links use /join/{token} (see mockData + email templates).
// Static export seeds a placeholder shell; real tokens are read client-side.
export async function generateStaticParams() {
  return [{ token: "placeholder" }];
}

export default async function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInviteClient token={token} />;
}
