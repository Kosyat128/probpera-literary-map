import { useEffect } from "react";

import { cmsSiteContent } from "../data/cms/site.generated";
import { buildCmsSiteDesignStylesheet } from "../data/cms/siteDesign";
import {
  cmsTypographyPageTarget,
  cmsTypographyTemplateTarget,
} from "../data/cms/siteTypography";

type SiteContentWithDesign = typeof cmsSiteContent & { siteDesign?: unknown };

const siteDesign = (cmsSiteContent as SiteContentWithDesign).siteDesign;
const stylesheet = buildCmsSiteDesignStylesheet(siteDesign);

export default function SiteDesignRuntime() {
  useEffect(() => {
    const syncContext = () => {
      const pathname = window.location.pathname;
      document.body.dataset.siteStudioPage = cmsTypographyPageTarget(
        pathname,
        import.meta.env.BASE_URL
      );
      document.body.dataset.siteStudioTemplate = cmsTypographyTemplateTarget(
        pathname,
        import.meta.env.BASE_URL
      );
    };
    syncContext();
    window.addEventListener("popstate", syncContext);
    window.addEventListener("probpera:navigation", syncContext);
    return () => {
      window.removeEventListener("popstate", syncContext);
      window.removeEventListener("probpera:navigation", syncContext);
      delete document.body.dataset.siteStudioPage;
      delete document.body.dataset.siteStudioTemplate;
    };
  }, []);

  return stylesheet ? <style data-cms-site-design>{stylesheet}</style> : null;
}
