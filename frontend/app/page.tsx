import { redirect } from "next/navigation";

// Лендинг сервиса появится на этапе 5, пока главная ведёт на доску
export default function Home() {
  redirect("/app");
}
