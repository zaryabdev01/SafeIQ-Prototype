import { AcceptInviteClient } from "./AcceptInviteClient";

// Static export requires generateStaticParams() to return at least one path
// (Next.js treats an empty array the same as not having the function at
// all). Invite tokens are only ever minted at runtime by the real backend -
// there's no real value to seed here, so this is a placeholder purely to
// satisfy that requirement. Every real invite link relies on the CloudFront
// fallback rule below to reach this same client-rendered page (see
// AcceptInviteClient), which reads the actual token from the URL itself.
export async function generateStaticParams() {
  return [{ token: "placeholder" }];
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInviteClient token={token} />;
}
