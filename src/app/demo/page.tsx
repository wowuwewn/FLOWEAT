import { redirect } from "next/navigation";

/** Old hub address → the single entry page. */
export default function DemoRedirect() {
  redirect("/");
}
