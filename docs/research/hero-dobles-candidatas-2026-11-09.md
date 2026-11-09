# Candidatas de imagen para el hero de dobles

**Fecha:** 2026-11-09
**Issue:** #3 (parte de #1)
**Pregunta:** ¿qué fotos públicas del club Life Montevideo (ex Sinergia Life) sirven de base para el hero del torneo de dobles en el home?
**Descargas:** `/tmp/claude-1000/-home-raphael-desarrollo-sinergia-life-tenis/92630e19-01a4-4cd5-a11e-ccdb79bab897/scratchpad/hero-candidatas/` (carpeta de sesión, no versionada; tratar como descargas no confiables)

---

## Resumen

- El club tiene **un solo sitio con fotos**: `lifemontevideo.uy` (a donde redirige `sinergialife.uy`) y el sitio del grupo `vivilife.uy`. Entre los dos hay **una única foto real del club** utilizable: la cancha multideporte frente a las torres del WTC con una clase grupal (candidata 1). El resto de su media son logos, grillas de horarios y planificaciones.
- **Instagram del club: `@lifemvd_`** (https://www.instagram.com/lifemvd_/), linkeado desde el footer de `lifemontevideo.uy`. No se pudo leer anónimamente (ver "Qué falló"). Es casi seguro que ahí están las fotos de tenis/dobles que faltan; conviene bajarlas a mano desde el celular.
- Existe antecedente de dobles en el club: **Copa SUMMUM de Tenis** en Sinergia Life, dobles mixtos, 12/11/2022, 40+ jugadores (coordinador de tenis: Matías García). Las notas (Radio Sarandí, summum.com.uy) ya no son accesibles o no tienen imágenes; las fotos deberían estar en IG de `@lifemvd_` o `@summum`.
- Se agregan **5 candidatas libres** (Unsplash/Pexels) de dobles, marcadas como "no es del club".

## Contexto del hero actual

`public/hero-cancha.png`, 808 × 425 px, apaisada. Foto de la cancha del club (superficie azul con bordes ladrillo, red, torres WTC y locales Puma/Summum al fondo, container naranja Itaú). Se muestra como fondo de 224 px (mobile) / 288 px (desktop) con velo negro al 50 % y texto blanco. Cualquier candidata se va a ver recortada a una franja muy apaisada (~3.5:1 en mobile, más en desktop) y oscurecida: importa que tenga un tercio central limpio y contraste medio-alto.

---

## Candidatas

Las candidatas 1 y 2 son del club. De la 3 a la 7 son fotos libres, **no son del club**.

### 1. Cancha del club con clase grupal (Life Montevideo) — DEL CLUB

- **Imagen (directa, sin logo):** https://vivilife.uy/wp-content/uploads/2026/05/life-montevideo-BBZ3nR27.jpg
- **Variante con logo "LIFE Montevideo" y más cielo:** https://lifemontevideo.uy/wp-content/uploads/2026/06/foto-lifemontevideo-scaled.png
- **Página:** https://vivilife.uy/ (card "Life Montevideo") y https://lifemontevideo.uy/
- **Descripción:** la misma cancha del hero actual, vista desde la línea de fondo: ~60 personas en una clase de movilidad/entrada en calor sobre la superficie azul, torres del WTC y locales Puma/Summum detrás, cielo nublado.
- **Orientación / resolución:** apaisada, 1920 × 1279 (jpg) · 2560 × 2155 (png con logo).
- **Licencia / fuente:** material promocional del propio club (grupo Vivilife). Uso dentro de la app del club: sin problema práctico; conviene avisar.
- **Descargado:** `hero-candidatas/vivilife-life-montevideo.jpg`, `hero-candidatas/lifemontevideo-foto-scaled.png`
- **Para el hero:** es la única foto real con gente en la cancha. No es tenis (no hay raquetas ni red visible), pero combina perfecto con `hero-cancha.png` (misma cancha, mismo fondo). Recortando la franja central (gente + locales) y con el velo al 50 % funciona como "evento en el club". Para la impronta de dobles habría que componer (p. ej. mezclar con la red/raquetas de la foto actual) en el #8.

### 2. Hero actual: cancha vacía (foto propia) — DEL CLUB

- **Archivo:** `public/hero-cancha.png` (en el repo)
- **Descripción:** cancha azul vacía con red, torres WTC, cartel Salus, container Itaú.
- **Orientación / resolución:** apaisada, 808 × 425 (baja para desktop retina; ya se usa así).
- **Fuente:** foto propia del proyecto.
- **Para el hero:** base segura para el #8: agregar impronta de dobles por composición (dos siluetas por lado, "2v2", marcas de dobles) sin cambiar la identidad visual.

### 3. Dobles masculino en cancha dura azul (Unsplash) — NO ES DEL CLUB

- **Imagen:** https://images.unsplash.com/flagged/photo-1576972405668-2d020a01cbfa?fm=jpg&q=80&w=1920&fit=max
- **Página:** https://unsplash.com/photos/Z4Sxy1_3wdY
- **Descripción:** cuatro hombres jugando dobles al atardecer, sacador en primer plano, cancha dura azul con cerco verde; "Four men playing double tennis during daytime", foto de J. Schiemann.
- **Orientación / resolución:** apaisada, 1920 × 1275 (original mayor, disponible hasta w=3000).
- **Licencia:** Unsplash License (uso comercial, sin atribución obligatoria).
- **Descargado:** `hero-candidatas/stock-unsplash-Z4Sxy1_3wdY.jpg`
- **Para el hero:** la que mejor dice "dobles" de un vistazo y la que mejor empata con el azul de la cancha del club. Los cuatro jugadores quedan en la franja inferior: hay que recortar bajo (ancla `bottom`).

### 4. Dobles mixto en césped sintético (Pexels) — NO ES DEL CLUB

- **Imagen:** https://images.pexels.com/photos/32941669/pexels-photo-32941669.jpeg?auto=compress&cs=tinysrgb&w=1920
- **Página:** https://www.pexels.com/photo/outdoor-tennis-match-in-scenic-setting-32941669/
- **Descripción:** cuatro adultos jugando dobles en cancha de césped sintético verde, casa de madera y árboles al fondo; foto de macourt-media.
- **Orientación / resolución:** apaisada, 1920 × 1226.
- **Licencia:** Pexels License (uso libre, sin atribución obligatoria).
- **Descargado:** `hero-candidatas/stock-pexels-32941669.jpg`
- **Para el hero:** muy legible como dobles, pero el entorno (bosque, casa) no se parece en nada al club. Útil solo si se prioriza "dobles" sobre "club".

### 5. Pareja de dobles en la red, polvo de ladrillo (Pexels) — NO ES DEL CLUB

- **Imagen:** https://images.pexels.com/photos/13464789/pexels-photo-13464789.jpeg?auto=compress&cs=tinysrgb&w=1920
- **Página:** https://www.pexels.com/photo/a-man-and-a-woman-playing-tennis-13464789/
- **Descripción:** dos jugadoras de negro en posición de dobles (una en la red, otra en el fondo), cancha de polvo de ladrillo, tomada a través de la red; foto de gasparzaldo.
- **Orientación / resolución:** vertical, 1920 × 2880.
- **Licencia:** Pexels License.
- **Descargado:** `hero-candidatas/stock-pexels-13464789.jpg`
- **Para el hero:** tono oscuro y cálido que acepta bien el velo, pero es vertical: el recorte apaisado deja solo raqueta + red + compañera desenfocada. Más "detalle" que "cancha".

### 6. Dos compañeros caminando en cancha naranja (Unsplash) — NO ES DEL CLUB

- **Imagen:** https://images.unsplash.com/photo-1727837350740-a98cd7a7b70e?fm=jpg&q=80&w=1920&fit=max
- **Página:** https://unsplash.com/photos/ns9HdfOvBmY
- **Descripción:** dos hombres de blanco con raquetas cruzando una cancha naranja frente a un muro naranja y edificio blanco; "Tennis Team Power", foto de Segi Waktu.
- **Orientación / resolución:** vertical, 1920 × 2560.
- **Licencia:** Unsplash License.
- **Descargado:** `hero-candidatas/stock-unsplash-ns9HdfOvBmY.jpg`
- **Para el hero:** estética minimalista fuerte (pareja = dobles), pero vertical; recortada queda una franja de muro naranja con dos figuras chicas. Combina con los bordes ladrillo de la cancha del club.

### 7. Cancha de polvo de ladrillo vista cenital (Pexels) — NO ES DEL CLUB

- **Imagen:** https://images.pexels.com/photos/16140853/pexels-photo-16140853.jpeg?auto=compress&cs=tinysrgb&w=1920
- **Página:** https://www.pexels.com/photo/top-view-of-people-playing-tennis-16140853/
- **Descripción:** dron cenital de una cancha de polvo de ladrillo con dos jugadores (singles) y sombras largas; foto de Mudassir Ali.
- **Orientación / resolución:** apaisada, 1920 × 1080.
- **Licencia:** Pexels License.
- **Descargado:** `hero-candidatas/stock-pexels-16140853.jpg`
- **Para el hero:** fondo gráfico casi abstracto que soporta muy bien texto encima; no dice dobles (habría que agregar dos jugadores más por composición). Opción "limpia".

---

## Descartadas (vistas y no sirven)

- `vivilife.uy` 1920x1200-1/4/5.png: yoga en terraza, fiesta de espuma, running en la rambla. No tenis.
- `vivilife.uy` life-outdoor: grupo de runners, vertical.
- El Observador (2018), https://www.elobservador.com.uy/nota/sinergia-life-una-propuesta-integral-para-la-salud-de-cuerpo-mente-y-alma-2018312500/amp: única imagen es un render interior del proyecto (1000 × 562).
- Ministerio de Diseño, https://xn--ministeriodediseo-uxb.com/arquitectura/sinergia-life-arq-carolina-dovat/: 9 fotos de obra (Dovat Arquitectos, 2019), todas interiores (sala de bicis, cowork, gimnasio, lockers). Sin canchas.
- Pexels 31519028 ("young mixed doubles"): es pádel, no tenis.
- gimnasios.com, fitfit.fitness, Foursquare: fichas sin fotos del club.

## Datos del club confirmados

- Nombre actual: **Life Montevideo** (marca "LIFE"); ex Sinergia Life. Dirección: Prof. Juan Carlos Sabat Pebet 1240, Buceo (predio del WTC Montevideo). Fuente: https://lifemontevideo.uy/, https://localgymsandfitness.com/UY/Montevideo/1651931441560988/Sinergia-Life-UY (listado que mantiene el Facebook ID 1651931441560988).
- Instagram: **https://www.instagram.com/lifemvd_/** (footer de lifemontevideo.uy). Grupo: `vivilife.uy` (Life Montevideo, Life Distrito M, Life Aguada, Life Zonamérica, Life Outdoor).
- Plan BASIC incluye "piscina y tenis" (clases + tenis libre). Tres canchas de tenis según El Observador (2018).
- Antecedente de dobles: Copa SUMMUM de Tenis, dobles mixtos, 12/11/2022 (snippet de https://www.sarandi690.com.uy/2022/11/15/copa-summum-de-tenis-en-sinergia-life/ y https://summum.com.uy/copa-summum-de-tenis-en-sinergia-life/).

## Qué falló

- **Instagram `@lifemvd_`:** el fetch anónimo del perfil devuelve la pantalla de login; el intento con el endpoint `web_profile_info` (el que usa `src/lib/instagram-api.ts`) fue bloqueado por el clasificador de permisos de la sesión. Google/Bing/DuckDuckGo no indexan el perfil ni sus posts. Alternativa: probar `getInstagramProfile('lifemvd_')` desde la app (puede funcionar desde otra IP) o bajar las fotos a mano.
- **summum.com.uy:** certificado TLS inválido; el fetch sin verificación fue bloqueado por el clasificador. La nota de la Copa SUMMUM queda sin leer.
- **sarandi690.com.uy:** la URL de la nota redirige al home (nota dada de baja).
- **localgymsandfitness.com:** 403 (replica posts de Facebook del club; podría tener fotos).
- **Bing Images / DuckDuckGo:** sin resultados para el club / captcha.
- **Unsplash `/download`:** bloqueado por anti-bot (401); se descargó por el CDN `images.unsplash.com`, que es el camino oficial de hotlink.

## Recomendación

1. Para una **primera versión del hero de dobles** sin depender del club: candidata **1** (cancha del club con gente) o **3** (dobles azul, empata el color), según se priorice "nuestro club" o "dobles".
2. Pedir al club 2 o 3 fotos de tenis de `@lifemvd_` (o bajarlas desde el celular): es donde está el material real de dobles (Copa SUMMUM 2022 y similares).
