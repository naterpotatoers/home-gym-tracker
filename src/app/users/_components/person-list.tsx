import Link from "next/link";
import { ChartIcon, ClipboardIcon, PersonIcon, PlusIcon } from "@/components/icons";
import { chipClass, ColorDot } from "@/components/ui";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import type { ClientSummary } from "@/lib/queries";

/**
 * The person hub's selector: a vertical sidebar list on desktop, a horizontal
 * chip row on mobile. Pure links via progressHref, so switching people keeps
 * the current view/drill-in and the selection lives in the URL. The one
 * exception: the add-person pane is person-independent, so picking a person
 * while on it lands on their Progress tab instead of a stuck add form.
 */
export function PersonList({
  summaries,
  params,
}: {
  summaries: ClientSummary[];
  params: ProgressParams;
}) {
  const personHref = (clientId: string) =>
    progressHref({
      ...params,
      client: clientId,
      view: params.view === "add" ? "metrics" : params.view,
    });
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden xl:block">
        <ul className="space-y-1">
        {summaries.map(({ client }) => {
          const selected = client.id === params.client;
          return (
            <li key={client.id}>
              <Link
                href={personHref(client.id)}
                className={`flex min-h-11 items-center rounded-md px-3 py-1.5 ${
                  selected
                    ? "bg-accent-soft"
                    : "hover:bg-current/5"
                }`}
              >
                <span
                  className={`flex items-center gap-1.5 text-sm ${
                    selected ? "font-semibold text-accent-text" : ""
                  }`}
                >
                  <ColorDot color={client.color} />
                  {client.firstName}
                  {client.isTrainer && (
                    <span className="rounded bg-current/10 px-1 py-0.5 text-[10px] font-normal">
                      trainer
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        </ul>
        <Link
          href={progressHref({ ...params, view: "add" })}
          className={`mt-2 flex min-h-11 items-center rounded-md px-3 text-sm ${
            params.view === "add"
              ? "bg-accent-soft font-semibold text-accent-text"
              : "text-muted hover:bg-current/5 hover:text-foreground"
          }`}
        >
          <PlusIcon size={14} /> <span className="ml-1">Add client</span>
        </Link>
      </div>

      {/* Mobile chip row */}
      <div className="-mx-4 overflow-x-auto px-4 xl:hidden">
        <div className="flex w-max gap-1 pb-1">
          {summaries.map(({ client }) => (
            <Link
              key={client.id}
              href={personHref(client.id)}
              className={chipClass(client.id === params.client, "min-h-11 px-3 text-sm")}
            >
              <ColorDot color={client.color} />
              {client.firstName}
            </Link>
          ))}
          <Link
            href={progressHref({ ...params, view: "add" })}
            className={chipClass(params.view === "add", "min-h-11 px-3 text-sm")}
          >
            <PlusIcon size={14} /> Add
          </Link>
        </div>
      </div>
    </>
  );
}

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
