# Produktionsmaterialien

`material-atlas-v1.png` wurde mit dem eingebauten Bildgenerator erzeugt; kein API-/CLI-Fallback. Die kleinere WebP-Fassung ist ein Laufzeitexport derselben Textur, kein anderer Entwurf.

Aufteilung: oben links orangefarbenes Fuchsfell, oben rechts cremefarbenes Fell, unten links Asphalt, unten rechts Kalksteinmauerwerk. Die einzelnen Bereiche werden beim Laden auf Canvas ausgeschnitten und als Materialkarten echter 3D-Geometrie verwendet.

Referenzen: `../art-reference/hero.webp` und `../art-reference/coast.webp`.

## Vollständiger Prompt: Materialatlas

Use case: stylized-concept. Asset type: production 3D game MATERIAL TEXTURE ATLAS, not a scene or mockup. Use the supplied images ONLY as reference for the orange fox fur and rich tactile material quality. Create one square high-resolution 2 by 2 texture atlas, EXACTLY four equal edge-to-edge quadrants, no gaps, frames, text, typography, objects, perspective or lighting effects. Upper left quadrant: rich russet orange fox fur with fine individual silky dense hairs flowing mainly vertically downward, darker brown hair roots, warm golden tips, subtle naturally varied orange tones, almost uniform color and scale across the entire quadrant. Upper right quadrant: dense ivory cream white fox cheek fur with fine silky individual hairs flowing vertically downward, warm cream roots, no gray patches. Lower left quadrant: finely detailed medium cool gray ASPHALT pavement with tiny mineral grain and subtle irregular wear, realistic microsurface, no road markings, no stones larger than a few pixels, fairly uniform gray. Lower right quadrant: old pale warm sandstone limestone blocks in irregular horizontal masonry courses with fine natural rock grain and worn edges, thin recessed darker grout, no moss or vegetation. All four quadrants should be flat orthographic PBR diffuse/albedo textures with uniform neutral illumination, no cast shadows, no bevelled swatch borders, no baked highlights, no 3D objects. Each quadrant should be independently tileable. Preserve reference fur color, this is intended to be wrapped on actual 3D models.

## Hochauflösende Horizontstreifen

`cape-horizon.webp` und `bay-horizon.webp` kombinieren je eine vorhandene 1774-Pixel-Ansicht mit einem weiteren 2172-Pixel-Abschnitt aus dem eingebauten Bildgenerator. Je 128 Pixel überlappen an den beiden Nähten. Der Export enthält nur das 608 Pixel hohe Band um den Horizont, in originaler horizontaler Pixeldichte. Der Shader und die Materialreflexion berücksichtigen die Winkelabdeckung. Die Höhe der auslaufenden Geländeprofile ist an den Übergängen angeglichen. WebP-Qualität 36. Der installierte WebKit-Browser konnte die versuchsweisen AVIF-Exporte nicht dekodieren.

Fjord-Prompt

A game environment texture, ultrawide landscape 3:1 aspect, 3840 x 1280 if possible. A continuous cylindrical panorama segment from one stationary eye at sea level, overlooking a broad bay. Exact waterline at 50% image height. High-frequency, crisp detailed rocky coastlines and individual ridges, deep focus, premium stylized-realism 3D animated film matte painting. Detailed terrain occupies the middle third. Clear sky above, reflective water below. No foreground objects, roads, cars, writing or signage. The edges are open water and distant low headlands for stitching. Norwegian alpine fjord in bright summer daylight, blue sky, snowy jagged granite summits with sunlit warm faces, cool blue shadow and dark green wooded islets. Opposite shore with distinct smaller peaks and a waterfall; only distant islets, naturalistic geology.

Sonnenbucht-Prompt

A game environment texture, ultrawide landscape 3:1 aspect, 3840 x 1280 if possible. A continuous cylindrical panorama segment from one stationary eye at sea level, overlooking a broad bay. Exact waterline at 50% image height. High-frequency, crisp detailed rocky coastlines and individual ridges, deep focus, premium stylized-realism 3D animated film matte painting. Detailed terrain occupies the middle third. Clear sky above, reflective water below. No foreground objects, roads, cars, writing or signage. The edges are open water and distant low headlands for stitching. Mediterranean coast at vivid orange and violet sunset, sun out of frame. Terraced ochre coastal villages, distant cypress groves, limestone cliffs and fine distant layered blue alpine peaks, sunlight gilding the masonry, apricot-pink cumulus clouds. The village has visual richness and crisp small roof shapes.

## Kap der Winde · Fjordpanorama

`cape-fjord.webp` kommt aus dem integrierten Bildgenerator. Laufzeitexport 1774 × 887 Pixel, WebP-Qualität 0,62, mit einer Überblendung am Umlauf. `material-atlas-race.webp` verwendet den vorhandenen Originalatlas in der effektiven Sample-Auflösung von 1024 × 1024, Qualität 0,49. Beide werden mit dem Spiel ausgeliefert.

