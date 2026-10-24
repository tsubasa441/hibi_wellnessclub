import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { pickGreeting } from "@/lib/greetings";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (user) redirect("/home");

  // 見出しの一言はサーバーで選ぶ（ブラウザで選ぶと、サーバーの描画と食い違って表示がちらつくため）
  return <LoginForm greetings={{ signin: pickGreeting("signin"), signup: pickGreeting("signup") }} />;
}
