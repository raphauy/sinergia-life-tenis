# QA Copa Summum — segunda pasada (rama `dobles`)

- Fecha: 2026-11-10
- Ciclo: 2 (ver "Ciclo 2" al final; lo de abajo es el ciclo 1)
- Modo: lista de casos explícita (lo agregado después de `docs/qa/copa-summum-dobles.md`), HEAD `12c4b99`
- Viewport: mobile 375×667 en todo, admin incluido
- Roles testeados: público · SUPERADMIN `rapha.uy@rapha.uy` · PLAYER compañero `qa.dobles.02` (Sebastián Silveira) · PLAYER compañero `qa.dobles.04` (Federico Acosta) · PLAYER capitanes `qa.dobles.01` y `qa.dobles.03` (dos sesiones de browser separadas)
- Escenas: `qa-dobles-escena.ts triple | semi-jugada | hoy-tarde | manana | anteayer` sobre `qa-dobles-estado.ts pre`

## Casos de uso

- [ ] **1 · Triple empate, vista pública**
  - Estado: ✗ falla
  - Error: el home pasa, pero `/pareja/<slug>` de las tres empatadas muestra una posición firme ("1° en el grupo", "2° en el grupo", "3° en el grupo") mientras el empate sigue sin resolver. Contradice al home, que las marca con "=".
  - Pasa en el home: Grupo B con "=" en Agus S. / Maxi M., Guille N. / Rodri B. y Facu R. / Nacho V. (3 PJ, 2 PG, +3 las tres) y el texto "Empate entre 3 parejas (=): el orden lo define la organización."; semi 1 de oro "Tincho P. / Seba S. vs 1° Grupo B"; semi 1 de plata "Nico T. / Fede A. vs 2° Grupo B". Sin scroll horizontal (scrollWidth 360).
  - Reproducción:
    1. `pnpm tsx scripts/qa-dobles-escena.ts triple`, portada prendida.
    2. Abrir `/pareja/sosa-machado`, `/pareja/nunez-barboza`, `/pareja/rocha-viera`: "Grupo B · 1° en el grupo · 3 PJ, 2 PG, DG +3", "… 2° …", "… 3° …".
  - Evidencia: docs/qa/evidence/copa-summum-2/c1-pareja-empatada-3ro.png

- [ ] **2 · Triple empate, el admin lo resuelve**
  - Estado: ✗ falla
  - Error: guardar funciona, pero el recuadro amarillo desaparece apenas se guarda, así que no refleja el orden elegido y no hay forma de cambiarlo de nuevo desde la UI (`page.tsx` solo arma el recuadro con `hasUnresolvedTie`). Un admin que se equivoca de orden no lo puede corregir.
  - Pasa: recuadro "Grupo B: empate entre 3 parejas" con 1°/2°/3° y flechas; toast "Orden del Grupo B definido"; en el home el Grupo B queda 1, 2, 3 sin "=" y sin el aviso; el 1° entra a la semi 1 de oro y el 2° a la de plata. Probado con dos órdenes (reseteando la escena entre uno y otro): Facu/Agus/Guille → oro "Tincho P. / Seba S. vs Facu R. / Nacho V.", plata "Nico T. / Fede A. vs Agus S. / Maxi M."; Guille/Agus/Facu → oro con Guille N. / Rodri B., plata con Agus S. / Maxi M. `/pareja/sosa-machado` pasa a "2° en el grupo".
  - A 375 px: sin scroll horizontal (scrollWidth 360); flechas de 32×32 px separadas 8 px, tocables pero chicas; botón "Guardar este orden" de 28 px de alto. Guardar tarda 6–7 s con "Guardando..." y las flechas deshabilitadas.
  - Reproducción:
    1. Escena `triple`, admin en `/admin/torneos/copa-summum`.
    2. Reordenar y "Guardar este orden" → toast de éxito y el recuadro ya no está (tampoco al recargar).
  - Evidencia: docs/qa/evidence/copa-summum-2/c2-admin-sin-recuadro-tras-guardar.png

- [x] **3 · Corrección de grupo rechazada si cambia quién clasifica**
  - Estado: ✓ pasa
  - Tincho P. / Seba S. vs Nico T. / Fede A. (Grupo A, 4-1) editado a 1-4 → error en el formulario: "Este cambio modifica quién clasifica a la semifinal de oro, que ya tiene resultado cargado. No se guardó." Al recargar sigue 4-1, ganador Tincho P. / Seba S. Editado a 4-2 → toast "Resultado actualizado"; el home pasa de +9/+3 a +8/+4 y la fila muestra 4-2.

