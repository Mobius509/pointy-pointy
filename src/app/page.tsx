import { redirect } from "next/navigation";

// New default landing. The v1 single-family routes still live at /v1 as
// a fallback; everyone hitting the bare domain now goes to v2.
export default function RootPage() {
  redirect("/v2");
}
