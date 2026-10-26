import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { StatsView } from "@/components/stats/StatsView";
import { PAGE } from "@/lib/layout";

export const metadata: Metadata = {
  title: "Статистика заявок",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <div className={`${PAGE} py-5 sm:py-6`}>
        <StatsView />
      </div>
    </div>
  );
}
