"""Validate the English seed (data/seed/en) against the Spanish source (data/seed).

Run:  python data/seed/en/_validate.py
Exit code 0 = all checks passed, 1 = at least one error.

Identity rule: the Spanish JSON has no separate id field; the slug acts as id and is
translated on purpose. The stable cross-language key is therefore the array position
plus `originalUrl` (unchanged). _slug-map.json maps ES slug -> EN slug.
"""
import json, re, sys, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
FILES = ["tours", "destinations", "categories", "blog-posts"]
STATUS = "machine_reviewed_pending_client"
# Fields whose text is translated (everything else must be byte-identical to the source).
TRANSLATABLE = {
    "tours": {"slug", "newPath", "title", "shortTitle", "metaTitle", "metaDescription", "destinations",
              "destinationSlugs", "categorySlugs", "difficulty", "cardSummary", "description", "summary",
              "itinerary", "includes", "notIncludes", "recommendations", "important", "faqs", "policies"},
    "destinations": {"slug", "newPath", "name", "description", "tourSlugs"},
    "categories": {"slug", "newPath", "name", "tagline", "description", "tourSlugs"},
    "blog-posts": {"slug", "newPath", "title", "summary", "imageAlt", "tags", "body"},
}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# Obvious Spanish words (whole-word, case-insensitive), plus the ones requested explicitly.
SPANISH = re.compile(r"(?<![\w/.-])(del|los|las|día|días|incluye|incluido|incluida|para|con|que|también|está|"
                     r"desde|hasta|noche|noches|recorrido|viaje|traslado|almuerzo|desayuno|cena|"
                     r"llegada|salida|visita|nuestro|nuestros|usted|puede|pueden|según)(?![\w/.-])", re.I)
# Proper names / official terms that legitimately keep Spanish words.
WHITELIST = ["Cruz del Cóndor", "Plaza del Regocijo", "Boleto Turístico del Cusco", "Boleto Turístico del Colca",
             "Mansión del Fundador", "Ruta del Sol", "arroz con pollo",
             "Comité de Servicios Integrados Turísticos Culturales Cusco", "carné de extranjería"]
TOKEN = re.compile(r"\{\{m:\d+\}\}")

errors, warnings = [], []
def err(m): errors.append(m)
def warn(m): warnings.append(m)

def shape(a, b, path):
    """Same type / null-ness / list length / dict keys, recursively."""
    if (a is None) != (b is None):
        err(f"{path}: null mismatch (es={a is None}, en={b is None})"); return
    if a is None: return
    if type(a) != type(b):
        err(f"{path}: type {type(a).__name__} != {type(b).__name__}"); return
    if isinstance(a, list):
        if len(a) != len(b): err(f"{path}: length {len(a)} != {len(b)}"); return
        for i, (x, y) in enumerate(zip(a, b)): shape(x, y, f"{path}[{i}]")
    elif isinstance(a, dict):
        if set(a) != set(b): err(f"{path}: keys differ {sorted(set(a) ^ set(b))}"); return
        for k in a: shape(a[k], b[k], f"{path}.{k}")

def texts(x):
    if isinstance(x, str): yield x
    elif isinstance(x, list):
        for i in x: yield from texts(i)
    elif isinstance(x, dict):
        for v in x.values(): yield from texts(v)

data = {}
for f in FILES:
    for side, base in (("es", SRC), ("en", HERE)):
        p = os.path.join(base, f + ".json")
        try:
            data[(side, f)] = json.load(open(p, encoding="utf-8"))
        except Exception as e:
            err(f"{side}/{f}.json: invalid JSON ({e})")
if errors:
    print("\n".join(errors)); sys.exit(1)

