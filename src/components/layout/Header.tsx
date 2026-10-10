import { Grid2x2 } from "lucide-react";

const NAV_ITEMS = [
  { href: "#place", label: "Place" },
  { href: "#upload", label: "Upload" },
  { href: "#details", label: "Details" },
  { href: "#surface", label: "Surface" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5 text-ink">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-muted text-accent">
            <Grid2x2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="font-display text-lg leading-none whitespace-nowrap">
            Tile 360° Preview
          </span>
        </a>

        <nav aria-label="Selection steps" className="hidden md:block">
          <ul className="flex items-center gap-1 text-sm text-stone-600">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-full px-3 py-1.5 transition-colors hover:bg-stone-200/70 hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <span className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Prototype
        </span>
      </div>
    </header>
  );
}
