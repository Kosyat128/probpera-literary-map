import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChildNativeJourneyView, childJourneyLabels } from "./ChildNativeJourneyView";
import type { ChildNativeAppController } from "./childNativeAppBridge";
const port={list:vi.fn(async()=>[]),readProgress:vi.fn(async()=>null),open:vi.fn(async()=>null),advance:vi.fn(async()=>null),close:vi.fn(async()=>true)};
const controller={journeys:port} as unknown as ChildNativeAppController;
const props={controller,contextToken:"a".repeat(32),profileId:"profile-a",navigationEpoch:0,homeVisible:true,onActiveChange:vi.fn(),onIntentChange:vi.fn(),onNode:vi.fn()};
describe("native child journey closed-first presentation",()=>{
 it("has equal RU/EN child actions and calm completion without purchase or streak pressure",()=>{
  expect(Object.keys(childJourneyLabels.ru)).toEqual(Object.keys(childJourneyLabels.en));
  expect(childJourneyLabels.ru.continue).toBe("Продолжить");expect(childJourneyLabels.en.continue).toBe("Continue");
  expect(JSON.stringify(childJourneyLabels)).not.toMatch(/buy|purchase|streak|leaderboard|купить/iu);
 });
 it("initial RU/EN renders a checking state and cannot fetch native content or manufacture progress during render",()=>{
  for(const language of ["ru","en"] as const){const markup=renderToStaticMarkup(<ChildNativeJourneyView {...props} language={language}/>);
   expect(markup).toContain('aria-busy="true"');expect(markup).toContain(childJourneyLabels[language].loading);expect(markup).not.toContain("data-child-journey-node=");}
  expect(port.list).not.toHaveBeenCalled();expect(port.open).not.toHaveBeenCalled();expect(port.advance).not.toHaveBeenCalled();
 });
 it("an absent child journey port does not create adult continuation or an uncontrolled text surface",()=>{
  expect(renderToStaticMarkup(<ChildNativeJourneyView {...props} controller={{} as ChildNativeAppController} language="en"/>)).toBe("");
  expect(port.open).not.toHaveBeenCalled();
 });
});