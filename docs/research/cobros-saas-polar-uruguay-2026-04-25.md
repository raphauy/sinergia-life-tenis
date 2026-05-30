# Cobros de SaaS desde Uruguay con Polar (Merchant of Record)

**Fecha:** 2026-04-25
**Autor:** Notas de investigación para definir estructura de cobros y facturación de SaaS vendidos al exterior desde Uruguay.
**Audiencia:** Uso personal + insumo para conversación con contador.

---

## 1. El problema: Stripe no resuelve todo

Cuando un cliente paga un SaaS pasan **tres cosas**, y Stripe solo cubre una:

1. **Mover el dinero** de la tarjeta a tu cuenta → Stripe lo hace bien.
2. **Emitir factura legal** con datos fiscales, numeración secuencial, IVA correcto → responsabilidad tuya.
3. **Calcular el impuesto correcto** (depende del país del cliente, no del tuyo) → responsabilidad tuya.

Cuando cobrás directo con Stripe, vos sos el **seller of record**: el vendedor legal. Eso implica cuatro obligaciones permanentes desde la primera venta:

- **Calcular impuestos** según país y tipo de cliente (IVA local, sales tax USA por estado, GST, etc.).
- **Emitir factura legal** (el email de Stripe **no es factura legal** en la mayoría de países).
- **Archivar** facturas durante el plazo legal de cada jurisdicción (España 4 años, Alemania/Francia/Italia 10 años).
- **Declarar y remitir** los impuestos cobrados a cada fisco.

**Stripe Tax** ayuda parcialmente con el cálculo de impuestos, pero **no emite factura legal con tu numeración, no archiva, no declara y no paga**.

### Conclusión

Cobrar con Stripe directo te obliga a montar (o pagar a alguien que monte) toda la "fontanería fiscal": software de facturación, contador, declaraciones multipaís, etc. Mucho tiempo y atención que no va al producto.

---

## 2. La solución: Merchant of Record (MoR)

Un **Merchant of Record** es un proveedor que **firma él** las facturas en lugar tuyo. El cliente compra en tu web, ve tu marca, habla con tu soporte, pero la factura legal la emite el MoR. Como firma él, también responde él.

### Qué te quita el MoR

- Emisión de factura legal con campos exigidos por cada país.
- Cálculo del IVA / sales tax / GST.
- Archivo durante los plazos legales de cada jurisdicción.
- Declaración y pago al fisco de cada país.
- Gestión de chargebacks y disputas (en muchos casos).

### Qué te cobra

- Comisión por transacción **4% – 8%** (vs ~2.9% + 30¢ de Stripe directo).
- Es más caro porque **es otro servicio**: no estás pagando solo por mover dinero, estás pagando para **no ser** el vendedor legal en decenas de países.

---

## 3. Comparativa de Merchants of Record (abril 2026)

| Proveedor | Comisión | Estado / observaciones |
|---|---|---|
| **Polar** | 4% + 40¢ | Open source first, excelente DX, integración nativa Next.js. Recomendado para indies. |
| **Creem** | 3.9% + 40¢ | Más barato de entrada, agresivo. Algunos extras se pagan aparte. |
| **Paddle** | 5% + 50¢ | Veterano, ahora orientado a Enterprise. Caro y lento para indies. |
| **Lemon Squeezy** | 5% + 50¢ | Comprado por Stripe en julio 2024. Roadmap congelado, futuro incierto. No recomendado para nuevos proyectos. |
| **Stripe Managed Payments** | 6.4% | El propio MoR de Stripe (en preview público). Caro. |

**Elección:** **Polar** para todos los SaaS nuevos. **Creem** como alternativa si Polar tiene fricción en el onboarding desde Uruguay.

---

## 4. Polar reemplaza a Stripe — no se usan juntos

**No necesitás abrir cuenta de Stripe**. Polar tiene su propia infraestructura de pagos (usa Stripe Connect Express **por dentro**, con su cuenta, no la tuya).

### Flujo

