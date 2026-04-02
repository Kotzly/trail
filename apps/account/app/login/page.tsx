import { redirect } from "next/navigation";

/** Minimal login placeholder — redirects to Supabase OAuth.
 *  Will be fully rebuilt per PRD. */
export default function LoginPage() {
  redirect("/auth/login");
}
