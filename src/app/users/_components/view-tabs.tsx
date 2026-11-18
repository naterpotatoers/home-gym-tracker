import { ChartIcon, ClipboardIcon, HeartIcon, PersonIcon } from "@/components/icons";
import { ChipTabs } from "@/components/ui";
import { progressHref, type ProgressParams } from "@/lib/progress-url";

/** Progress / Cardio / Log / Profile pane switcher — keeps the rest of the params so a
 *  drill-in survives tab flips. Not rendered on the add-person pane. (The URL
 *  values stay "metrics"/"tracking" so old links keep working.) */
export function ViewTabs({ params }: { params: ProgressParams }) {
  const tabs = [
    { view: "metrics", label: "Progress", Icon: ChartIcon },
    { view: "cardio", label: "Cardio", Icon: HeartIcon },
    { view: "tracking", label: "Log", Icon: ClipboardIcon },
    { view: "profile", label: "Profile", Icon: PersonIcon },
  ] as const;
  return (
    <ChipTabs
      label="Person view"
      tabs={tabs.map(({ view, label, Icon }) => ({
        href: progressHref({ ...params, view }),
        label,
        current: params.view === view,
        icon: <Icon size={15} />,
      }))}
    />
  );
}