```
Cliente → checkout de Polar
            ↓
        Polar cobra (con su Stripe interno)
            ↓
        Polar emite factura legal al cliente
            ↓
        Polar calcula y remite impuestos al fisco de cada país
            ↓
        Polar te transfiere payout neto a tu banco UY (mensual o quincenal)
```

Vos integrás **una sola cosa**: el SDK de Polar. Tu app escucha sus webhooks para activar suscripciones, gestionar entitlements, etc.

---

## 5. Uruguay puede usar Polar como seller

**Confirmado en la documentación oficial de Polar:** Uruguay está listado como país soportado para sellers.

> Documentación oficial: https://polar.sh/docs/merchant-of-record/supported-countries

### Por qué funciona si Stripe "no opera" en Uruguay

El problema histórico de Stripe en Uruguay era para cuentas **standalone** (vos abrís tu cuenta Stripe directamente). **Stripe Connect Express** (subcuentas gestionadas por una plataforma) **sí soporta Uruguay** desde hace años. Polar usa Connect Express para hacerte los payouts, así que no chocás con la limitación.

### Países LatAm soportados por Polar

Argentina, Bolivia, Chile, Colombia, Costa Rica, República Dominicana, Ecuador, El Salvador, Guyana, Jamaica, México, Panamá, Paraguay, Perú, Trinidad y Tobago, **Uruguay**.

### Alternativa confirmada

**Creem** también soporta Uruguay (payout vía transferencia bancaria local, fee 7 USD o 1% del payout, lo mayor).

---

## 6. Plan fiscal en Uruguay

Esta es la parte que necesita **validación con un contador uruguayo especializado en exportación de servicios de software**. La información que sigue es la base que reuní para esa conversación.

### 6.1. Situación personal de partida

- Soy **profesional universitario** con título registrado en CJPPU.
- Tuve una unipersonal hace años, hoy **cerrada**.
- Estoy **en estado de "No Ejercicio" en CJPPU** desde el cierre de esa unipersonal — sin obligación actual de aportar a la Caja.
- Quiero **reabrir una unipersonal** para vender SaaS al exterior cobrando vía Polar (Suecia).

### 6.2. Estructura elegida: Unipersonal + BPS Industria y Comercio

| Tipo | Por qué | Estado |
|---|---|---|
| **Unipersonal — giro Industria y Comercio** | Lo más simple, accede a exoneración IRPF software (ver §6.5). Mantiene el "No Ejercicio" en CJPPU porque la actividad NO es ejercicio profesional, es comercialización de un producto. | **Elegida** |
| Unipersonal de profesional universitario | Dispararía aviso a CJPPU y obligaría a volver a aportar allí. | **Descartada** |
| SAS / SRL / SA | Aplican a otros casos (con socios, mucho volumen, exoneración IRAE Ley 19.637). Más overhead contable. | Descartadas para este caso |
| Sociedad de hecho | Sin acceso a exoneración IRAE. Fiscalmente la peor opción. | Descartada |

**Importante sobre la inscripción:** al reabrir la unipersonal en BPS, usar el trámite **"Inscribir empresa unipersonal"** (régimen general, Industria y Comercio), **NO** el trámite específico de "Inscribir empresa unipersonal de profesional universitario" — ese último notifica automáticamente a CJPPU y obliga a aportar allí.

### 6.3. CJPPU vs BPS: por qué es legal y consistente

La normativa uruguaya distingue claramente:

| Actividad | Aporte previsional |
|---|---|
| **Vender un producto SaaS** (suscripciones a software autoservicio) | **BPS Industria y Comercio** |
| Vender horas de consultoría / desarrollo a medida como ingeniero | CJPPU |

Respaldo (BPS):

> "Quienes realizan actividades de servicios personales no incluidas en la CJPPU (...) realizan sus aportes (...) los previsionales por **Industria y Comercio**."

> "En caso que la empresa brinde servicios profesionales, la persona debe aportar a la Caja de Profesionales Universitarios; en caso de que los servicios sean personales **pero no profesionales** deberá aportar al BPS."

Vender un SaaS encaja claramente en **comercialización de un producto** → Industria y Comercio → BPS.

