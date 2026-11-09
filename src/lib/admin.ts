/** ADMIN_EMAILS is comma separated; these people need no invite. */
export function isAdminEmail(
  email: string,
  env: Record<string, string | undefined> = process.env,
) {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return false;
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .some((a) => a.trim().toLowerCase() === wanted);
}
