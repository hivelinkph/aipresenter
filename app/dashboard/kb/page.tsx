import { redirect } from "next/navigation";

// Knowledge bases are now per-demo; managed inline on each demo page.
// Forward any old bookmarks to the demos list.
export default function LegacyKbPage() {
  redirect("/dashboard");
}