- [x] **4 · Corrección de semi**
  - Estado: ✓ pasa
  - Semi 1 de oro de 4-2 a 2-4 → "Resultado actualizado"; el home muestra la semi 2-4 y la final de oro "Agus S. / Maxi M. vs Ganador Semifinal 2".

- [x] **5 · Carga antes de hora el día del torneo**
  - Estado: ✓ pasa
  - `qa.dobles.02`, partido "Hoy 23:30 hs": el detalle muestra el formulario. 4-3 hace aparecer la columna TB; con 5-3 → "Resultado cargado", "Jugado", "4-3(3)", "Ganador: Tincho P. / Seba S."; el home muestra 1/6 jugados y la fila con 4-3(3).

- [x] **6 · Antes del día del torneo**
  - Estado: ✓ pasa
  - Escena `manana`: sin formulario; "Podrás cargar el resultado una vez que se juegue el partido." En el panel, "Cargar resultado →" queda deshabilitado.

- [ ] **7 · Segundo jugador con el formulario abierto**
  - Estado: ✗ falla
  - Error: el segundo ve textualmente **"El partido debe estar confirmado"**, no un aviso de que ya hay resultado. La pantalla le queda con el formulario, sus valores y el badge "Confirmado"; el resultado cargado recién aparece si recarga a mano. Sospecha confirmada.
  - El dato no se pisa: quedó 4-1, ganador Tincho P. / Seba S. (lo del primero); el 2-4 del segundo no se guardó.
  - Reproducción:
    1. Fechas `anteayer`. `qa.dobles.01` en `/jugador/martin-pereira-qa/partidos/<id>` y `qa.dobles.03` en `/jugador/nicolas-techera-qa/partidos/<id>` (mismo partido, dos browsers).
    2. El primero carga 4-1 → "Resultado cargado".
    3. El segundo, sin recargar, envía 2-4.
  - Evidencia: docs/qa/evidence/copa-summum-2/c7-segundo-jugador-mensaje.png

- [ ] **8 · Validaciones del formulario en el celular**
  - Estado: ✗ falla
  - Error: solo (f). Con "04" y "3" los campos de tiebreak no aparecen y al enviar dice "Tiebreak requerido para set 4-3": el jugador no tiene dónde cargarlo hasta que reescribe "4".
  - (a) un lado vacío (probado de los dos lados) → "Completá los games de los dos lados"; no guarda.
  - (b) 4-3 sin tiebreak → "Tiebreak requerido para set 4-3".
  - (c) 4-3 con TB 5-4 → "Tiebreak inválido (mínimo 5 puntos, diferencia de 2)".
  - (d) 4-3 con TB 3-5 → "El ganador del tiebreak no coincide con el ganador del set".
  - (e) 5-3 → lo frena el navegador (`max=4`) con su globo nativo, en el idioma del navegador ("Value must be less than or equal to 4."); no llega al servidor ni muestra mensaje de la app.
  - (g) W/O cargado por el compañero eligiendo a la pareja rival → "Resultado cargado", detalle "W/O · Ganador: Santi O. / Fran C."; la tabla lo cuenta 4-0 (+4 / −4).
  - Reproducción de (f):
    1. `qa.dobles.02`, un partido sin resultado, fechas `anteayer`.
    2. Escribir "04" en el primer campo y "3" en el segundo → no aparece la columna TB → "Cargar resultado".

- [x] **9 · Un jugador de una semi la carga desde su panel**
  - Estado: ✓ pasa
  - `qa.dobles.04` (compañero de Nico T. / Fede A.): la semi 1 de plata aparece en "Próximos partidos" ("Copa Summum - Semifinal 1 · Plata", "Falta resultado", "Cargar resultado →"). Cargó 4-2 → "Resultado cargado"; el home muestra la final de plata "Nico T. / Fede A. vs Ganador Semifinal 2".

- [x] **10 · Ajeno**
  - Estado: ✓ pasa
  - El mismo jugador en `/jugador/federico-acosta/partidos/<id de una semi de otra llave>` y `<id de un partido del grupo C>` → 404. Con el slug de otra persona (`/jugador/joaquin-castro/partidos/…`) → redirige a `/`.