counts = {}
for f in FILES:
    es, en = data[("es", f)], data[("en", f)]
    counts[f] = (len(es), len(en))
    if len(es) != len(en): err(f"{f}: count {len(es)} != {len(en)}"); continue
    for i, (a, b) in enumerate(zip(es, en)):
        tag = f"{f}[{i}] {a.get('slug')}"
        if set(b) != set(a) | {"translationStatus"}:
            err(f"{tag}: keys differ {sorted((set(a) | {'translationStatus'}) ^ set(b))}")
        if b.get("translationStatus") != STATUS: err(f"{tag}: translationStatus missing/wrong")
        if a.get("originalUrl") != b.get("originalUrl"): err(f"{tag}: originalUrl (id) changed")
        for k in a:
            if k not in b: continue
            if k in TRANSLATABLE[f]: shape(a[k], b[k], f"{tag}.{k}")
            elif a[k] != b[k]: err(f"{tag}.{k}: non-translatable field changed")
        if f == "tours":
            for j, (x, y) in enumerate(zip(a["itinerary"], b["itinerary"])):
                if x.get("day") != y.get("day"): err(f"{tag}.itinerary[{j}].day changed")
        # SEO limits
        if "metaTitle" in b and b["metaTitle"] and len(b["metaTitle"]) > 60:
            err(f"{tag}: metaTitle {len(b['metaTitle'])} > 60")
        if "metaDescription" in b and b["metaDescription"] and len(b["metaDescription"]) > 155:
            err(f"{tag}: metaDescription {len(b['metaDescription'])} > 155")
        # Spanish residue + leftover tokens
        for k in TRANSLATABLE[f]:
            if k in ("slug", "newPath") or k not in b: continue
            for s in texts(b[k]):
                if TOKEN.search(s): err(f"{tag}.{k}: unexpanded altitude token")
                t = s
                for w in WHITELIST: t = t.replace(w, "")
                t = re.sub(r"https?://\S+|www\.\S+", "", t)
                for m in SPANISH.finditer(t):
                    ctx = t[max(0, m.start() - 30): m.end() + 30].replace("\n", " ")
                    err(f"{tag}.{k}: Spanish word '{m.group(0)}' … {ctx} …")
    # slugs
    slugs = [x["slug"] for x in en]
    for s, c in collections.Counter(slugs).items():
        if c > 1: err(f"{f}: duplicate slug {s}")
    for s in slugs:
        if not SLUG_RE.match(s): err(f"{f}: slug not kebab-case ASCII: {s}")
        if len(s) > 60: warn(f"{f}: long slug ({len(s)}): {s}")
    for x in en:
        if not x["newPath"].startswith("/en/") or not x["newPath"].endswith("/" + x["slug"]):
            err(f"{f}: newPath/slug mismatch {x['newPath']}")

# cross references resolve inside the EN set
tour_slugs = {t["slug"] for t in data[("en", "tours")]}
dest_slugs = {d["slug"] for d in data[("en", "destinations")]}
cat_slugs = {c["slug"] for c in data[("en", "categories")]}
for t in data[("en", "tours")]:
    for s in t["destinationSlugs"]:
        if s not in dest_slugs: err(f"tour {t['slug']}: unknown destinationSlug {s}")
    for s in t["categorySlugs"]:
        if s not in cat_slugs: err(f"tour {t['slug']}: unknown categorySlug {s}")
for f in ("destinations", "categories"):
    for d in data[("en", f)]:
        for s in d["tourSlugs"]:
            if s not in tour_slugs: err(f"{f} {d['slug']}: unknown tourSlug {s}")
# cross-type collisions (relevant only if routes ever share a namespace)
allslugs = collections.Counter(x["slug"] for f in FILES for x in data[("en", f)])
for s, c in allslugs.items():
    if c > 1: warn(f"slug used in more than one collection: {s}")

print("Counts (es -> en):", {f: f"{a} -> {b}" for f, (a, b) in counts.items()})
for w in warnings: print("WARN ", w)
for e in errors: print("ERROR", e)
print("RESULT:", "OK" if not errors else f"{len(errors)} error(s)")
sys.exit(1 if errors else 0)
