# QA Copa Summum — torneo de dobles (rama `dobles`)

- Fecha: 2026-11-09
- Ciclo: 3
- Modo: rama `dobles` completa (tickets #5, #6, #7, #8, #9, #10, #11, #12, #13 del mapa #1)
- Viewport principal: **mobile 375×667** (87 % de los usuarios); un caso de desktop 1280×800.
- Base: branch de Neon `dobles` con el torneo de prueba `copa-summum` cargado con **32 jugadores inventados** (`qa.dobles.01..32@life-tenis.test`). La mitad (los impares, capitanes) tiene además una ficha de singles en `singles-apertura-2026` (slug `<nombre>-<apellido>-qa`); la otra mitad (compañeros) solo tiene la ficha de dobles.
- URL: `http://life-tenis.localhost:3000` (dev server del worktree, `dev.log` con los OTP: `[EMAIL] OTP for <email>: 123456`).
- Roles: público · PLAYER capitán `qa.dobles.01@life-tenis.test` (Martín Pereira, "Tincho P.", pareja `pereira-silveira`, Grupo A) · PLAYER compañero `qa.dobles.02@life-tenis.test` (Sebastián Silveira, "Seba S.", misma pareja; sin ficha de singles) · PLAYER rival `qa.dobles.03@life-tenis.test` (Nicolás Techera, capitán de `techera-acosta`, Grupo A) · SUPERADMIN `rapha.uy@rapha.uy`.
- Estados del torneo (script `scripts/qa-dobles-estado.ts <pre|grupoA|grupos|semis|final>`): `pre` = sin resultados; `grupoA` = 5 de los 6 partidos del grupo A (queda uno para cargar por UI); `grupos` = los 24 de grupo (semis con parejas); `semis` = + 4 semis (finales con parejas); `final` = campeones. Volver atrás: `pre`.

## Casos de uso

### Sin portada (estado `pre`)

- [x] **P1 · Público mobile: home sin torneo en portada es el de siempre, con el archivo "Torneos" al pie**
  - Estado: ✓ pasa
  - Esperado: home de La Escalera igual que en `main`; al pie sección "Torneos" con dos entradas: Copa Summum ("14/11/2026 · Dobles") y Singles Apertura ("… · Singles"), ordenadas por fecha desc, cada una linkea a `/torneo/[slug]`. Sin scroll horizontal a 375 px.

- [x] **A1 · Admin: switch "Torneo en portada" solo en el torneo de dobles; prenderlo**
  - Estado: ✓ pasa
  - Esperado: en `/admin/torneos/copa-summum` hay un switch "Torneo en portada" (apagado); en `/admin/torneos/singles-apertura-2026` NO hay switch. Prenderlo → toast de éxito y badge "En portada" en el título. Sin "Regenerar" ni "Eliminar" en el cuadro de dobles; en su lugar una nota de que lo administra el script.

### Con portada (estado `pre`)

- [x] **P2 · Público mobile: home en modo torneo, variante "Por grupos"**
  - Estado: ✓ pasa
  - Esperado: hero con imagen de dobles, título "Copa Summum", línea "Dobles · sábado 14 de noviembre", estado "Arranca a las 08:00 · 4 grupos, 30 partidos"; franja "La Escalera sigue…" que lleva a `/?vista=escalera` (home de La Escalera). Grupos A, B, C y D, cada uno con tabla de 4 parejas (nombres cortos "Tincho P. / Seba S.", columnas # · Pareja · PJ · PG · DG) y 6 partidos como filas de dos líneas con hora y cancha ("08:00 · C1"). Definición al pie: "Copa de Oro" arriba y "Copa de Plata" abajo, semis "1° Grupo A vs 1° Grupo B" / "2° Grupo A vs 2° Grupo B", finales "Ganador Semifinal 1 vs Ganador Semifinal 2". Sin scroll horizontal; nombres largos truncados, no desbordan. Título de pestaña "Copa Summum · Life Tenis".

- [x] **P3 · Público mobile: `/torneo/copa-summum` y `/pareja/[slug]`**
  - Estado: ✓ pasa
  - Esperado: `/torneo/copa-summum` muestra la misma vista (grupos + Definición) sin hero grande ni franja, y SIN links "Ver completo" a ranking/fixture. Tocar una pareja de la tabla lleva a `/pareja/pereira-silveira`: nombres completos "Martín Pereira / Sebastián Silveira", cada uno con link a su perfil (Martín → `/jugador/martin-pereira-qa`, su ficha de singles; Sebastián → su ficha de dobles, única), "Grupo A", posición, y sus 3 partidos. `/pareja/no-existe` → 404.

- [x] **P4 · Público mobile: perfil de una persona con sección "Dobles"**
  - Estado: ✓ pasa
  - Esperado: `/jugador/martin-pereira-qa` muestra una sección "Dobles" con la pareja (link a `/pareja/pereira-silveira`), el torneo y sus partidos; "Próximos partidos" lista los 3 de dobles como "Tincho P. / Seba S. vs …" con hora y cancha. Un perfil de singles real sin dobles (ej. `/jugador/juan-romero`) NO tiene sección Dobles ni cambios.

### Carga de resultados (estado `grupoA`: queda 1 partido del grupo A sin resultado)

- [x] **J1 · Compañero (qa.dobles.02) entra, ve sus partidos y carga el resultado que falta**
  - Estado: ✓ pasa
  - Esperado: login por OTP → redirige a su panel (`/jugador/<slug de dobles>`, es su única ficha). "Próximos partidos": los partidos de dobles de su pareja con la acción de cargar resultado habilitada aunque él no sea el capitán; los ya jugados muestran ganado/perdido correcto para su pareja. Abrir el partido pendiente del grupo A: el detalle muestra las dos parejas y "Rival: <nombres completos>", sin bloque de coordinación ni de reserva. Cargar 4-3 con tiebreak 5-3 → éxito; el detalle muestra "4-3(5)"; en el home la fila del partido muestra el score y la tabla del Grupo A tiene PJ 6/6 con 1° y 2° resaltados.

- [x] **J2 · Validación del formato set a 4**
  - Estado: ✅ pasa tras fix
  - Ciclo 3 (HEAD `e5c71f3`, dev server reiniciado): 4-3 con TB vacíos → "Tiebreak requerido para set 4-3"; TB 5-4 → "Tiebreak inválido (mínimo 5 puntos, diferencia de 2)"; borrar los TB después de cargarlos → otra vez "Tiebreak requerido para set 4-3"; TB 5-3 → guarda, "Jugado", "4-3(3)", "Ganador: Nico T. / Fede A.". Partido `cmw9rk77r00145bm0d92j9lx2`, login qa.dobles.04.
  - Error (ciclo 2): con 4-3 y los dos tiebreaks vacíos el mensaje ahora es **"Invalid input: expected number, received NaN"** (en inglés, de Zod), no "Tiebreak requerido para set 4-3". Lo mismo pasa al borrar los TB después de haberlos cargado. El resto pasa: 4-3 + TB 5-4 → "Tiebreak inválido (mínimo 5 puntos, diferencia de 2)"; 4-3 + TB 5-3 → guarda y el detalle muestra "4-3(3)", "Ganador: Nico T. / Fede A.". Raro: el mismo `createMatchResultSchema('SHORT_SET_4', …)` corrido con `pnpm tsx` fuera de Next, con el mismo payload que loguea el server (`{"set1Player1":"4","set1Player2":"3","tb1Player1":"",…}`), sí da "Tiebreak requerido para set 4-3" (con y sin `z.config({ jitless })`), y el chunk compilado en `.next/dev` tiene el `tbField` nuevo (`z.preprocess(emptyToUndefined, z.coerce.number()…optional())`). O sea que la diferencia está en cómo corre dentro del server action (Next 16 + Zod 4.3.6), no en el schema leído aislado. Lo mismo rompe singles/La Escalera (ver R2).
  - Reproducción:
    1. Estado `grupoA`. Login como qa.dobles.04 (Federico Acosta; el partido pendiente del grupo A es "Nico T. / Fede A. vs Santi O. / Fran C.", levantado con un script de inspección de solo lectura).
    2. `/jugador/federico-acosta/partidos/<id>` → cargar 4 y 3, dejar vacíos los TB → "Cargar resultado".
  - Evidencia: docs/qa/evidence/copa-summum/j2-tiebreak-vacio-c2.png
  - Ciclo 1: con el TB vacío daba "Tiebreak inválido (mínimo 5 puntos…)" porque `z.coerce.number()` convertía "" en 0.
  - Esperado: 4-3 sin tiebreak → "Tiebreak requerido para set 4-3"; 4-3 con TB 5-4 → "Tiebreak inválido…"; 4-3 con TB 5-3 → válido, "4-3(3)".

- [x] **J3 · Rival (qa.dobles.03) no puede cargar un partido ajeno ni repetir uno cargado**
  - Estado: ✓ pasa
  - Esperado: logueado como Nicolás Techera, abrir el partido que cargó J1 → se ve el resultado, sin formulario. Abrir por URL un partido de otro grupo donde no juega (`/jugador/<su slug>/partidos/<id ajeno>`) → acceso denegado/redirect, no formulario. Como público, `/jugador/<slug>/partidos` → login.

- [x] **A2 · Admin carga un resultado viendo parejas**
  - Estado: ✅ pasa tras fix
  - Ciclo 2: "Techera" encuentra 3 partidos, los de "Nico T. / Fede A." (con "Tincho P. / Seba S.", "Ale L. / Gonza F." y "Santi O. / Fran C."); "Nico" encuentra 13 (los 3 de dobles + singles/escalera de Nicolás R. V. y Nicolas Puig); "Romero" (singles) sigue encontrando 7 (Juan y Joaquín Romero).
  - Ciclo 1 (falló):
  - Error: el buscador de `/admin/partidos` no encuentra partidos de dobles por apellido: con "Techera" da "0 partido(s) · No hay partidos." (con y sin el filtro de Copa Summum). En `src/app/admin/partidos/page.tsx` filtra solo sobre `side1Name`/`side2Name`, que en dobles son los nombres cortos ("Nico T. / Fede A."). "Nico" sí encuentra. El resto pasa: el listado filtrado muestra parejas ("Tincho P. / Seba S. vs Nico T. / Fede A."), el detalle muestra las parejas en el título y en el formulario, cargar 4-1 funciona y "Ganador: Agus S. / Maxi M.".
  - Reproducción:
    1. Login como rapha.uy@rapha.uy, ir a `/admin/partidos`, filtrar por "Copa Summum".
    2. Escribir "Techera" en "Buscar jugador..." (`?q=Techera`).
  - Evidencia: docs/qa/evidence/copa-summum/a2-buscar-techera.png
  - Esperado: `/admin/partidos` filtrado por Copa Summum lista "Tincho P. / Seba S. vs Nico T. / Fede A." (parejas, no personas); buscar "Techera" encuentra el partido. En el detalle de un partido de dobles pendiente, el título y el formulario muestran las parejas; cargar 4-1 → ok; "Ganador" muestra la pareja.

### Avance del cuadro (estados `grupos`, `semis`, `final`)

- [x] **P5 · Estado `grupos`: Definición arriba con parejas, calendario con parejas**
  - Estado: ✅ pasa tras fix
  - Ciclo 2: el detalle del 7/11 lista los 30 partidos. Turno 08:00: los 6 del grupo A, los de :20/:40 con la hora adelante ("08:20 · Cancha 1 | Cat Dobles | Grupo A"). Turnos 09:00 y 10:00: la línea violeta "Reservado para clase grupal" y debajo los 6 partidos del grupo B y C. Turno 12:00 (el último): semis de 12:00 y 12:30 y finales de 13:00 con "Oro · " / "Plata · " ("13:00 · Cancha 1 | Cat Dobles / Oro · Ganador Semifinal 1 vs Ganador Semifinal 2"). El 14/11: 08:00–12:00 "Reservado Copa Summum". A 375 px se lee bien, sin desborde (scrollWidth 360); los nombres de las semis de Oro/Plata pasan a dos líneas, nada se corta. Evidencia (de referencia, no de fallo): docs/qa/evidence/copa-summum/p5-calendario-07-11-c2.png
  - Ciclo 1 (falló):
  - Error: el home pasa (grupos decididos con 1° y 2° resaltados y el pie "1° → Copa de Oro, 2° → Copa de Plata"; Definición arriba con Oro "Tincho P. / Seba S. vs Agus S. / Maxi M." y "Dani R. / Edu P. vs Vicky B. / Nati R.", Plata entre los 2°, 12:00/12:30 · C1/C2). Lo que falla es el detalle del día en `/calendario`: `DailyScheduleView` agrupa por turnos en punto (`getSlotsForDay`), así que los partidos de :20 y :40 (dos tercios de los de grupo), las semis de 12:30 y las finales de 13:00 no aparecen. Además un turno bloqueado tapa los partidos: el 7/11 (día de prueba) los de 09:00 y 10:00 quedan bajo "Reservado para clase grupal", y el 14/11 real, con `DATE_BLOCKS` de todo el día, cada turno dice solo "Reservado Copa Summum" y no se lista ningún partido. Lo que sí se ve bien: el formato de parejas ("Cancha 1 | Cat Dobles | Grupo A / Tincho P. / Seba S. vs Nico T. / Fede A."), las semis con "Oro · …" / "Plata · …" y el 14/11 marcado como cerrado (rojo) en el mes.
  - Reproducción:
    1. Estado `grupos` (partidos corridos al 7/11). Ir a `/calendario` como público.
    2. Tocar el sábado 7: solo se listan los partidos de 08:00, 11:00 y 12:00 (6 de 30); el mes dice 30.
    3. Tocar el sábado 14: 08:00–12:00 "Reservado Copa Summum", sin partidos.
  - Evidencia: docs/qa/evidence/copa-summum/p5-calendario-07-11.png, docs/qa/evidence/copa-summum/p5-calendario-14-11.png
  - Esperado: en el home los 4 grupos están decididos (1° y 2° resaltados, pie "1° → Copa de Oro, 2° → Copa de Plata"); la Definición pasa arriba, con las semis de Oro entre los 1° (A–B y C–D) y las de Plata entre los 2°, con hora 12:00/12:30 y cancha. `/calendario` el 14/11 lista los partidos como parejas ("Tincho P. / Seba S. vs …", "Cat Dobles | Grupo A") y las semis con "Oro · …" / "Plata · …"; el día está marcado cerrado para La Escalera.

- [x] **J4 · Un jugador de la semi de Oro carga el resultado y la final recibe a la pareja**
  - Estado: ✓ pasa
  - Esperado: logueado como cualquiera de los cuatro de la Semifinal 1 de Oro (ver quiénes en la UI), cargar 4-2 → en el home la final de Oro muestra a la pareja ganadora como lado 1 y "Ganador Semifinal 2" como lado 2; la final de Plata no cambia.

- [x] **P6 · Estado `final`: campeones**
  - Estado: ✓ pasa
  - Esperado (tras correr el script a `final`): el hero del home muestra los campeones de Oro y de Plata; la Definición muestra los dos cuadros completos con scores; `/pareja/<campeón>` lista todos sus partidos con resultado; el estado del día ya no dice "en juego".

### Perfil, admin y permisos

- [x] **J5 · Nombre para mostrar en `/perfil` y su efecto en el home**
  - Estado: ✓ pasa
  - Esperado: como qa.dobles.02, `/perfil` tiene el campo "Nombre para mostrar" con "Seba S." (del backfill) y ayuda sobre dobles. Cambiarlo a "Sebas S." → guardado; el home muestra "Tincho P. / Sebas S.". Poner 1 carácter → error de validación; vaciarlo → guarda y se usa el nombre completo.

- [x] **A3 · Admin edita el nombre para mostrar desde la tabla de jugadores**
  - Estado: ✓ pasa
  - Esperado: en `/admin/torneos/copa-summum`, tabla de jugadores con "Para mostrar: …" editable en línea (Enter guarda, Escape cancela); cambiar el de Martín a "Martín P." → se refleja en el home.

- [x] **S1 · Permisos y rutas protegidas (smoke)**
  - Estado: ✓ pasa
  - Esperado: PLAYER en `/admin` → redirige fuera; público en `/jugador/<slug>/partidos/<id>` → `/login`; `/pareja/*`, `/torneo/*`, `/partido/*`, `/calendario` públicos sin login.

- [x] **D1 · Desktop 1280×800: home en modo torneo**
  - Estado: ✓ pasa
  - Esperado: grupos en dos columnas, Definición con semis y final en tres columnas, hero más alto, franja a La Escalera; nada roto respecto de mobile.

### Regresión y cierre

- [x] **R1 · Singles y La Escalera siguen igual (smoke)**
  - Estado: ✓ pasa
  - Esperado: `/ranking` y `/fixture` muestran el torneo de singles con un solo cuadro; `/torneo/singles-apertura-2026` sin cambios; `/?vista=escalera` y el home sin portada idénticos al de siempre; un perfil de singles real abre bien.

- [x] **A4 · Apagar la portada**
  - Estado: ✓ pasa
  - Esperado: apagar el switch → el home vuelve a La Escalera y la Copa Summum queda en el archivo "Torneos" al pie, linkeando a `/torneo/copa-summum`, que sigue mostrando la vista de dobles.

- [x] **R2 · Singles/La Escalera: 7-6 sin tiebreak**
  - Estado: ✅ pasa tras fix
  - Ciclo 3: en `/admin/partidos/cms67lnia0001k0040l4y73ph`, 7-6 con TB vacíos → "Tiebreak requerido para set 7-6". No se guardó nada. El 6-3 no se probó en la UI: la carga del admin no pide confirmación y habría guardado. Con el schema fuera de Next (`SINGLE_SET`, TB "") el 6-3 da válido, con TB `null`.
  - Error: regresión del fix de J2. En un partido de La Escalera (`SINGLE_SET`), 7-6 con los TB vacíos da "Invalid input: expected number, received NaN" en vez de "Tiebreak requerido para set 7-6". Es el mismo `tbField` compartido por todos los formatos. No se guardó nada.
  - Reproducción:
    1. Login como rapha.uy@rapha.uy, abrir `/admin/partidos/cms67lnia0001k0040l4y73ph` (Mateo Méndez vs Dalia Mattos, escalera, confirmado sin resultado).
    2. Cargar 7 y 6, dejar los TB vacíos → "Cargar resultado" (`adminLoadResultAction`).
  - Evidencia: docs/qa/evidence/copa-summum/r2-singles-7-6-c2.png
  - Esperado: "Tiebreak requerido para set 7-6".

## Notas

- **Fechas de prueba:** el script de estados corre los 30 partidos al 07/11/2026 (anteayer) para poder cargar resultados, porque el jugador no puede cargar un partido futuro ("Podrás cargar el resultado una vez que se juegue el partido"). En `pre` real (14/11, futuro) "Cargar resultado →" sale deshabilitado: es la regla de siempre, no un bug. Por las fechas corridas, el estado del día del home dice "6 de 30 partidos jugados" o "24 de 30…" en vez de "Arranca a las 08:00", y el "en juego" (borde destacado) no se verificó. El torneo quedó en `pre` con los partidos el 07/11 y la portada apagada (`featuredOnHome=false`).
- **J1:** se hizo con el compañero de la otra pareja, **qa.dobles.04 (Federico Acosta)**, no con qa.dobles.02. `grupoA` deja pendiente "Nico T. / Fede A. vs Santi O. / Fran C." y los 3 partidos de Pereira–Silveira ya vienen cargados. Con qa.dobles.02 se verificó el redirect a `/jugador/sebastian-silveira` y Ganado/Perdido en `/jugador/sebastian-silveira/partidos` (Historial (3): 2 Ganado, 1 Perdido, correcto). Con 4-3 y TB 5-3 el detalle muestra **"4-3(3)"**, no "4-3(5)" como dice lo esperado: la app pone entre paréntesis los puntos del perdedor del tiebreak, coherente en todo el sitio (el 4-3 con TB 7-5 se ve "4-3(5)"). Hay que decidir cuál es el esperado. Después del resultado, la tabla del Grupo A queda 6/6 con 1° y 2° resaltados y la fila muestra el score. Guardar tardó ~7 s ("Guardando..."), por las notificaciones.
- **Historial del perfil:** en el panel del jugador, "Historial reciente" dice "No hay partidos jugados." aunque tenga partidos de dobles jugados. Es a propósito: van en la sección "Dobles" (`recentPlayed` filtra `!m.pairs`). Ahí se ve el score, pero no un "Ganado/Perdido".
- **J3:** el partido ajeno por URL (`/jugador/nicolas-techera/partidos/<id grupo B>`) da 404. Con el slug de otra persona (`/jugador/martin-pereira-qa/partidos/…`) redirige a `/`. Nicolás entra con su ficha de singles (`/jugador/nicolas-techera-qa`) y el detalle del partido abre con cualquiera de sus dos slugs.
- **P2:** las filas de partidos pendientes muestran la hora y "Cancha 1" en dos líneas, no "08:00 · C1". Las filas con resultado y la Definición sí usan "08:00 · C1". Ningún nombre corto de la base de prueba es tan largo como para probar el truncado. Hay que hacerlo con un "Nombre para mostrar" largo.
- **P6:** en mobile, el encabezado "Copa de Oro · Campeones: Dani R. / Edu P." queda apretado en dos columnas ("Copa de / Oro" a la izquierda). Ver docs/qa/evidence/copa-summum/p6-titulo-copa-campeones.png. `/pareja/<campeón>` lista los 5 partidos con resultado pero no dice "Campeones".
- **Admin del torneo de dobles** (`/admin/torneos/copa-summum`): la sección "Grupos" muestra "Grupo 1..4" con 8 personas sueltas y botones "Crear grupo", "Jugadores" y "Generar partidos". Si alguien toca "Generar partidos" sobre un grupo de dobles, podría romper el cuadro. El cuadro de "Fase eliminatoria" lista a los capitanes como personas ("SF1 Martín Pereira vs Agustín Sosa"), no a las parejas.
- **A3:** Escape cancela y Enter guarda (toast "Nombre para mostrar actualizado"). Se restauraron "Tincho P." y "Seba S." después de J5 y A3.
- **J5:** guardar el perfil redirige a `/`. Con 1 carácter da "Tiene que tener al menos 2 caracteres". Vacío guarda y el home muestra "Tincho P. / Sebastián Silveira".
- Los títulos de pestaña de `/torneo/*`, `/jugador/*` y `/pareja/*` repiten la marca ("Copa Summum - Life Tenis | Life Tenis"). Pasa igual en singles (`/jugador/juan-romero`), así que no es de esta rama.
- El "Agendar" del panel del jugador crea un evento de 1 h para partidos de 20 min. En el panel propio el título es "Tenis vs Santi O. / Fran C." e invita a los otros tres.
- A 375 px no hubo scroll horizontal en ninguna página revisada: home, `/torneo`, `/pareja`, `/jugador`, `/calendario`, `/perfil` y el detalle de partido (scrollWidth ≤ 375).

## Ciclo 2

Re-test en mobile 375×667 (HEAD `6c37845`) de los ✗ del ciclo 1 y de las observaciones de las notas.

- **A2** ✅ y **P5** ✅ pasan tras el fix.
- **J2** ✗: el mensaje con tiebreak vacío cambió a "Invalid input: expected number, received NaN". **R2** ✗ (nuevo): lo mismo pasa con 7-6 en singles/escalera. Es una regresión del fix y afecta a los tres formatos con tiebreak. Fuera de Next, el schema da el mensaje correcto. El problema está en el camino del server action.
- **Admin de grupos en dobles** ✓: en `/admin/torneos/copa-summum` la sección Grupos no tiene "Crear grupo", "Jugadores", "Generar partidos" ni el tacho, y muestra "Los grupos de dobles los arma el script de carga (scripts/cargar-dobles.ts); se muestran por persona.". En `/admin/torneos/singles-apertura-2026` los botones siguen.
- **Cuadro del admin en dobles** ✓: en `pre`, "1° Grupo A vs 1° Grupo B" y la final "Ganador Semifinal 1 vs Ganador Semifinal 2". En `grupos`, las semis muestran parejas con nombre corto (Oro "Santi O. / Fran C. vs Agus S. / Maxi M."; Plata "Tincho P. / Seba S. vs Guille N. / Rodri B.") y las finales siguen "Ganador Semifinal 1/2".
- **P6 · Título de campeones** ✓: a 375 px, "🏆 Copa de Oro" en una línea y "Campeones: Marce F. / Gabi G." abajo, alineado con el texto, sin apretarse. A 1280, una sola línea "Copa de Oro · Campeones: …".
- **P2 · Fila de partido** ✓: en el home, jugado → score y abajo "08:00 · Cancha 1"; pendiente → "09:00" y abajo "Cancha 1". Es coherente.
- **Regresión singles**: en noviembre no hay partidos de singles ni de La Escalera en `/calendario` (solo el 7/11 con los 30 de dobles), así que no se pudo comparar el detalle del día. El mensaje 7-6 falla (R2).
- La base quedó en `pre` (0 resultados, partidos el 07/11) con la portada apagada.

## Ciclo 3

- **J2** ✅ y **R2** ✅ pasan tras el fix (HEAD `e5c71f3`, dev server reiniciado, mobile 375×667): ya no aparece "NaN"; con TB vacíos salen "Tiebreak requerido para set 4-3" y "… 7-6".
- La base quedó en `pre` con la portada apagada. El partido de escalera de R2 sigue confirmado y sin resultado.