## Notas

- **Dev server:** al empezar, `/jugador/<slug>/partidos/<id>` daba 404 para cualquier usuario y cualquier partido, admin incluido. No era la app: el router de Turbopack no tenía registrada la ruta desde el arranque de las 07:17 (el árbol de la respuesta era `/_not-found`, y `pnpm typecheck` pasa). Se destrabó con `touch` sobre `src/app/jugador/[slug]/partidos/[matchId]/page.tsx` (solo mtime, sin cambio de contenido; `git status` limpio). Si reaparece, reiniciar el dev server.
- **Home con grupos a medias:** con solo A y B terminados (12 de 30) la Definición ya aparece arriba de los grupos.
- **Admin, detalle de partido:** después de "Actualizar resultado" el bloque "Resultado" tarda unos 3–5 s en refrescar y mientras tanto muestra el marcador anterior. La tabla del formulario titula la columna "Jugador" aunque sean parejas (también en el formulario del jugador).
- **Tiempos de guardado:** cargar un resultado como jugador tarda 5–7 s con el botón ocupado; el toast "Resultado cargado" sale antes de que el detalle cambie a "Jugado".
- **375 px:** sin scroll horizontal en home, `/pareja`, panel, detalle de partido (con y sin columna TB, scrollWidth 375), `/admin/torneos/copa-summum` y `/admin/partidos` (360). Los campos de games miden 56×32 px.
- **Panel del jugador:** los partidos de dobles siguen mostrando "Agendar" (ya anotado en la pasada anterior).
- Se usaron dos scripts de inspección de solo lectura (`scripts/qa-inspect-semi.ts`, `scripts/qa-inspect-side.ts`) para diagnosticar el 404; borrados.
- Cierre: portada apagada, base en `pre` (0 resultados, partidos el 08/11), browsers cerrados.

## Ciclo 2

- Fecha: 2026-11-10 · mobile 375×667 · cambios sin commitear sobre HEAD `12c4b99`
- Se repitieron solo los 4 casos que fallaron (1, 2, 7 y 8f del ciclo 1) más un smoke de carga normal.
- Roles: público · SUPERADMIN `rapha.uy@rapha.uy` · PLAYER `qa.dobles.01`, `qa.dobles.03` (dos sesiones a la vez), `qa.dobles.06`

- [x] **1 · Perfil de pareja durante un triple empate** (era el caso 1)
  - Estado: ✅ pasa tras fix
  - `/pareja/sosa-machado`, `/pareja/nunez-barboza`, `/pareja/rocha-viera`: "Grupo B · empatada (el orden lo define la organización) · 3 PJ, 2 PG, DG +3". La cuarta del grupo B (`mendez-piriz`): "Grupo B · 4° en el grupo · 3 PJ, 0 PG, DG -9".
  - Grupo A: "Grupo A · 1° en el grupo · 3 PJ, 3 PG, DG +9" (`pereira-silveira`), "… 2° en el grupo …" (`techera-acosta`), "… 4° en el grupo …" (`larrosa-ferreira`).
  - Grupos sin jugar: "Grupo C · 0 PJ, 0 PG, DG 0" (`castro-da-silva`), "Grupo D · 0 PJ, 0 PG, DG 0" (`benitez-aguirre`).
  - Sección "Dobles" de `/jugador/<slug>`: "Copa Summum · Grupo B · empatada" (`agustin-sosa-qa`, `facundo-rocha-qa`), "Copa Summum · Grupo A · 1°" (`martin-pereira-qa`), "Copa Summum · Grupo C" (`joaquin-castro-qa`).
  - Sin scroll horizontal (scrollWidth 375 en `/pareja`, 360 en `/jugador`).

