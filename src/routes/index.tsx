import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import heroImage from "@/assets/supermarket-careers-hero.jpg";
import naivasImage from "@/assets/naivas-team.jpg";
import quickmartImage from "@/assets/quickmart-team.jpg";
import carrefourImage from "@/assets/carrefour-team.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Supermarket Careers Kenya | Retail Jobs" },
      {
        name: "description",
        content:
          "Explore retail jobs and official career portals for Naivas, Quickmart and Carrefour Kenya.",
      },
      { property: "og:title", content: "Supermarket Careers Kenya" },
      {
        property: "og:description",
        content: "Find your next retail opportunity with Kenya's leading supermarkets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Store = {
  name: string;
  accent: string;
  location: string;
  description: string;
  image: string;
  url: string;
  roles: string[];
};

const roles = [
  "All roles",
  "Cleaners",
  "Cashiers",
  "Store Keepers",
  "Drivers",
  "Loaders & Off-loaders",
  "Marketers",
  "Sales Attendants",
  "Chefs",
  "Warehouse Supervisors",
  "Guards",
];

const stores: Store[] = [
  {
    name: "Naivas",
    accent: "bg-naivas",
    location: "Branches across Kenya",
    description: "Grow with a proudly Kenyan retail team serving communities every day.",
    image: naivasImage,
    url: "https://supermarketjobs.vercel.app/apply/naivas",
    roles: ["Cashiers", "Store Keepers", "Cleaners", "Sales Attendants", "Chefs"],
  },
  {
    name: "Quickmart",
    accent: "bg-quickmart",
    location: "Branches across Kenya",
    description: "Move fast, serve brilliantly and build practical retail experience.",
    image: quickmartImage,
    url: "https://supermarketjobs.vercel.app/apply/quickmart",
    roles: ["Cashiers", "Marketers", "Loaders & Off-loaders", "Drivers", "Guards"],
  },
  {
    name: "Carrefour",
    accent: "bg-carrefour",
    location: "Kenya opportunities",
    description: "Join an international retail network with room to learn and lead.",
    image: carrefourImage,
    url: "https://supermarketjobs.vercel.app/apply/carrefour",
    roles: ["Warehouse Supervisors", "Sales Attendants", "Chefs", "Drivers", "Store Keepers"],
  },
];