**Riesgo a vigilar:** que DGI/BPS recalifique la actividad como "servicios profesionales" si el modelo de negocio incluye consultoría facturada como horas. Para minimizarlo:

- Que el modelo sea claramente de producto: suscripción mensual/anual, autoservicio, sin componente de horas profesionales.
- Facturas a Polar con concepto "licencia de uso de software" o "servicio de suministro de software", no "servicios de consultoría".
- **No mezclar consultoría profesional** dentro de esta unipersonal mientras esté el No Ejercicio CJPPU activo. Si más adelante hago consultoría puntual, requiere declarar Libre Ejercicio en CJPPU al menos por esa parte.

### 6.4. ¿A quién le facturo? → A Polar

Punto clave que muchos confunden:

- El **cliente final** compra a **Polar** (Polar es el seller of record, su nombre va en el resumen de tarjeta del cliente, Polar le emite factura al cliente).
- Polar te paga a **vos** por la "licencia" o "servicio" del software que ellos distribuyen.
- **Tu cliente fiscal es Polar Software AB (Suecia)**, **NO** el end user.

Por lo tanto, vos emitís una **e-Factura de Exportación (CFE tipo Factura de Exportación)** a nombre de Polar por el monto neto que te transfieren cada periodo. Eso justifica el ingreso bancario.

### 6.5. Exoneración de IRPF para unipersonales que exportan software

**Consulta DGI 6614** (diciembre 2023) confirmó que las **unipersonales que exportan servicios de software están exoneradas de IRPF** porque el servicio se "aprovecha íntegramente en el exterior".

**Actividades cubiertas:** desarrollo, implementación en cliente, actualización y corrección de versiones, personalización (GAPs), prueba y certificación de calidad, mantenimiento del soporte lógico, capacitación y asesoramiento.

**Requisitos:**

- Operar como **unipersonal** (no aplica a SAS, SRL ni SA).
- Equipo informático propio.
- Estar adherido a **factura electrónica**.
- Incluir el **addendum regulatorio específico** en cada e-Factura de exportación.
- **No optar por IRAE** (si optás por IRAE perdés el beneficio).

**Aclaración:** la exoneración es de **IRPF**. Los aportes previsionales (a BPS Industria y Comercio en este caso) se pagan igual.

### 6.6. Régimen tributario

| Régimen | Tope anual aprox. | Cuándo conviene |
|---|---|---|
| **Monotributo** | ~183.000 UI (~USD 30K) | Recién arrancando, ingresos chicos. Unifica BPS+DGI en un pago fijo mensual. |
| **Literal E (IVA mínimo)** | $1.959.229 UYU 2026 (~USD 50K) | Sweet spot para SaaS chico/mediano. Se paga IVA mínimo fijo, no IVA real. |
| **Régimen General (IRAE + IVA)** | Sin tope | Cuando crece el volumen. Para mantener exoneración IRPF software, optar por IRPF y no por IRAE. |

**Importante:** **exportación de servicios = IVA tasa 0%**, así que el IVA en sí no es el tema. Lo que pesa son los aportes a BPS y el impuesto a la renta.

### 6.7. Cómo se justifica el ingreso bancario

Cuando Polar te transfiere a tu cuenta uruguaya:

```
1. Cliente final paga a Polar (con tarjeta).
2. Polar emite factura legal al cliente.
3. Polar acumula tus ventas, descuenta su comisión (4% + 40¢) e impuestos remitidos.
4. Cada periodo (típico mensual) Polar te transfiere el neto a tu banco UY.
5. VOS emitís e-Factura de Exportación a Polar por ese monto.
6. La factura emitida + statement de payouts de Polar + extracto bancario = trazabilidad fiscal completa.
```

Si el banco pide origen de fondos (suelen hacerlo cuando empiezan a entrar montos significativos del exterior), se muestran:

- CFE de exportación emitido a Polar.
- Statement / dashboard de payouts de Polar.
- Inscripción DGI/BPS de la unipersonal.

### 6.8. Caso especial: clientes finales locales (UY) vendidos vía Polar

