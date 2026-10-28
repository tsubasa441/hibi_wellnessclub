import { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  return data?.is_admin === true;
}

// 管理画面の各ページの先頭で呼ぶ。layout の確認は画面遷移で再実行されないことがあるため、
// データを読むページでも個別に確かめる（未ログインは /login、管理者以外は /home へ）
export async function requireAdminPage(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(supabase, user.id))) redirect("/home");
}