function Index() {
  const [selectedRole, setSelectedRole] = useState("All roles");
  const [menuOpen, setMenuOpen] = useState(false);
  const filteredStores = useMemo(
    () =>
      selectedRole === "All roles"
        ? stores
        : stores.filter((store) => store.roles.includes(selectedRole)),
    [selectedRole],
  );

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <section className="relative min-h-[760px] bg-hero text-hero-foreground lg:min-h-[820px]">
        <img
          src={heroImage}
          alt="A diverse team of supermarket professionals ready for work"
          width={1920}
          height={1080}
          className="absolute inset-0 size-full object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 bg-hero-overlay" />
        <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-6 md:px-10 lg:px-16">
          <a href="#top" className="flex items-center gap-3" aria-label="Supermarket Careers home">
            <span className="grid size-10 place-items-center rounded-md bg-highlight font-display text-lg font-extrabold text-highlight-foreground">SC</span>
            <span className="font-display text-base font-extrabold uppercase tracking-normal">Supermarket<br />Careers</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Main navigation">
            <a className="transition-opacity hover:opacity-70" href="#supermarkets">Apply</a>
            <a className="transition-opacity hover:opacity-70" href="#roles">Open roles</a>
            <a className="transition-opacity hover:opacity-70" href="#process">How it works</a>
          </nav>
          <Button variant="inverse" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>
            {menuOpen ? <X /> : <Menu />}
          </Button>
          <Button variant="hero" size="lg" asChild className="hidden md:inline-flex">
            <a href="#supermarkets">Apply <ArrowDown /></a>
          </Button>
        </header>
        {menuOpen && (
          <nav className="absolute left-5 right-5 top-20 z-30 grid gap-1 rounded-md border border-hero-foreground/20 bg-hero p-3 md:hidden" aria-label="Mobile navigation">
            {[['Apply', '#supermarkets'], ['Open roles', '#roles'], ['How it works', '#process']].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} className="rounded px-4 py-3 text-sm font-semibold hover:bg-hero-foreground/10">{label}</a>
            ))}
          </nav>
        )}
        <div id="top" className="relative z-10 mx-auto flex min-h-[650px] max-w-[1440px] items-end px-5 pb-16 pt-20 md:px-10 lg:items-center lg:px-16 lg:pb-10">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-highlight"><Sparkles className="size-4" /> Kenya’s retail opportunity hub</p>
            <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.93] tracking-normal sm:text-6xl lg:text-8xl">
              Get Hired at Kenya’s Top Supermarkets.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-hero-muted md:text-lg">
              Discover open vacancies at Naivas, Quickmart, and Carrefour. Apply directly on official career portals and kickstart your retail career today.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button variant="hero" size="xl" asChild><a href="#supermarkets">Apply <ArrowDown /></a></Button>
              <Button variant="inverse" size="xl" asChild><a href="#roles">Explore open roles</a></Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase">
              {stores.map((store) => (
                <a
                  key={store.name}
                  href={store.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded ${store.accent} px-3 py-1.5 text-white shadow-sm transition hover:opacity-90`}
                >
                  {store.name} <ArrowUpRight className="size-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 z-10 hidden items-center gap-8 border-t border-l border-hero-foreground/20 bg-hero/80 px-8 py-5 text-xs font-bold uppercase backdrop-blur-md lg:flex">
          <span className="flex items-center gap-2"><BadgeCheck className="text-highlight" /> Official destinations</span>
          <span className="flex items-center gap-2"><ShieldCheck className="text-highlight" /> No application fees</span>
        </div>
      </section>

      <section id="supermarkets" className="px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 grid gap-6 md:grid-cols-[1fr_1fr] md:items-end">
            <div><p className="section-kicker">Choose where to apply</p><h2 className="section-title">Apply for Quickmart,<br />Naivas or Carrefour.</h2></div>
            <p className="max-w-lg text-base leading-7 text-muted-foreground md:justify-self-end">Pick any of the three supermarkets and complete your application on the company’s official careers website.</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {stores.map((store, index) => (
              <article key={store.name} className="group relative overflow-hidden rounded-lg bg-card shadow-card">
                <div className={`absolute left-0 top-0 z-10 h-1.5 w-full ${store.accent}`} />
                <div className="relative aspect-[5/4] overflow-hidden">
                  <img src={store.image} alt={`${store.name} supermarket team member`} loading="lazy" width={900} height={720} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-card font-display text-sm font-extrabold text-card-foreground">0{index + 1}</div>
                </div>
                <div className="p-6 md:p-7">
                  <div className="flex items-center justify-between gap-4"><h3 className="font-display text-3xl font-extrabold">{store.name}</h3><MapPin className="text-muted-foreground" /></div>
                  <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">{store.location}</p>
                  <p className="mt-5 min-h-14 leading-7 text-muted-foreground">{store.description}</p>
                  <Button asChild size="xl" className={`mt-6 w-full ${store.accent}`}>
                    <a href={store.url} target="_blank" rel="noreferrer">Apply at {store.name} <ArrowUpRight /></a>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="border-y border-border bg-surface px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <p className="section-kicker">Find your fit</p>
              <h2 className="section-title">Work that moves with you.</h2>
              <p className="mt-5 max-w-md leading-7 text-muted-foreground">Pick a role to see which supermarket career pages may be relevant to you.</p>
              <div className="mt-8 flex flex-wrap gap-2" aria-label="Filter roles">
                {roles.map((role) => (
                  <Button key={role} variant={selectedRole === role ? "default" : "outline"} size="sm" onClick={() => setSelectedRole(role)} className="h-9 rounded-full px-4">
                    {selectedRole === role && <Check />}{role}
                  </Button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 shadow-card md:p-5">
              <div className="flex items-center justify-between border-b border-border px-2 pb-4">
                <div className="flex items-center gap-2 font-bold"><Search className="size-4 text-primary" /> Matching supermarkets</div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{filteredStores.length} found</span>
              </div>
              <div className="divide-y divide-border">
                {filteredStores.map((store) => (
                  <div key={store.name} className="grid gap-5 px-2 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex items-center gap-3"><span className={`size-2.5 rounded-full ${store.accent}`} /><h3 className="font-display text-xl font-bold">{store.name}</h3></div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {store.roles.map((role) => <span key={role} className="rounded bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{role}</span>)}
                      </div>
                    </div>
                    <Button variant="outline" size="lg" asChild><a href={store.url} target="_blank" rel="noreferrer">View careers <ArrowUpRight /></a></Button>
                  </div>
                ))}
                {filteredStores.length === 0 && <div className="py-14 text-center text-muted-foreground">No matching supermarket listed. Try another role.</div>}
              </div>
              <div className="mt-2 flex gap-3 rounded-md bg-warning p-4 text-sm leading-6 text-warning-foreground"><CircleAlert className="mt-0.5 size-5 shrink-0" /><p><strong>Stay alert:</strong> Genuine employers do not ask you to pay an application or interview fee.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 max-w-2xl"><p className="section-kicker">Your next move</p><h2 className="section-title">A clear way forward.</h2></div>
          <div className="grid border-y border-border md:grid-cols-3">
            {[
              { icon: Search, n: "01", title: "Explore", text: "Choose a retailer and review the roles that match your skills." },
              { icon: ArrowUpRight, n: "02", title: "Apply officially", text: "We send you directly to the company’s official career destination." },
              { icon: Users, n: "03", title: "Meet the team", text: "If shortlisted, the employer contacts you about the next step." },
            ].map((step) => (
              <article key={step.n} className="border-b border-border py-9 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0">
                <div className="flex items-center justify-between"><step.icon className="size-7 text-primary" /><span className="font-mono text-xs font-bold text-muted-foreground">{step.n}</span></div>
                <h3 className="mt-12 font-display text-2xl font-bold">{step.title}</h3><p className="mt-3 max-w-sm leading-7 text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-hero px-5 py-16 text-hero-foreground md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-bold uppercase text-highlight">Ready when you are</p><h2 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-normal md:text-5xl">Bring your energy. Build your future in retail.</h2></div>
          <Button variant="hero" size="xl" asChild><a href="#supermarkets">Apply now <ChevronRight /></a></Button>
        </div>
      </section>

      <footer className="bg-background px-5 py-10 md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p className="font-display font-bold text-foreground">Supermarket Careers</p>
          <p>Independent careers directory. Not affiliated with the listed retailers.</p>
          <a href="#top" className="font-bold text-foreground hover:text-primary">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
