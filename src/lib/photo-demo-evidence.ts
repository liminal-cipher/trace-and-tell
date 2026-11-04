// Curated public excerpts; no workspace, account, run IDs or live provider imports.
export const photoTextStudy = {
  image: "/demo/storefront.webp",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:A_NEWLY_RESTORED_AND_PAINTED_OLDER_STOREFRONT_ON_MINNESOTA_STREET_IN_NEW_ULM,_MINNESOTA._THE_BUILDING_NOW_HOUSES_A..._-_NARA_-_558126.jpg",
  observation: "Storefront fascia bears the text 'stevensons' in stylized yellow lettering.",
  overclaim: "Ground floor has a central entrance flanked by large display windows containing standing mannequins in dresses, with an additional door on the right side of the storefront.",
} as const;

export const photoStories = [
  {
    "id": "photo-02",
    "label": "A meal together",
    "exhibitTitle": "A place at the table",
    "practiceAnswers": [
      "Jars like these remind me of keeping leftovers after a shared meal. I cannot remember what was in them that day. This is an invented practice memory.",
      "Those baked items remind me of making bread together. I cannot remember the recipe. This is an invented practice answer."
    ],
    "alt": "Historical colour photograph of four people around a checked table with plates, cups and glass jars.",
    "image": "/demo/photo-02.jpg",
    "width": 1600,
    "height": 1117,
    "credit": "Russell Lee / Library of Congress, FSA-OWI Collection, LC-USF35-326",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:The_Faro_Caudill_(family)_eating_dinner_in_their_dugout,_Pie_Town,_New_Mexico_LCCN2017877693.jpg",
    "rightsUrl": "https://wwws.loc.gov/rr/print/res/072_fsac.html",
    "edition": "Web display derivative; source metadata is removed. Commons original JPEG edition, 4737×3308, from a slide scan. The model receives a separate max-2048px PNG.",
    "observation": "Table surface holds white plates, white cups, drinking glasses, glass jars, forks, knives, spoons, a yellow cup, two small shaker-type containers, a bowl of dark food, and a plate of round browned baked items.",
    "locator": "on table surface in center and foreground",
    "uncertainty": "Exact contents of dishes and jars are not labeled in the view; food descriptions are appearance only.",
    "questions": [
      "What was typically kept in the large glass jars seen on the table?",
      "What do you know about the round baked items on the plate, such as what they were?"
    ]
  },
  {
    "id": "photo-01",
    "label": "A room full of details",
    "exhibitTitle": "A room remembered",
    "practiceAnswers": [
      "A picture like that made a room feel familiar. I don’t remember where it came from. This is an invented practice answer.",
      "Cloths like these remind me of covering shelves at home. I cannot remember how these particular cloths were used. This is an invented practice answer."
    ],
    "alt": "Historical colour photograph of seven people seated indoors with a framed picture, wall calendar and patterned fabrics behind them.",
    "image": "/demo/photo-01.jpg",
    "width": 1024,
    "height": 792,
    "credit": "Russell Lee / Library of Congress, FSA-OWI Collection, LC-USF35-585",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jack_Whinery_and_his_family,_homesteaders_1a34169v.jpg",
    "rightsUrl": "https://wwws.loc.gov/rr/print/res/072_fsac.html",
    "edition": "Web display derivative; source metadata is removed. Commons original JPEG edition, 1024×792. Not the archival master.",
    "observation": "Interior wall behind the group appears covered with paper or board panels, with a framed landscape picture centered above, a curtained opening to the right of center, and patterned cloths hanging on the right wall.",
    "locator": "Background upper half of image.",
    "uncertainty": "Wall material description limited by image resolution; picture subject only generally discernible.",
    "questions": [
      "How did the framed landscape picture come to hang on that wall?",
      "What were the patterned cloths hanging on the right wall used for?"
    ]
  },
  {
    "id": "photo-03",
    "label": "A quilt and its story",
    "exhibitTitle": "Patterns worth remembering",
    "practiceAnswers": [
      "A quilt like this reminds me of keeping warm on winter evenings. I do not remember where this one was kept. This is an invented practice answer.",
      "The many squares bring back memories of mending things together. I don’t know who assembled this quilt. This is an invented practice answer."
    ],
    "alt": "Historical colour photograph of a person standing outdoors beside a large quilt with a grid of patterned squares.",
    "image": "/demo/photo-03.jpg",
    "width": 500,
    "height": 386,
    "credit": "Russell Lee / Library of Congress, FSA-OWI Collection, LC-USF35-577",
    "sourceUrl": "https://www.flickr.com/photos/library_of_congress/2178354733/",
    "rightsUrl": "https://wwws.loc.gov/rr/print/res/072_fsac.html",
    "edition": "Web display derivative; source metadata is removed. Official LoC Flickr preview, 500×386. Limited detail; not the archival master. No enlargement.",
    "observation": "A large quilt with a pink-patterned border and a grid of light-colored squares each containing a small central design hangs from a line.",
    "locator": "center and right of image, occupying most of vertical frame",
    "uncertainty": "Designs and any lettering inside squares are illegible at this resolution",
    "questions": [
      "Do you remember where this quilt was kept or how it was used?",
      "Do you remember anything about how the many small squares came together?"
    ]
  }
] as const;
export const photoEvaluation = {
  "scope": "This photo pilot made 17 actual requests across three historical photographs and four comparison cases: three observations, eight comparisons and six clue-based inquiries. All returned structurally valid responses. Human quality review is pending for all 17; this is not an accuracy score.",
  "limitations": "The photographs come from one historical collection. One is a 500-pixel preview with largely unreadable small lettering. Names, kinship, capture dates and the truth of remembered stories are not established by this test.",
  "tuning": "A separate follow-up made 33 new requests on these three photos and the storefront: High/Max effort comparisons and two prompt strategies, with a Medium cross-check. Some overclaims disappeared, but omissions and unhelpful questions remained. Assistant comparison did not establish a consistent quality gain, so the app still defaults to Medium. Human review remains pending; the excerpts above have not been replaced by selected better-looking outputs.",
  "improvement": "The first questions often repeated visible details or reassurance. A revised instruction produced shorter questions about missing context. An initial comparison also treated different scenes as contradictory evidence; the revised result placed missing links under uncertainty. A remaining comparison still called the people different without establishing their identities. That claim is unverified and is retained as an error for review. These are assistant-reviewed examples, not human-confirmed quality scores."
} as const;
