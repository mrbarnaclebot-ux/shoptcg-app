import "server-only";

const FROM = process.env.EMAIL_FROM ?? "shoptcg <onboarding@resend.dev>";

export async function sendMagicLinkEmail(to: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Logging a live sign-in link is only acceptable on a developer machine.
    if (process.env.NODE_ENV === "production")
      throw new Error("RESEND_API_KEY is not set");
    console.log(`[magic-link] ${to}: ${url}`);
    return;
  }
  // Plain fetch to the Resend REST API; the SDK would add a dependency for one call.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Your shoptcg sign-in link",
      text: `Sign in to shoptcg:\n\n${url}\n\nThis link expires in 5 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok)
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}
