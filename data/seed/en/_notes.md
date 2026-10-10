# Notes and questions for the client – EN translation

Scope: `tours.json` (41), `destinations.json` (5), `categories.json` (5), `blog-posts.json` (6).
All content has `translationStatus: "machine_reviewed_pending_client"`.
Validation: `python data/seed/en/_validate.py` (result OK, 0 errors).

## A. Decisions taken (please confirm)

1. **Slug = id.** The ES JSON has no `id` field; the slug acts as the id. Since the brief asked for English slugs, the stable key between languages is the **array position + `originalUrl`** (unchanged). The ES→EN map is in `_slug-map.json`, for hreflang and the language switcher. If the app needs a shared id, adding an `id` field to both languages is recommended (that is a decision for the dev team).
2. **Cross references translated:** `destinationSlugs`, `categorySlugs` and `tourSlugs` point to the EN slugs, so the EN set is self-contained.
3. **`newPath`** → `/en/tours/<slug>`, `/en/destinations/<slug>`, `/en/categories/<slug>`, `/en/blog/<slug>`. Confirm these are the route prefixes of the EN site (the ES site uses `/es/destinos`, `/es/categorias`).
4. **Not translated:** `originalUrl`, images, `durationLabel` (`4D/3N`), dates, `author`, `price` (null), `minPax`, `featured`, `sourceTabs`. `difficulty` was translated (Fácil → Easy, Medio → Moderate) and `destinations` (Cuzco → Cusco).
5. **Units:** altitudes with feet (rounded to 10 ft); temperatures with °F. No price was converted.
6. **SEO:** EN `metaTitle` ≤ 60 and `metaDescription` ≤ 155 characters. Several ES meta descriptions ran 200+ characters, so in EN they were condensed (no new data added). `cardSummary` keeps the full text.
7. **Null in the source stays null** (including broken FAQs with `question: null` or `answer: null`, and empty `important: []`/`faqs: []`).
8. **Minor obvious fixes in EN** (the ES text was left as is): the stray "Descripció" in T6, the "** Día 05:**" artifact in T22, a stray "}" in a FAQ in T40, "13:00 p.m." → "1:00 p.m.", afternoon times written as "1:30 hrs/3:00 hrs/5:00 hrs" in T24 → p.m., the spelling Q’eswachaka, Amantaní, Inca Rail/PeruRail, Qoricancha.

## B. Commercial / content questions (need a client decision)

