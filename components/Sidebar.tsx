"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Executive Overview", short: "Overview" },
  { href: "/headcount", label: "Headcount Risk", short: "Headcount" },
  { href: "/recruiting", label: "Recruiting Bottlenecks", short: "Recruiting" },
  { href: "/workforce", label: "Workforce Trends", short: "Workforce" },
  { href: "/reconciliation", label: "Data Reconciliation", short: "Reconciliation" },
  { href: "/offers", label: "Offer Reconciliation", short: "Offers" },
  { href: "/data-model", label: "Data Model Gap", short: "Data model" },
  { href: "/actions", label: "Action Queue", short: "Actions" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-20 border-b border-line bg-surface md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3 md:px-5 md:py-6">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-semibold text-white">
          PO
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Control Tower</p>
          <p className="hidden text-xs text-ink-3 md:block">People Operations</p>
        </div>
      </div>
      <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:px-3 md:pb-0">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-ink"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <span className="md:hidden">{item.short}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