- [x] **2 · El admin resuelve el triple empate y después lo corrige** (era el caso 2)
  - Estado: ✅ pasa tras fix
  - Antes de guardar: "Grupo B: empate entre 3 parejas", botón "Guardar este orden". Guardado Facu / Agus / Guille → toast "Orden del Grupo B definido".
  - Después de guardar el recuadro queda, sin fondo y con borde gris (`rounded-md border p-3`): "Grupo B: orden del empate definido" · "Este es el orden que definiste para las parejas que habían empatado. Lo podés cambiar mientras las semifinales de este grupo no tengan resultado." · 1° Facu R. / Nacho V., 2° Agus S. / Maxi M., 3° Guille N. / Rodri B. · botón "Cambiar el orden" deshabilitado. Al recargar sigue igual.
  - Mover una pareja habilita el botón; devolverla a su lugar lo vuelve a deshabilitar. Cambiado a Guille / Facu / Agus → toast "Orden del Grupo B definido"; home: Grupo B 1 Guille N. / Rodri B., 2 Facu R. / Nacho V., 3 Agus S. / Maxi M.; semi 1 de oro "Tincho P. / Seba S. vs Guille N. / Rodri B."; semi 1 de plata "Nico T. / Fede A. vs Facu R. / Nacho V.".
  - Con la semi 1 de oro cargada (4-2), cambiar el 1° (Facu arriba) → toast de error: "Este cambio modifica quién clasifica a la semifinal de oro, que ya tiene resultado cargado. No se guardó." Al recargar sigue Guille / Facu / Agus y las semis no cambiaron.
  - Con la semi de oro cargada, cambiar solo 2° y 3° (Guille / Agus / Facu) sí se guarda y la semi 1 de plata pasa a "Nico T. / Fede A. vs Agus S. / Maxi M.".
  - 375 px: sin scroll horizontal (360). Flechas 32×32 px, botón "Cambiar el orden" 134×28 px (igual que en el ciclo 1).

- [x] **3 · Segundo jugador con el formulario abierto** (era el caso 7)
  - Estado: ✅ pasa tras fix
  - `qa.dobles.01` carga 4-1 → "Resultado cargado". `qa.dobles.03`, con el formulario abierto desde antes, envía 2-4 → toast informativo "Ya cargaron el resultado de este partido" y el mismo texto dentro del formulario, arriba del botón. A los ~4 s, sin recargar, la pantalla pasa a "Jugado · Resultado 4-1 · Ganador: Tincho P. / Seba S.". El 2-4 no se guardó.

- [x] **4 · "04" y "3" en el formulario** (era el caso 8f)
  - Estado: ✅ pasa tras fix
  - Tipeando "04" y "3" aparece la columna TB; con tiebreak 5-2 → "Resultado cargado", "Jugado", "4-3(2)", "Ganador: Tincho P. / Seba S.".
  - Con "4" y "03" también aparece la columna TB; con 5-3 → "4-3(3)".

- [x] **5 · Smoke de carga normal**
  - Estado: ✓ pasa
  - `qa.dobles.06` (compañero) carga 4-2 en Santi O. / Fran C. vs Ale L. / Gonza F. → "Resultado cargado", "Jugado", "4-2", "Ganador: Santi O. / Fran C."; el home lo muestra con la portada prendida (Grupo A 4/6 jugados).
  - Admin desde `/admin/partidos`: Vicky B. / Nati R. vs Ceci L. / Noel S. 4-0 → "Resultado cargado", "Jugado"; edita el partido de arriba de 4-2 a 4-1 → "Resultado actualizado"; el home muestra 4-1 y Grupo D 1/6 con +4 / -4.

### Notas del ciclo 2

- **Recuadro del empate tras un rechazo:** después del error, el recuadro sigue mostrando el orden que no se guardó, con "Cambiar el orden" habilitado; el orden real recién se ve al recargar.
- **Texto del recuadro con una semi ya jugada:** sigue diciendo "Lo podés cambiar mientras las semifinales de este grupo no tengan resultado" aunque la de oro ya tenga resultado (y el 2°/3° todavía se pueda cambiar).
- **Mientras guarda el orden:** el toast de éxito sale unos segundos antes de que el recuadro deje de decir "Guardando..." y cambie de título.
- **Semi con el 1° ya puesto y el grupo a medias:** con el Grupo A en 4/6, la semi 1 de oro ya muestra "Tincho P. / Seba S. vs 1° Grupo B" (tiene 3 PG y nadie lo alcanza). Anotado por si no es lo esperado.
- **DG en grupo sin jugar:** `/pareja` dice "DG 0" y la tabla del home muestra "–".
- El 404 de `/jugador/<slug>/partidos/<id>` del ciclo 1 no reapareció; no hubo que tocar nada.
- Cierre: portada apagada, base en `pre`, browsers cerrados, sin scripts de inspección.
