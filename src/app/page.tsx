import Link from "next/link";
import { ArrowRight, Calendar, CalendarCheck2, Check, ChevronRight, Gem, Link2, Target, Upload, Users, Zap } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { WelcomeBackPanel } from "@/components/landing/welcome-back-panel";
import { consultationOfferings } from "@/lib/consultations/offerings";

export const metadata = { title: "KYM Mail", description: "Your inbox. Your career. Your future." };

const nav = [
  { href: "#top", label: "Home" },
  { href: "#consultations", label: "Consultations" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" }
];

const benefits = [
  { icon: Target, lines: ["Personalized", "Strategy"] },
  { icon: Users, lines: ["Real-World", "Insights"] },
  { icon: Zap, lines: ["Actionable", "Next Steps"] },
  { icon: Gem, lines: ["Your Goals.", "My Expertise."] }
];

const steps = [
  { icon: Calendar, title: "1. Book", text: "Choose your consultation option and complete payment via Zelle." },
  { icon: Upload, title: "2. Upload Proof", text: "Submit your payment proof for manual review." },
  { icon: Link2, title: "3. Get Your Link", text: "Once approved, you'll receive a secure booking link." },
  { icon: CalendarCheck2, title: "4. Pick a Time", text: "Select your preferred time on Cal.com, and it's added to your Google Calendar." }
];

const footerLinks = [
  { href: "/app/inbox", label: "Mail" },
  { href: "/app/career", label: "Career" },
  { href: "/app/projects", label: "Projects" },
  { href: "/consult", label: "Consultations" },
  { href: "/client", label: "Clients" }
];

const fieldLink = "text-[11px] font-semibold uppercase tracking-[.16em] text-[#C5D0E0] transition duration-200 hover:text-white";

export default function Home() {
  const firstTime = consultationOfferings.FIRST_TIME;
  const returning = consultationOfferings.RETURNING;
  const cards = [
    {
      href: "/consult?kind=FIRST_TIME#intake",
      action: "Book Now",
      badge: "Most popular",
      title: "First-Time Consultation",
      price: `$${firstTime.priceCents / 100}`,
      duration: `${firstTime.durationMinutes} Minutes`,
      points: ["Career strategy & market insights", "Resume & positioning review", "Personalized action plan"],
      featured: true
    },
    {
      href: "/client/sign-in",
      action: "Sign in",
      badge: null,
      title: "Returning Consultation",
      price: `$${returning.priceCents / 100}`,
      duration: `${returning.durationMinutes} Minutes`,
      points: ["Progress review & updates", "New opportunities & strategies", "Continued career support"],
      featured: false
    },
    {
      href: "/client/register",
      action: "Create account",
      badge: null,
      title: "Quick Consult",
      price: "No fee",
      duration: "15 Minutes",
      points: ["Focused Q&A session", "Quick strategy session", "Great for urgent questions"],
      featured: false,
      optional: true
    }
  ];

  return (
    <main id="top" className="bg-[#05070D] text-[#F4F7FB]">
      <section className="relative overflow-hidden lg:h-[clamp(500px,35.5vw,545px)]">
        <div aria-hidden="true" className="absolute inset-0 bg-[#05070D] lg:hidden" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-[#05070D] lg:block">
          <div
            className="absolute inset-y-0 left-1/2 w-full max-w-[1536px] -translate-x-1/2"
            style={{
              backgroundImage: "url('/brand/dashboard-image.png')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "left top",
              backgroundSize: "1200px auto"
            }}
          />
        </div>

        <div className="relative z-10 mx-auto flex h-full w-[min(calc(100%-2rem),1360px)] flex-col sm:w-[min(calc(100%-4rem),1360px)]">
          <header className="flex h-16 items-center gap-3 lg:h-20">
            <div className="lg:w-[220px] lg:shrink-0">
              <div className="lg:hidden"><BrandLockup href="/" priority /></div>
            </div>
            <nav aria-label="Page" className="hidden min-w-0 flex-1 items-center justify-center gap-6 lg:flex">
              {nav.map((item) => (
                <a key={item.href} href={item.href} className={`relative py-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[#C5D0E0] transition duration-200 hover:text-white ${item.href === "#top" ? "text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-[linear-gradient(90deg,#22D3EE_70%,#D946EF)]" : "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-[linear-gradient(90deg,#22D3EE,#D946EF)] after:transition after:duration-200 hover:after:scale-x-100"}`}>{item.label}</a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 lg:ml-0 lg:w-[220px] lg:justify-end">
              <a href="#account-pin" className="text-xs font-semibold text-white underline decoration-[#22D3EE]/70 underline-offset-4 transition duration-200 hover:decoration-[#D946EF]">Sign In</a>
              <Link href="/client/register" className="kym-action inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-[11px] font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(34,211,238,.3)] active:translate-y-0 motion-reduce:transform-none">Create Account</Link>
            </div>
          </header>
          <nav aria-label="Page" className="flex flex-wrap gap-x-4 gap-y-1 pb-3 lg:hidden">
            {nav.map((item) => <a key={item.href} href={item.href} className={fieldLink}>{item.label}</a>)}
          </nav>

          <div className="grid min-h-0 flex-1 items-center gap-6 pb-5 lg:grid-cols-[minmax(0,460px)_minmax(80px,1fr)_minmax(260px,385px)] lg:gap-4 lg:pb-4">
            <div className="max-w-[28rem] lg:pt-8">
              <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#67E8F9]">Professional consultations</p>
              <h1 className="mt-2 text-[1.85rem] leading-[1.02] font-semibold tracking-[-.04em] uppercase sm:text-[2.15rem] xl:text-[2.35rem]">
                <span className="block text-[#22D3EE]">Strategy.</span>
                <span className="block bg-[linear-gradient(90deg,#2563EB,#8B5CF6)] bg-clip-text text-transparent">Opportunity.</span>
                <span className="block text-[#D946EF]">Results.</span>
              </h1>
              <p className="mt-3 max-w-[26rem] text-sm leading-5 text-[#C5D0E0]">Get expert guidance on your career, job search, and professional growth — with a consultation designed around you.</p>
              <ul id="features" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <li key={benefit.lines.join(" ")} className={`group cursor-default transition duration-200 hover:-translate-y-[3px] motion-reduce:transform-none ${index > 0 ? "lg:border-l lg:border-white/15 lg:pl-3" : ""}`}>
                      <Icon className="size-4 text-[#22D3EE] transition duration-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_#22D3EE] motion-reduce:transform-none" />
                      <p className="mt-1 text-[11px] leading-4 font-semibold text-[#C5D0E0] transition duration-200 group-hover:text-white">{benefit.lines[0]}<br />{benefit.lines[1]}</p>
                    </li>
                  );
                })}
              </ul>
              <Link href="/consult?kind=FIRST_TIME#intake" className="kym-action group mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_10px_28px_rgba(34,211,238,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#22D3EE] active:translate-y-0 active:scale-[.99] motion-reduce:transform-none">
                Book Your First Consultation <ArrowRight className="size-4 transition duration-200 group-hover:translate-x-1 motion-reduce:transform-none" />
              </Link>
              <p className="mt-2 text-[11px] text-[#93A0B5]">No account required. Just pay, upload proof, and get started.</p>
            </div>
            <div aria-hidden="true" className="hidden lg:block" />
            <div className="justify-self-end">
              <WelcomeBackPanel />
            </div>
          </div>
        </div>
      </section>

      <section id="consultations" className="px-4 py-4 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1360px] items-center gap-6 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:gap-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#22D3EE]">Choose your consultation</p>
            <h2 className="mt-2 text-2xl leading-none font-semibold tracking-[-.04em] text-[#F4F7FB] uppercase sm:text-[1.7rem]">Invest in your<br />next chapter</h2>
            <p className="mt-3 max-w-xs text-xs leading-5 text-[#93A0B5]">Select the option that fits your goals. All consultations include expert guidance, strategic advice, and a personalized action plan.</p>
            <div className="kym-rule mt-3" />
          </div>
          <div id="pricing" className="grid gap-3 md:grid-cols-3">
            {cards.map((card) => (
              <article key={card.title} className={`group flex h-full flex-col rounded-2xl border bg-[#101828] p-4 transition duration-300 [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#67E8F9]/70 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_24px_rgba(34,211,238,.18)] ${card.featured ? "border-[#22D3EE]/70 shadow-[0_0_18px_rgba(34,211,238,.16)]" : "border-[#1C283C]"}`}>
                <div className="flex min-h-5 items-center justify-between gap-2">
                  {card.badge ? <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#22D3EE]">{card.badge}</p> : <span />}
                  {card.optional ? <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#93A0B5]">Optional</p> : null}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[#F4F7FB]">{card.title}</h3>
                <p className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white">{card.price}</p>
                <p className="text-[11px] font-semibold text-[#67E8F9]">{card.duration}</p>
                <ul className="mt-3 space-y-1.5">
                  {card.points.map((point) => <li key={point} className="flex items-start gap-1.5 text-[11px] leading-4 text-[#C5D0E0]"><Check className="mt-0.5 size-3 shrink-0 text-[#22D3EE] transition duration-200 group-hover:scale-110 motion-reduce:transform-none" />{point}</li>)}
                </ul>
                <Link href={card.href} className={`mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] active:scale-[.99] motion-reduce:transform-none ${card.featured ? "kym-action text-white" : "border border-[#67E8F9]/50 text-[#67E8F9] hover:border-white hover:text-white"}`}>
                  {card.action} <ArrowRight className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-2 sm:px-8" aria-labelledby="how-it-works-title">
        <div className="mx-auto grid w-full max-w-[1360px] items-center gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#22D3EE]">How it works</p>
            <h2 id="how-it-works-title" className="mt-2 text-lg leading-tight font-semibold tracking-[-.03em] text-[#F4F7FB] uppercase">Simple. Secure. Convenient.</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="group flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,#22D3EE,#2563EB_55%,#8B5CF6)] text-white shadow-[0_0_16px_rgba(34,211,238,.28)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_20px_rgba(217,70,239,.4)] motion-reduce:transform-none"><Icon className="size-4" /></span>
                    <h3 className="mt-2 text-xs font-semibold text-[#F4F7FB] transition duration-200 group-hover:text-white">{step.title}</h3>
                    <p className="mt-1 text-[11px] leading-4 text-[#93A0B5] transition duration-200 group-hover:text-[#C5D0E0]">{step.text}</p>
                  </div>
                  {index < steps.length - 1 ? <ChevronRight className="mt-2 hidden size-4 shrink-0 text-[#22D3EE]/70 transition duration-200 group-hover:translate-x-1 xl:block motion-reduce:transform-none" /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <footer id="contact" className="border-t border-[#1C283C] px-4 py-2 sm:px-8">
        <div className="mx-auto grid w-full max-w-[1360px] items-center gap-3 lg:grid-cols-[minmax(180px,280px)_minmax(0,1fr)_auto]">
          <div>
            <BrandLockup href="/" className="h-8 w-auto object-contain" />
            <p className="mt-2 text-[11px] text-[#93A0B5]">Your inbox. Your career. Your future.</p>
            <a href="mailto:kym@kymmailapp.com" className="mt-1 inline-flex text-[11px] font-semibold text-[#67E8F9] underline decoration-[#22D3EE]/40 underline-offset-2 transition hover:decoration-[#D946EF]">kym@kymmailapp.com</a>
          </div>
          <p className="max-w-sm text-sm leading-5 text-[#C5D0E0] lg:mx-auto lg:text-center">“Professional guidance isn&apos;t a luxury—it&apos;s a strategic advantage.”</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {footerLinks.map((item, index) => (
              <span key={item.href} className="flex items-center gap-3">
                {index > 0 ? <span aria-hidden="true" className="hidden h-3 w-px bg-white/20 sm:block" /> : null}
                <Link href={item.href} className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#C5D0E0] transition duration-200 hover:text-[#67E8F9] hover:underline">{item.label}</Link>
              </span>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
