import SplashIntro from "@/components/landing/SplashIntro";
import SiteChrome from "@/components/landing/SiteChrome";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import FeatureReveal from "@/components/landing/FeatureReveal";
import HazardousWaste from "@/components/landing/HazardousWaste";
import SiteFooter from "@/components/landing/SiteFooter";

/**
 * The landing page stays a Server Component: only the animated sections
 * ship JS.
 *
 * Four sections + footer, in scroll order — the ids here are what
 * SiteChrome's nav and section rail track. The self-serve student launcher
 * lives at its own route, /learn (see app/learn/page.tsx), not embedded
 * here — "Start learning" links straight there.
 */
export default function Home() {
  return (
    <>
      <SplashIntro />
      <SiteChrome />

      <main className="grain relative">
        <Hero />
        <Problem />
        <FeatureReveal />
        <HazardousWaste />
      </main>

      <SiteFooter />
    </>
  );
}
