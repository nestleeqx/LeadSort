import type { Metadata } from "next";
import { StatsView } from "@/components/stats/StatsView";
import { PAGE } from "@/lib/layout";

export const metadata: Metadata = {
  title: "Статистика заявок",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return (
    <div className={`${PAGE} py-5 sm:py-6`}>
      <StatsView />
    </div>
  );
}
