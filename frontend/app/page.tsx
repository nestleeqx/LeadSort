import { redirect } from "next/navigation";

// Лендинг сервиса появится на этапе 5, пока главная ведёт в песочницу разбора
export default function Home() {
  redirect("/try");
}