**Escenario:** un SaaS donde la mayoría de clientes finales son uruguayos, pero el cobro se hace a través de Polar (por simplicidad de infraestructura, futura expansión regional, etc.).

**Lo que es claro:**

1. **Es legal.** Podés vender a quien sea a través de Polar, incluyendo clientes uruguayos. Polar es un canal de venta legítimo.
2. **Tu factura a Polar sigue siendo de exportación** (Polar Software AB está en Suecia), independientemente de quiénes son los usuarios finales.
3. **El IVA al cliente UY lo gestiona Polar**, no vos. Polar como MoR debe cobrar IVA UY al cliente uruguayo final (igual que Netflix, Spotify, etc.) y remitirlo al fisco uruguayo. Verificable en el dashboard de Polar.

**Lo que es zona gris: la exoneración IRPF.**

La Consulta DGI 6614 requiere que el servicio sea "aprovechado íntegramente en el exterior". Hay dos interpretaciones posibles:

| Interpretación | Argumento | Resultado |
|---|---|---|
| **Formalista (favorable)** | Tu cliente fiscal es Polar (Suecia). Vos le facturás a Polar. Polar es el seller of record que distribuye el producto. Tu servicio se "consume" por Polar como distribuidor. | Exoneración IRPF aplica al 100% del payout. |
| **Sustantiva (desfavorable)** | DGI puede mirar a través de la estructura. El uso real del software ocurre en UY, por inmobiliarias uruguayas. "Aprovechado en el exterior" referiría al destino económico real. | Exoneración aplica solo a la porción de ingresos atribuible a clientes finales del exterior. |

DGI Uruguay tiene historial de aplicar interpretación sustantiva. **No hay consulta DGI específica sobre el caso MoR + cliente local** (es un escenario relativamente nuevo que la Consulta 6614 no contempla explícitamente).

**Riesgo práctico:** si DGI fiscaliza y ve que la mayoría de los usuarios finales son UY, podría reclamar IRPF + multas + recargos sobre la porción local.

**Estrategias posibles:**

1. **Conservadora:** aplicar exoneración solo a la porción de ingresos provenientes de clientes del exterior. Liquidar IRPF normal sobre la porción local. Polar registra el país de cada customer en el dashboard, lo cual permite el cálculo proporcional.
2. **Agresiva:** aplicar exoneración al 100% argumentando que tu cliente fiscal es Polar. Mayor beneficio, mayor riesgo.
3. **Definitiva:** hacer una **consulta vinculante a DGI** (~USD 500-1500) específica sobre el caso MoR + cliente local. Si la respuesta es favorable, blinda la posición agresiva. Es la inversión sensata cuando el volumen empieza a justificarlo.

**Documentación a conservar siempre:** export de Polar mostrando país de cada customer y monto, mes a mes. Sirve tanto para defender la posición elegida como para hacer el cálculo proporcional si toca.

---

## 7. Múltiples SaaS con una sola cuenta Polar

Polar está diseñado para esto. Estructura:

```
Cuenta de usuario Polar (login único)
  ├── Organización A (SaaS #1) → productos, checkout, branding propios
  ├── Organización B (SaaS #2) → productos, checkout, branding propios
  └── Organización C (SaaS #3) → ...
```

Cada **organización** es independiente desde la perspectiva del cliente final:

- URL/slug propio (`polar.sh/tu-saas-1`).
- Branding, logo, productos, precios separados.
- Webhooks propios (cada app de Next.js escucha solo los suyos).
- API tokens propios.
- Customer portal separado.

Desde el dashboard se cambia entre orgs con el selector abajo a la izquierda.

### Aspecto a confirmar con Polar

Hay indicios (hilo en GitHub de Polar) de que **cada organización requiere su propio onboarding de Stripe Connect Express**. Si todos los SaaS están bajo la misma unipersonal uruguaya, se repiten los mismos datos fiscales (RUT, cuenta bancaria) en cada org. Funciona, solo es más onboarding repetido.

**Confirmar:** preguntar en el Discord o por email a Polar antes de configurar varias orgs, para no rehacer trabajo.

---

