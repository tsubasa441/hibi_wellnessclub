import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (user) redirect("/home");

  return <LoginForm />;
}
