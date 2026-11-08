import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Vendor sign in - shoptcg" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Vendor sign in</h1>
          </CardTitle>
          <CardDescription>
            No password. We email you a link. Buyers never need an account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LoginForm />
          <p className="text-xs text-muted-foreground">
            By signing in you agree to the{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
