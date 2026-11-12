import Link from "next/link";
import { ChartIcon, ClipboardIcon, PersonIcon } from "@/components/icons";
import { chipClass } from "@/components/ui";
import { progressHref, type ProgressParams } from "@/lib/progress-url";

/** Progress / Log / Profile pane switcher — keeps the rest of the params so a
 *  drill-in survives tab flips. Not rendered on the add-person pane. (The URL
 *  values stay "metrics"/"tracking" so old links keep working.) */
export function ViewTabs({ params }: { params: ProgressParams }) {
  const tabs = [
    { view: "metrics", label: "Progress", icon: ChartIcon },
    { view: "tracking", label: "Log", icon: ClipboardIcon },
    { view: "profile", label: "Profile", icon: PersonIcon },
  ] as const;
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.view}
            href={progressHref({ ...params, view: tab.view })}
            aria-current={params.view === tab.view ? "page" : undefined}
            className={chipClass(params.view === tab.view, "min-h-11 px-4 text-sm")}
          >
            <Icon size={15} /> {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
