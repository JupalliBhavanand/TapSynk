import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { isSupabaseConfigured } from "@/lib/env";
import { getUser } from "@/lib/supabase/server";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const signedIn = isSupabaseConfigured() ? Boolean((await getUser()).user) : false;
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      {children}
      <SiteFooter />
    </>
  );
}