1. **Brand:** the blog says "Andean Peru Tours" (summary, CTAs, "30+ years of experience") and links to `andeanperutours.com/es`. Was it kept like that in EN, or should it become **Peru Wonders Tours** with links to the new site? Is "30+ years" a verified fact?
2. **Target market of the EN site:** two posts are aimed at Mexican and Colombian travelers, T18 says "designed for travelers from Spain and Latin America", and several tours list "Spanish guide" only (T9) or "tours in Spanish". Should these be published on the EN site, adapted, or left out?
3. **Blog prices:** "USD 850–1,200", "from USD 699", "from USD 850" for Peru Express/Fantastic Peru. They don't match any `price` in the catalog (all null). Are they current?
4. **Package names in the blog** ("Peru Express", "Fantastic Peru", "Spectacular Peru 10 days") don't match the catalog exactly (there's no "Peru Espectacular"). Should they be aligned?
5. **Cancellation policy:** only 4 packages have `policies`; others say "Details will be provided at the time of booking" or "see the terms table" (it doesn't exist). For an English-speaking market, a public policy is needed.
6. **Payment methods in the FAQs:** "bank transfer and Visa Online (Niubiz)". Are international cards/PayPal accepted? The answer affects EN conversion.
7. **"Interdimensional Gateway" (T34):** the commercial name was kept as is. Is a more neutral name preferred in EN?
8. **Cusco destination:** the description mentions the Inca Trail and Salkantay, which aren't in the catalog. Remove them or add products?
9. **"Tour Packages" category:** its description talks about magical practices and birdwatching (it doesn't match its tours). It was translated faithfully; it needs rewriting.
10. **Machu Picchu train included:** the FAQs say "The Voyager or similar; Vistadome/360° is an upgrade", while several `includes` say "Vistadome or higher" or "panoramic train" (T17, T18). Which class is included by default?
11. **Cusco Tourist Ticket (BTC):** T2, T7, T8, T17, T18, T21 exclude it, but they include sites that require it (city tour, Sacred Valley); T11 includes the Moray entrance yet says it requires the BTC; T14 includes Tipón/Pikillaqta (BTC). Define a single policy and reflect it in includes/notIncludes.
12. **Difficulty:** 37 of 41 tours say "Easy" even when the text says "demanding/moderate–challenging" (Vinicunca T15, Humantay T16, Waqrapukara T40, 7 Lakes T36, Colca trek T37, Pillones T9). For the EN market (where travel insurance and expectations matter), adjusting it is recommended.

## C. Errors / contradictions found in the source (translated faithfully)

- **T0 arequipa-colca-profundo-condores-4d-3n:** OK in general; "Desayuno típico" in includes vs notIncludes "only hotel breakfast".
- **T1 arequipa-ruta-rapida-ciudad-blanca-3d-2n:** `durationLabel` 1D vs 3D/2N in the title (known). Important says "includes breakfasts and lunches" but includes lists only one lunch. FAQ: "Colca reaches 4,800 m" (that's the Patapampa pass).
- **T2 aventura-andina-cusco-5d-4n:** "Entrance fees included: city tour…" vs notIncludes BTC/Cathedral/Qoricancha. Broken FAQ (question without answer + answer without question).
- **T3 canon-del-colca-y-arequipa-3d-2n:** says Chivay is at 4,800 m (it's ~3,630 m). The summary says day 3 = airport transfer; the itinerary ends with "transfer to hotel" with only 2 nights included. 9 FAQ "answers" are drafting notes ("Travelers will want to know…"), not answers. Volcanoes Misti/Chachani/Ampato vs Pichu Pichu in other tours.
- **T4 city-tour-arequipa:** title "1/2 day" with `durationLabel` 1D; summary null; no FAQs.
- **T5 cultura-titicaca-uros-llachon-taquile-3d-2n:** the title includes Taquile but the itinerary never visits it. Empty important/FAQs.
- **T6 cusco-machu-picchu-premium-4d-3n:** includes contains an internal note ("the itinerary does not specify the type of accommodation, but it is assumed to be included"). The notIncludes has a pricing note ("Price varies…"). The Machu Picchu entrance isn't listed explicitly.
- **T7 escapada-rapida-cusco-3d-2n:** only 2 itinerary entries; day 3 is merged into day 2. "Important" is a copy of the packing list. Includes doesn't list the MP entrance, but the FAQ says it's included. Private vs shared guide is ambiguous.
- **T8 explorador-imperial-cusco-4d-3n:** "important" = duplicated packing list.
- **T9 full-day-cataratas-pillones-bosque-piedras:** "Easy" vs "moderate hikes"; guide in Spanish only; private transport? Category "Tour Packages" for a full day.
- **T10 full-day-machu-picchu-esencia-ciudadela:** lunch "scheduled" vs "time for lunch". Mentions the Guardhouse + Temple of the Sun: confirm compatibility with the current circuits. No FAQs.
- **T11 full-day-maras-moray-sal-anden:** meta says "half day" vs full day; contradiction about the Moray/BTC entrance.
- **T12 full-day-ruta-sillar-arquitectura-volcanica:** 7 FAQs are drafting notes. Visits the Santa Catalina Monastery without the entrance being included. "Luxury private vehicle" vs "private or shared".
- **T13 full-day-salinas-aguada-blanca-fauna-andina:** includes "Photos and unique moments" (not a service). The source already had English ("Breathtaking views:").
- **T14 full-day-valle-sur-cusco-descubrimiento:** Tipón/Pikillaqta require the BTC; confirm. No FAQs.
- **T15 full-day-vinicunca-montana-arcoiris:** "Easy" vs "one of the most demanding". Summit at 5,200 m (the viewpoint is usually cited as ~5,036 m).
- **T16 laguna-humantay-espejo-turquesa:** **truncated itinerary** (only the 4:30 departure; no hike, lunch or return). Says Mollepata is to the "northeast" (it's west). "Easy" vs FAQ "highly demanding". 1 h 40 hike identical to Vinicunca (copy?).
- **T17 lo-mejor-peru-en-5-dias-5d-4n:** destinations null; train class contradiction; duplicated transfer; "City Tour" in the day 1 title but optional.
- **T18 peru-de-ensueno-andes-incas-8d-7n:** destinations null; "Spain and Latin America" (see B2); lodging "2 nights" without naming Lima.
- **T19 peru-especial-…-14-dias-13-noches:** excludes the Lima–Arequipa flight but the itinerary is overland (Nazca→Arequipa). "10 lunches" can't be traced in the itinerary.
- **T20 peru-express-…-5-dias-4-noches:** meta/cardSummary says "Includes suggested domestic flights" while flights are **not** included (misleading). Itinerary titles null (the title goes inside the description).
- **T21 peru-magico-cusco-lima-6d-5n:** destinations null; first FAQ without a question; "gourmet lunch (not included)" inside includes; "train back to Cusco" (it goes to Ollantaytambo/Poroy).
- **T22 peru-milenario-…-10-dias:** 3 FAQs with question null and the question inside the answer. Day 3: Colca + 6 h of bus to Puno on the same day after a very early start (feasibility?).
- **T23 puno-clasico-lago-titicaca-3d-2n:** empty important/FAQs; no category.
- **T24 qeswachaka-experiencia-ultimo-puente-inca:** times with no a.m./p.m.; "Queswachaca" vs "Q’eswachaka". Confirm whether crossing is possible during the June renewal week.
- **T25 ruta-del-sol-puno-desde-cusco-3d-2n:** pickup vs "departure 6:30 from the bus station"; La Raya "over 4,300 m" vs 4,335 m; guide "in Puno" only. Empty important/FAQs.
- **T26 rutas-andinas-…-8-dias-7-noches:** "Puno is the highest point (3,827 m)" but La Raya (4,335 m) is crossed on day 4. The policies mention a "terms table" that doesn't exist.
- **T27 tour-campina-arequipa / T28 sillustani / T29 tour-full-day-canon-del-colca / T30 uros-taquile / T31 uros / T32 titicaca-2-dias / T33 salinas-lojen / T34 aramu-muru / T35 inka-uyo:** summary null and no FAQs in almost all of them. T29: Patapampa 4,910 m vs 4,800 m in T1/T3/T13 (unify; 4,910 m is the usual figure); lunch not included while T1 (same full day) includes it. T31: duplicated sentence and the typo "desafante"; the summary is a list of places. T33: "box lunch or traditional dish" with no meal included (who pays?). T34/T35: private tours with `minPax` 2. T35: "patrimonio lícito" (lítico).
- **T36 trekking-7-lagunas-tour:** the lake list includes "Sibinacocha" (a distant lake) and "Otorongo"; verify. "600 minutes of activity" vs a 15 h day.
- **T37 trekking-canon-del-colca-2-dias:** OK; the summary only lists places.
- **T38 valle-sagrado-incas:** order Pisac 8:30 → Taray 10:00 (Taray comes before Pisac on the road); guide duplicated in includes; BTC not included (make it visible).
- **T39 vivencia-titicaca-uros-amantani-taquile-3d-2n:** the 2nd night (Puno hotel) isn't listed in includes; "UNESCO says the best weavers in the world" (overstated).
- **T40 waqrapukara-fortaleza-entre-nubes:** "Easy" vs "moderate to challenging"; builders "quinchas" (Qanchis?); "south of the Sacred Valley" (it's south of Cusco); the important item "Safety on the route:" is split into two items.

## D. Blog

1. **Dates vs content:** "Cusco, the Best City…" is dated 2026-09-28 but talks about "2025" awards; Colombia/Mexico are dated 2025. Review whether the date or the text should be updated.
2. **Train post:** the `summary` has nothing to do with the content (it describes a night show in Cusco), and the `imageAlt` talks about the Rainbow Mountain. The two lists (Inca Rail, PeruRail) have no company subheading. YouTube links are third-party.
3. **BTC post:** the `summary` is cut off in the source ("…y la Di") → kept truncated ("…and the Di…"). Prices (S/ 130 / 70 / 40) and site lists need to be checked against the current BTC rates.
4. **"Useful Facts About Peru" post:** several facts are outdated or wrong in the source (translated faithfully): population "30 million" (~34 M today); "Nuevo Sol" (today "Sol"); holiday list (includes non-holidays such as Pisco Sour Day, Andean Song Day and the anniversary of Huaraz; leaves out Jun 7, Jun 29, Aug 6, Dec 9, etc.); time zones ("Madrid ()" empty, London 14:00 and Paris 19:00 wrong); passport "90 days" validity vs "6 months" in the tours; traveler's checks. A content rewrite is recommended before publishing.
5. 7 body images are hosted on `turinet.turismoads.com` (already flagged in the extraction report).
