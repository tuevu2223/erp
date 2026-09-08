import { redirect } from "next/navigation";

/** Trang chủ đưa thẳng về /dashboard theo tài liệu mở rộng mục 1. */
export default function RootPage() {
  redirect("/dashboard");
}