**Generierungsprompt**

Use case: stylized-concept. Create a polished cinematic alpine fjord skybox texture for a mobile kart racer. A true horizontally tileable 360-degree equirectangular panorama, wide 2:1, camera on calm blue fjord water under a luminous pale arctic summer sky. Waterline precisely halfway up image. Distant sculptural alpine rock faces at varied distances, dramatic jagged peaks, broken snowfields in gullies, sunlit gold granite planes against blue shadow, green pine-covered islets. Peaks concentrated in a horizontal band from 30 to 50 percent down the image. Soft high light from the upper left. Entire top quarter open blue sky with a few wispy clouds; lower half mostly calm water reflecting the sky. Beautiful detailed premium animated-film environment painting with believable geology, atmospheric perspective and varied silhouettes all across the horizon. Water horizon and mountain contours join at left and right edges. No road, racing elements, cars, close objects, buildings, lettering, frames or UI. For a game background, crisp distant detail, not a poster.

## Vegetation im Küsten-Cup

`race-cypress.webp` und `race-spruce.webp` sind die beiden freigestellten Arten aus einem mit dem integrierten Bildgenerator erstellten Pflanzenblatt. Je Baum werden zwei gekreuzte Flächen mit Alphatest dargestellt. Fuchs, Karts, Straße und Brücken bleiben dreidimensionale Geometrie.

**Generierungsprompt**

Use case: stylized-concept. Game foliage sprite atlas on genuinely transparent background, wide 2:1 canvas with exactly two separate isolated upright full trees side by side, equal visual height, each centered in its own half. Left: a graceful slim Mediterranean Italian cypress with dense irregular dark olive needle clusters, columnar silhouette tapering to a soft tip. Right: a tall wind-shaped alpine Norway spruce with tiered asymmetric boughs, readable fine needles and gaps between branch tips, cool forest green. Painterly realistic premium animated racing-game environment art, convincing warm rimlight from upper left and soft sky fill, richly shaded foliage groups and natural dark brown trunks. Full tree from tip to trunk base, both aligned along same baseline, generous transparent padding, no cropped branch, no contact shadow, no ground, no scenery, no text, no borders, no other objects. Legible at small in-game resolution.

## Küstenpanorama

`coast-panorama-v1.png` wurde ebenfalls mit dem eingebauten Bildgenerator und den beiden Originalreferenzen erzeugt. `coast-panorama-v1.webp` ist der Laufzeitexport. Das Panorama bildet ausschließlich die entfernte Umgebung und das reflektierte Umgebungslicht; es ersetzt keine Fahrzeug-, Fahrbahn- oder nahe Szenengeometrie. Der ferne Bildhintergrund ist keine begehbare 3D-Landschaft.

`coast-panorama-v2.webp` ist ein weiterer Export desselben ursprünglichen PNGs in dessen tatsächlichen 1774 × 887 Pixeln, WebP-Qualität 0,80. Die erste WebP-Fassung hatte 1536 × 768 Pixel. Es wurde kein neues Konzeptbild erzeugt und keine Auflösung hochgerechnet. Ab `production-v5` wird v2 direkt als sichtbarer Hintergrund verwendet; eine davon abgeleitete 512 × 256 Karte liefert Materialreflexionen. Die grundsätzliche Grenze der Winkelauflösung bleibt bestehen.

### Vollständiger Prompt: Panorama

Use case: stylized-concept. Asset type: production game SKYBOX / distant environment panorama texture. Reference images: hero.webp and coast.webp specify the exact rich golden-hour coastal fantasy atmosphere, lighting, colors and densely layered distance. Create a very wide 2:1 equirectangular panorama for the distant environment of this actual 3D driving game. ONLY FARAWAY LANDSCAPE AND SKY: a luminous sunset sky with glowing orange-pink cloud edges, blue upper sky, sun near the horizon, majestic layered rugged blue coastal mountains and distant Mediterranean fantasy hilltop settlements with a small fairytale castle, bays, tiny waterfalls and the blue sea. The lower half is predominantly blue-turquoise sea and faraway rocky coastline, the top half sky and distant mountains. Preserve the cinematic family adventure animated film quality of the reference, detailed natural textures, rich warm gold and cool blue contrast, atmospheric perspective. Camera is on a coastal island about 20 meters above sea level, distant horizon at the exact vertical middle. This must be a continuous panoramic environment map, horizon level, seamless left/right edges, no black areas at poles. DO NOT depict any racing track, road, pavement, kart, driver, person, fox, panda, animal, UI, typography, signs or foreground objects. Buildings are ONLY tiny distant skyline details on mountain ridges; the game will have its own actual 3D castle and city in front of this background. There should be no large foreground land masses obscuring the sea. This is a game environment texture, not a new full-scene concept image or screenshot.
