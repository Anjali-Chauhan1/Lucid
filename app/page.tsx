import SplashIntro from "@/components/landing/SplashIntro";
import SiteChrome from "@/components/landing/SiteChrome";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import FeatureReveal from "@/components/landing/FeatureReveal";
import SiteFooter from "@/components/landing/SiteFooter";

/**
 * The landing page stays a Server Component: only the animated sections
 * ship JS.
 *
 * Three sections + footer, in scroll order — the ids here are what
 * SiteChrome's nav and section rail track. Everything past "How it works"
 * (Grasp Score, the parrot detector, the three modes, the concept universe,
 * Classroom) has been pulled from the page; those components are still on
 * disk in components/landing/, just no longer imported here.
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
      </main>

      <SiteFooter />
    </>
  );
}