## 8. Plan de acción concreto

1. **Hablar con un contador uruguayo** especializado en software / exportación de servicios.
   Referencias mencionadas en el sector: Carlos Picos, Dynamica, CDI.UY.
   Costo típico: 2K–5K UYU/mes (contador continuo).
   **No es opcional**: ahorra errores caros.

2. **Confirmar con el contador** que el giro Industria y Comercio (venta de SaaS) aplica para mi caso y que mantiene el No Ejercicio en CJPPU sin riesgo de recalificación.

3. **Reabrir unipersonal** ante DGI + BPS, **giro Industria y Comercio** (NO usar el trámite de "profesional universitario").
   - Código de actividad económica (CIIU) a definir con el contador. Para SaaS suele ser 6312 / 6201 / 6311.
   - Descripción del giro: algo tipo "servicios de suministro de software como servicio (SaaS)" o "comercialización de software".

4. **Adherir a factura electrónica**. Proveedores: Pymo, Memory, EDICOM, Bill (~500–1500 UYU/mes).

5. **Elegir régimen** (monotributo, literal E o general) según proyección de ingresos.

6. **Configurar la unipersonal como organización en Polar** y completar el onboarding de Stripe Connect (necesita RUT, dirección, cuenta bancaria UY).

7. **Por cada payout de Polar**, emitir CFE de exportación con el addendum de exoneración IRPF.

8. **Para cada SaaS adicional**, crear una nueva organización en Polar bajo la misma cuenta, con los mismos datos fiscales.

9. **No mezclar consultoría profesional** dentro de esta unipersonal mientras esté el No Ejercicio CJPPU activo.

---

## 9. Preguntas concretas para el contador

Para llevar a la primera reunión:

1. **Mi situación previa:** soy profesional universitario, tuve unipersonal hace años, hoy cerrada. Estoy en **No Ejercicio en CJPPU desde entonces**. Quiero reabrir unipersonal para vender SaaS al exterior cobrando vía Polar (Suecia).
2. ¿Reabrir como **unipersonal con giro Industria y Comercio** es la vía correcta para mantener el No Ejercicio en CJPPU sin riesgo de recalificación? ¿Hay que hacer algún trámite adicional con CJPPU al reabrir?
3. ¿Qué **código CIIU / descripción de giro** conviene declarar para que quede inequívocamente como actividad comercial (no servicios profesionales)?
4. ¿Confirmar exoneración IRPF según **Consulta DGI 6614** para mi caso (unipersonal exportando SaaS)? ¿Qué addendum exacto debe ir en la factura?
5. ¿Monotributo, Literal E o régimen general? ¿En qué umbral conviene cambiar?
6. ¿**Aportes BPS Industria y Comercio** estimados mensuales para unipersonal sin empleados? (Mínimo 11 BFC mencionado).
7. ¿Cómo emitir factura electrónica de exportación a una empresa europea (Polar Software AB, Suecia)? ¿Qué datos del receptor son obligatorios?
8. ¿Cómo declarar los ingresos cuando entran como **payout consolidado** (no factura por cliente final, sino payout mensual de Polar)?
9. Si tengo varios SaaS bajo la misma unipersonal, ¿facturas separadas por SaaS o consolidada por payout?
10. ¿Qué documentación archivar y por cuánto tiempo? (CFE emitidas, statements de Polar, extractos bancarios).
11. ¿Cuándo conviene migrar de unipersonal a SAS (umbral de facturación, riesgo patrimonial, otros)?
12. **Para un SaaS futuro con socio:** ¿conviene SAS desde el día 1? La exoneración IRAE de Ley 19.637 ¿cómo se accede en la práctica? ¿Coeficiente de empleo calificado en Uruguay si los socios desarrollan todo desde Uruguay sin empleados?
13. **Caso MoR con clientes finales locales (UY):** tengo un SaaS donde la mayoría de los clientes finales son uruguayos pero cobramos a través de Polar Software AB (Suecia). Le facturo a Polar (exportación), pero el "aprovechamiento" del software ocurre en UY. ¿Aplica la exoneración IRPF de Consulta DGI 6614 al 100% de los ingresos? ¿Solo a la porción de clientes finales del exterior (cálculo proporcional)? ¿Conviene gestionar una **consulta vinculante a DGI** específica para este escenario?

