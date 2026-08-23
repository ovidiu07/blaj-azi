import assert from "node:assert/strict";
import test from "node:test";

const rich = await import("../app/rich-text.ts");
const theme = await import("../app/theme.ts");
const cms = await import("../app/site-content.ts");
const content = await import("../app/server/content.ts");

test("rich text round-trips semantic blocks, marks, lists and safe links", () => {
  const document = {
    version:1, type:"rich-text", blocks:[
      {type:"heading2",children:[{text:"Titlu semantic"}]},
      {type:"paragraph",children:[{text:"Text ",marks:["bold"]},{text:"sigur",href:"/despre"}]},
      {type:"bulletList",items:[[{text:"Primul"}],[{text:"Al doilea",marks:["italic"]}]]},
    ],
  };
  const serialized = rich.serializeRichText(document,{required:true,maxCharacters:1000});
  assert.deepEqual(rich.normalizeRichText(serialized), document);
  assert.equal(rich.richTextToPlainText(serialized), "Titlu semantic\n\nText sigur\n\nPrimul\nAl doilea");
  assert.match(rich.richTextToEditorHtml(serialized), /<h2>.*<strong>Text <\/strong><a href="\/despre">sigur<\/a>.*<ul>/s);
  assert.equal(rich.safeRichTextHref("javascript:alert(1)"), null);
  assert.equal(rich.safeRichTextHref("/evenimente?period=weekend"), "/evenimente?period=weekend");
});

test("legacy plain text is preserved without treating supplied HTML as executable markup", () => {
  const legacy = "Primul paragraf\n\n<script>alert(1)</script>";
  const document = rich.normalizeRichText(legacy);
  assert.equal(rich.richTextToPlainText(document), legacy);
  const html = rich.richTextToEditorHtml(document);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("theme defaults establish the civic discovery identity and meet publish contrast", () => {
  const defaults = cms.defaultSiteContent("theme.site");
  assert.deepEqual(defaults, theme.defaultTheme);
  assert.deepEqual(theme.validateTheme(defaults), defaults);
  assert.ok(theme.themeContrastChecks(defaults).every(item => item.pass));
  assert.equal(theme.themeCssProperties(defaults)["--color-accent"], "#c44b32");
  assert.equal(theme.homeThemeCssProperties(defaults)["--home-hero-background"], "#eaf1ee");
  assert.equal(theme.homeThemeCssProperties(defaults)["--home-jobs-background"], "#eaf1ee");
});

test("theme drafts accept valid colors while publish validation rejects weak contrast", () => {
  const draft = { ...theme.defaultTheme, text:"#faf8f4" };
  assert.equal(cms.validateSiteContent("theme.site",draft).text,"#faf8f4");
  assert.throws(() => theme.validateTheme(draft), /Contrast insuficient/);
  assert.throws(() => cms.validateSiteContent("theme.site",{...draft,accent:"red"}), /HEX completă/);
  assert.throws(() => cms.validateSiteContent("theme.site",{...draft,headingFont:"comic-sans"}), /valoare neacceptată/);
});

test("business publication has exactly the five required content fields and accepts no category", () => {
  const ready={type:"business",title:"Atelier local",locality:"Blaj",excerpt:rich.serializeRichText("Servicii pentru comunitate."),details:{address:"Strada Exemplu 1",phone:"+40 700 000 000"}};
  assert.doesNotThrow(()=>content.validateBusinessPublicationInput(ready));
  for(const [field,patch] of [
    ["title",{title:""}], ["locality",{locality:""}], ["excerpt",{excerpt:""}],
    ["address",{details:{...ready.details,address:""}}], ["phone",{details:{...ready.details,phone:"12"}}],
  ]) assert.throws(()=>content.validateBusinessPublicationInput({...ready,...patch}),error=>error.code==="publication_incomplete",field);
  assert.doesNotThrow(()=>content.validateBusinessPublicationInput({...ready,categoryId:null,details:{...ready.details,website:"",contactEmail:""}}));
});
