import { describe, expect, it } from "vitest";
import { parseShowcasePins, selectHeaderArticles, showcaseDate, type ShowcaseArticle } from "./headerArticleSelection";
const article = (id: string, values: Partial<ShowcaseArticle> = {}) => ({id, title: id, description: `Full ${id}`, publishedAt:"2026-09-01", publishedLabel:"1 сентября 2026", sectionId:"reviews", ...values} as ShowcaseArticle);
const now = Date.parse("2026-09-26T00:00:00Z");
const pin = (articleId: string) => ({articleId,order:0,startsAt:"2026-09-25T00:00:00Z",endsAt:"2026-09-27T00:00:00Z",timezone:"UTC" as const});
describe("shared header article selection", () => {
  it.each([0,1,2,6,7])("selects %s unique cards without placeholders", count => {
    const entries=Array.from({length:count},(_,i)=>article(String(i)));
    const result=selectHeaderArticles([...entries,...entries],"ru",[],now);
    expect([result.lead,...result.more].filter(Boolean)).toHaveLength(count); expect(result.count).toBe(count);
  });
  it("validates calendar dates and explicit offsets",()=>{
    expect(showcaseDate("2026-02-30")).toBeNull(); expect(showcaseDate("2026-09-26T12:00:00")).toBeNull();
    expect(showcaseDate("2026-09-26T24:00:00Z")).toBeNull();
    expect(showcaseDate("2026-09-26")).toBe(now); expect(showcaseDate("2024-02-29")).not.toBeNull();
  });
  it("filters future, draft and withdrawal before ordering; invalid dates stay last",()=>{
    const result=selectHeaderArticles([article("bad",{publishedAt:"2026-02-30"}),article("z"),article("a"),article("draft",{status:"draft"}),article("future",{publishedAt:"2027-01-01"}),article("withdrawn",{withdrawn:true})],"ru",[],now);
    expect([result.lead,...result.more].map(x=>x?.id)).toEqual(["a","z","bad"]);
  });
  it("does not select an ancient section beyond the bounded recent pool",()=>{
    const recent=Array.from({length:28},(_,i)=>article(String(i).padStart(2,"0")));
    const result=selectHeaderArticles([...recent,article("old",{sectionId:"ancient",publishedAt:"1999-01-01"})],"ru",[],now);
    expect(result.more.some(x=>x.id==="old")).toBe(false);
  });
  it("honours ordered timed pins, marks choice and falls back on expiry or withdrawal",()=>{
    const old=article("old",{publishedAt:"1999-01-01"}); const entries=[article("new"),old];
    expect(selectHeaderArticles(entries,"ru",[pin("old")],now)).toMatchObject({lead:{id:"old"},editorialChoice:true});
    expect(selectHeaderArticles(entries,"ru",[pin("old")],now+2*86400000).lead?.id).toBe("new");
    expect(selectHeaderArticles([entries[0],{...old,withdrawn:true}],"ru",[pin("old")],now).lead?.id).toBe("new");
    expect(selectHeaderArticles(entries,"en",[pin("old")],now).lead).toBeUndefined();
  });
  it("rejects duplicate pins and ambiguous timezone",()=>{
    expect(()=>parseShowcasePins([pin("x"),pin("x")])).toThrow(); expect(()=>parseShowcasePins([{...pin("x"),startsAt:"2026-09-25T00:00:00"}])).toThrow();
  });
});
