import { redirect } from "next/navigation";

// The queue lives on the dashboard; only a request has a page of its own.
export default function RequestsPage() {
  redirect("/dashboard");
}
