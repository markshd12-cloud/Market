import { redirect } from "next/navigation";

// O proxy já manda para /login ou /dashboard; isto é só o fallback.
export default function Home() {
  redirect("/dashboard");
}
