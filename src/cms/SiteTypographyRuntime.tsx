import { useEffect } from "react";

import { cmsSiteContent } from "../data/cms/site.generated";
import {
  buildCmsTypographyStylesheet,
  cmsTypographyPageTarget,
  cmsTypographyTemplateTarget,
} from "../data/cms/siteTypography";

type SiteContentWithTypography = typeof cmsSiteContent & {
  typography?: unknown;
};

const typographySnapshot = (cmsSiteContent as SiteContentWithTypography).typography;
const typographyStylesheet = buildCmsTypographyStylesheet(
  typographySnapshot,
  import.meta.env.BASE_URL
);

export default function SiteTypographyRuntime() {
  useEffect(() => {
    const previous = {
      page: document.body.dataset.typographyPage,
      template: document.body.dataset.typographyTemplate,
    };
    const syncContext = () => {
      const pathname = window.location.pathname;
      const pageTarget = cmsTypographyPageTarget(pathname, import.meta.env.BASE_URL);
      document.body.dataset.typographyPage = pageTarget;
      document.body.dataset.typographyTemplate = cmsTypographyTemplateTarget(
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
      if (previous.page) document.body.dataset.typographyPage = previous.page;
      else delete document.body.dataset.typographyPage;
      if (previous.template) document.body.dataset.typographyTemplate = previous.template;
      else delete document.body.dataset.typographyTemplate;
    };
  }, []);

  return typographyStylesheet ? (
    <style data-cms-typography>{typographyStylesheet}</style>
  ) : null;
}
