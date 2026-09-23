import { redirect } from "next/navigation";
import { getOwnerContext } from "@/lib/auth/owner-context";

export default async function Home() {
  const owner = await getOwnerContext();
  redirect(owner?.user.email ? "/app" : "/consult");
}
