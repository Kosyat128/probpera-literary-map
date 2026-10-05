import { useLayoutEffect } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { ChildNativeClosedView, ChildNativeReadyView } from "../child/ChildNativeBoundary";
import type { ChildNativeAppController, ChildNativeAppSnapshot } from "../child/childNativeAppBridge";

/** The caller is the concrete native host after a genuine child admission.
 * This component owns no Canvas, renderer, permission, storage or locale context. */
export function nativeChildSceneHostMatchesProfile(snapshot: ChildNativeAppSnapshot, profileId: string): boolean {
  return snapshot.context === null
    ? snapshot.phase === "sealed" || snapshot.phase === "transition"
    : snapshot.context.mode === "child" && snapshot.context.profileId === profileId;
}
export function NativeChildSceneHost({ controller, snapshot, profileId }: {
  controller: ChildNativeAppController; snapshot: ChildNativeAppSnapshot; profileId: string;
}) {
  const { language, setLanguage } = useInterfaceLanguage();
  const matches = nativeChildSceneHostMatchesProfile(snapshot, profileId);
  useLayoutEffect(() => {
    const c=snapshot.context;
    // Locale comes only from a newly admitted exact native child context.
    // The existing single provider remains mounted, with the same host owner.
    if(matches&&snapshot.phase==="ready"&&snapshot.status==="child"&&c&&c.locale!==language)setLanguage(c.locale);
  }, [matches, snapshot, language, setLanguage]);
  if(!matches)return <ChildNativeClosedView snapshot={snapshot} controller={controller}/>;
  return <ChildNativeReadyView controller={controller} snapshot={snapshot} retainedProfileId={profileId}/>;
}