---

## 10. Disclaimer

Esta información es **investigación preliminar**, no asesoramiento legal ni fiscal. La regulación uruguaya cambia y los detalles dependen del caso concreto. **Validar todo con un contador uruguayo antes de constituir la empresa o comenzar a operar.**

---

## Fuentes consultadas

### Polar / Merchant of Record
- [Polar — Países soportados](https://polar.sh/docs/merchant-of-record/supported-countries)
- [Polar — Crear múltiples organizaciones](https://polar.sh/docs/guides/create-multiple-organizations)
- [Polar GitHub — Multiple accounts discussion](https://github.com/orgs/polarsource/discussions/3497)
- [Polar en X — uso de Stripe Connect Express](https://x.com/polar_sh/status/1915379610809782428)

### Creem (alternativa)
- [Creem — Países soportados](https://docs.creem.io/merchant-of-record/supported-countries)

### Paddle (referencia)
- [Paddle — Países soportados](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)

### Uruguay — Fiscal
- [Carlos Picos — Exoneración IRPF unipersonales que exportan software](https://carlospicos.com/exoneracion-de-irpf/)
- [Dynamica — Cómo facturo servicios al exterior](https://dynamica.com.uy/como-facturo-servicios-al-exterior/)
- [Uruguay Emprendedor — Formas de tributación](https://www.uruguayemprendedor.uy/tramite/formas-de-tributacion/)
- [Memory — Guía monotributo](https://memory.com.uy/blog-general/guia-monotributo-en-uruguay/)
- [CDI.UY — Unipersonal guía 2025](https://certificadodeingresos.uy/unipersonal-en-uruguay-guia-completa-2025/)
- [DGI — Factura electrónica](https://www.gub.uy/direccion-general-impositiva/tematica/factura-electronica)
- [Consulta Tributaria DGI 6614 (2023)](https://www.impo.com.uy/bases/consultas-tributarias/6614-2023)

### Uruguay — Profesional / CJPPU
- [CJPPU — Consecuencias de declarar No Ejercicio](https://www.cjppu.org.uy/novedad.php?id=307)
- [CJPPU — Profundización del control de declaraciones](https://www.cjppu.org.uy/novedad.php?id=253)
- [BPS — Inscribir empresa unipersonal](https://www.bps.gub.uy/11338/inscribir-empresa-unipersonal-dentro-del-mes-en-curso.html)
- [BPS — Inscribir empresa unipersonal de profesional universitario](https://www.bps.gub.uy/11401/inscribir-empresa-unipersonal-de-profesional-universitario-dentro-del-mes-en-curso.html)
- [GRO — Profesional con unipersonal: ¿CJPPU o BPS?](https://www.gro.com.uy/single-post/un-profesional-que-tiene-una-unipersonal-aporta-a-la-caja-de-profesionales-o-al-bps)
- [Darío Abilleira — Unipersonal con más de un giro](https://darioabilleira.com/2021/07/16/unipersonal-con-mas-de-un-giro-servicios-personales-y-una-actividad-comercial-ademas-es-dependiente-como-debe-aportar-al-bps/)

### Uruguay — Sociedades / SAS (referencia para caso futuro)
- [Carlos Picos — Ventajas de constituir una SAS en Uruguay](https://carlospicos.com/constituir-una-sas-en-uruguay/)
- [BPS — Sociedades por acciones simplificadas (SAS)](https://www.bps.gub.uy/17793/sociedades-por-acciones-simplificadas---sas.html)
- [Fernandez Secco — Beneficios tributarios al software (Ley 19.637)](https://fernandezsecco.com/en/2024/04/23/beneficios-tributarios-al-software/)
- [CUTI — Recordatorio: Exoneración IRAE sobre software](https://cuti.org.uy/en/destacados/recordatorio-exoneracion-irae-sobre-software-y-servicios-vinculados-al-mismo/)
