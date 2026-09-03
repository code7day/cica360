# CICA360 (front) — Know-how completo: integración del Home

> **Propósito de este documento**: el Home terminó de integrarse 2026-09-02, alineado 100% con el diseño de Figma (confirmación explícita del Tech Lead). Este doc existe para que CUALQUIER agente (Claude u otro) que retome trabajo en este proyecto — sobre todo si el agente anterior se quedó sin cuota a mitad de sesión — pueda ubicarse en 5 minutos: qué bloques tiene el Home, cómo están armados, qué patrones ya quedaron establecidos como estándar del proyecto, y sobre todo QUÉ ERRORES YA SE COMETIERON Y SE CORRIGIERON, para no repetirlos. No reemplaza a `CURRENT_STATE.md`/`PROGRESS.md` (que siguen siendo la fuente cronológica), es un resumen curado y estable de lo aprendido.
>
> Ver también el equivalente del lado backend: `genesis/docs/context/HOME_INTEGRATION.md`.

---

## 1. Estructura del Home — orden real de bloques

Fuente de verdad: `genesis/database/seeders/Cliente0ContentSeeder.php`, método `upsertHomePage()`. Este es el orden REAL en producción (Cliente 0 / CICA360), de arriba a abajo:

| # | `BlockTypeEnum` | Componente Astro | Notas |
|---|---|---|---|
| 1 | `hero` (`mode: 'slider'`) | `Hero.astro` | No trae título/imagen propios — referencia un `Slider` (`slider_id`) con 3 slides, cada uno con su propio CTA. Ver `Cliente0HomeSlidesSeeder`. |
| 2 | `rich_text` | `RichText.astro` | Intro "Centro Internacional de Consultoría y Asesoría" — `show_scroll_indicator: true` (flecha invitando a bajar, primera sección después del Hero), `content_width: boxed`, botón outline a `/sobre-cica`. |
| 3 | `split` | `Split.astro` | "¿Qué hacemos?" — imagen izquierda + lista de áreas de asesoría. `content_width: full` (bleed a los bordes), `text_background_color: #F6F6F6` (gris `cicagray-50`). |
| 4 | `split` | `Split.astro` | "¿A quién nos dirigimos?" — imagen derecha (`media_position: right`), mismo `content_width`/`text_background_color` que el anterior para que ambas secciones alternadas compartan look. |
| 5 | `testimonials` | `Testimonials.astro` | "Casos de éxito" — `limit: 5`, fondo sólido `#206576` (teal), tarjetas `#4D919E`. Botón "Más casos de éxito" → página `/casos-de-exito` (que sí lista todos, sin límite de 5). |
| 6 | `logos` | `Logos.astro` | "Empresas con las que trabajamos" — 10 logos reales sembrados (`Cliente0MediaSeeder`), filtro grayscale por default con hover a color real. |
| 7 | `cta` | `Cta.astro` | Cierre de la home, fondo en capas (color + imagen opcional + overlay). |

El **Footer** (header + colophon + footer_bottom) NO vive en la página `home` — es la página especial `footer-principal` (`type: Footer`), sembrada aparte y renderizada globalmente por `BaseLayout.astro`/`Footer.astro` (nav) + el bloque `footer` en cada página de contenido normal (que a su vez resuelve `footer_page.blocks[]` = `colophon` + `footer_bottom` de esa página especial). El **Header** (nav superior) usa el menú principal (`Menu`/`MenuItem`, resuelto por `genesis` vía `GET /menus/{slug}`), renderizado por `Header.astro`, NO por un bloque de página.

---

## 2. Mapeo componente ↔ bloque (todos en `src/components/blocks/`, salvo lo indicado)

| Bloque (`type`) | Archivo |
|---|---|
| `hero` | `Hero.astro` |
| `rich_text` | `RichText.astro` |
| `split` | `Split.astro` |
| `testimonials` | `Testimonials.astro` |
| `logos` | `Logos.astro` |
| `cta` | `Cta.astro` |
| `colophon` | `Colophon.astro` |
| `footer_bottom` | `FooterBottom.astro` |
| `footer` (genérico, re-despacha `footer_page.blocks[]`) | `FooterBlock.astro` |
| `features`, `faq`, `contact_form`, `legal_notice`, `heading`, `image`, `services_grid` | stubs o implementaciones menores, no forman parte del Home |
| Header (nav superior, NO es un bloque) | `../Header.astro` |
| Footer (nav inferior fijo, NO es un bloque) | `../Footer.astro` |
| Dispatcher central | `BlockRenderer.astro` (mapea `block.type` → componente) |

---

## 3. Escala de breakpoints CUSTOM del proyecto — CRÍTICO, no es la de Tailwind

Definida en `src/styles/global.css` (`@theme`, custom properties). **Todo el trabajo de responsive en este proyecto usa ESTA escala, no la default de Tailwind** — el error más fácil de cometer si no se conoce es asumir `sm=640px`/`md=768px`/`lg=1024px` de Tailwind stock:

```
3xs:375px  2xs:390px  xs:414px  2sm:520px  sm:540px  md:768px  2md:810px
3md:960px  4md:1024px  lg:1080px  2lg:1120px  3lg:1200px  4lg:1280px
xl:1366px  2xl:1440px  3xl:1536px  4xl:1680px  5xl:1700px  6xl:1920px  7xl:2560px
```

Los 2 breakpoints que más se repiten en el Home (columnas de grids/carousels): **`sm` = 540px** y **`lg` = 1080px** — no 640/1024. Antes de escribir cualquier clase responsive nueva, confirmar en `global.css` que el breakpoint con ese nombre significa lo que uno espera.

---

## 4. Patrones arquitectónicos ya establecidos — reusar, no reinventar

### 4.1 `content_width` (fullwidth vs. boxed)
Property genérica reusada en `split`/`rich_text`/`logos`/`cta` (definida del lado `genesis` en `PropertiesSchema`). La SECCIÓN (`<section>`) siempre es fullwidth de fondo; `content_width` solo condiciona el ANCHO DEL CONTENEDOR INTERNO (`max-w-none` vs `max-w-6xl`). Nunca se debe volver a hacer que la sección entera tenga un `max-w-*` — ya se estandarizó que el fondo siempre sangra a los bordes.

### 4.2 `background_type` unificado (solid/gradient/image)
Todo bloque con color de fondo tiene `background_type` obligatorio (`solid`/`gradient`, y `image` en los que aplica — `cta`/`hero`/`heading`). Resuelto vía `src/lib/background.ts` → `resolveBackgroundStyle()`, genérico y reusable — cualquier bloque nuevo con fondo debe usar esta función, no reinventar el cálculo de gradiente a mano.

### 4.3 Fondo semi-transparente de tarjetas con hover (`color-mix()`)
Patrón usado en `Testimonials.astro` (`.testimonial-card`): el color de fondo elegido en Studio NO se aplica a opacidad completa — se mezcla con transparente vía CSS `color-mix()`, con % configurable desde Studio (`item_background_opacity`, default 30%, sube a +20 en `:hover`/`:focus-within`). Un `style` inline NO puede expresar `:hover`, por eso los % se pasan como custom properties (`--item-bg-opacity`) y la mezcla real ocurre en un `<style>` scoped.

### 4.4 Carousel dinámico item-por-item con `itemsPerView` medido en runtime + wraparound por clones — EL PATRÓN MÁS IMPORTANTE DE ESTE DOCUMENTO

Este es el patrón que más iteraciones costó (ver §5, "Historia de bugs") y el que cualquier carousel nuevo con paginación por dots DEBE seguir desde el principio, no reinventar. Implementado primero en `Logos.astro`, después replicado en `Testimonials.astro`. Resuelve: mostrar N items a la vez (N varía por breakpoint), avanzar de a "página completa" (no de a 1 item), calcular la cantidad de dots correctamente, y que la ÚLTIMA página — si el total no es múltiplo de N — se autocomplete con los primeros items en vez de dejar un hueco o una tarjeta huérfana con espacio vacío al lado.

**Los 3 errores que NO hay que repetir** (ver detalle en §5):
1. Un dot por ITEM (`items.map()` para los dots) en vez de un dot por PÁGINA — con 5 testimonios se ven 5 dots aunque la vista muestre 3 a la vez.
2. Ventana deslizante (`items.length - itemsPerView + 1` posiciones, avanzando de a 1 item) en vez de avance por página completa (`Math.ceil(items.length / itemsPerView)`).
3. Páginas PRE-ARMADAS en build time con un tamaño FIJO (ej. siempre 3) metidas dentro de un CSS grid responsive — si el grid muestra menos columnas que el tamaño de página en ese breakpoint, sobra una tarjeta sola con espacio vacío al lado ("se ve mal por columnas").

**La solución final (arquitectura correcta, implementarla así desde el día 1 en cualquier carousel nuevo):**

- El track es un `<div class="flex ... overflow-x-auto scroll-smooth" data-X-track>` con scroll NATIVO — no páginas armadas en Astro/build time.
- Cada item real lleva `data-X-item` y clases `basis-*` responsive que hacen que el ancho de cada item coincida EXACTO con la cantidad de columnas del breakpoint (ej. `basis-full sm:basis-[calc(50%-1rem)] lg:basis-[calc(33.333%-1.334rem)]`, fórmula `calc(100%/N - (N-1)/N * gap)` con `gap` = el gap real del track, `gap-8` = 2rem en este proyecto).
- El contenedor de dots se renderiza VACÍO en Astro (`<div data-X-dots />`) — los dots se contruyen 100% en JS (`buildDots()`), nunca con `items.map()` en el `.astro`.
- El script mide `itemsPerView` en runtime: ancho real del primer item (`getBoundingClientRect().width`) + gap real (`getComputedStyle(track).columnGap`), comparado contra `track.clientWidth`. Se recalcula en cada `resize` (con debounce ~150ms).
- `totalPages = Math.ceil(realItems.length / itemsPerView)` — ESTA es la cuenta correcta de dots, nunca `realItems.length` ni una ventana deslizante.
- **Wraparound**: al montar el carousel, se CLONAN los primeros N items (N = el máximo de `itemsPerView` posible según la spec del bloque, ej. 7 para Logos, 3 para Testimonials) y se agregan al FINAL del track, marcados `aria-hidden="true"` + `tabindex="-1"` (decorativos, no deben ser alcanzables por teclado ni lectores de pantalla). Así, cuando la última página real queda incompleta, el scroll nativo simplemente sigue mostrando los clones (que son testimonios/logos reales, solo repetidos) en vez de un hueco vacío. Los clones se ocultan (`display: none`) cuando no hacen falta (`isOverflowing === false`, todos los items entran en una sola vista) para no inflar el `scrollWidth` innecesariamente.
- `scrollToIndex(page)` calcula el índice de item real (`page * itemsPerView`, clampeado a `allItems.length - 1`, donde `allItems = [...realItems, ...clones]`) y hace `track.scrollTo({left: target.offsetLeft - track.offsetLeft, behavior: 'smooth'})`.
- Drag (Pointer Events, mouse+touch+pen unificados), auto-avance con pausa en interacción, y respeto de `prefers-reduced-motion` son transversales a Logos y Testimonials — mismo esqueleto de funciones (`stop`/`start`/`pauseThenResume`/`onPointerDown`/`onPointerMove`/`onPointerUp`).

Implementaciones de referencia completas (leer el `<script>` de cualquiera de los 2 para copiar el patrón entero): `src/components/blocks/Logos.astro` y `src/components/blocks/Testimonials.astro`.

---

## 5. Historia de bugs ya resueltos — leer ANTES de tocar estos archivos

### 5.1 `MenuTreeBuilder` (Filament, lado genesis) sin ningún estilo
Causa: Filament 5 no compila clases Tailwind arbitrarias usadas en Blade views custom de la app sin un theme de panel registrado (`->viteTheme()`). Ver `genesis/docs/context/HOME_INTEGRATION.md` para el detalle — no es un bug de este repo, pero afecta la administración del menú que alimenta el Header.

### 5.2 Carousel de Logos: dots = `items.length` (uno por logo)
2026-09-01. Con 10 logos y solo 7 visibles a la vez, se veían 10 dots — corregido primero a "ventana deslizante" (`N - itemsPerView + 1`), que TAMPOCO era correcto (ver 5.3).

### 5.3 Carousel de Logos: ventana deslizante en vez de páginas
2026-09-02. La "ventana deslizante" (avanzar de a 1 item, contar posiciones alcanzables) daba 5 dots con 10 logos y 6 visibles — el Tech Lead esperaba 2 (`Math.ceil(10/6)`). Corregido al modelo final descrito en §4.4 (páginas completas + wraparound por clones).

### 5.4 Carousel de Testimonios: 3 iteraciones hasta llegar al modelo correcto
1. **1ra**: páginas fijas de `MAX_GRID_ITEMS=3` armadas en build time (`testimonialPages`, con wraparound circular vía índice `% items.length`) — el diseño se documentó en el código pero el MARKUP nunca se actualizó (seguía usando `items.map()` plano, 5 dots con 5 testimonios). Se corrigió a conectar el diseño documentado.
2. **2da**: una vez conectado, el grid interno de cada página (`sm:grid-cols-2 lg:grid-cols-3`) dejaba una tarjeta huérfana con espacio vacío cuando la página fija de 3 caía en un breakpoint de 2 columnas (540–1079px) — "se ve mal por columnas". Causa raíz: el tamaño de página estaba FIJO en 3, pero el grid mostraba menos columnas en ese rango.
3. **3ra (final)**: se abandonó el modelo de páginas pre-armadas por completo, reemplazado por el patrón dinámico de §4.4 (idéntico al ya resuelto en Logos). Esta es la versión vigente — **si se necesita tocar el carousel de Testimonios, partir de acá, no de las 2 iteraciones anteriores.**

### 5.5 Breakpoint del grid de Testimonios — 3 vueltas hasta la spec final
El corte de columnas pasó por 3 valores distintos el mismo día (`md:grid-cols-2 2lg:grid-cols-3` original → salto directo `3md:grid-cols-3` sin paso intermedio → spec final `sm:grid-cols-2 lg:grid-cols-3`, que es la vigente: 1 columna <540px, 2 desde 540px, 3 desde 1080px). Confirmado con el Tech Lead explícitamente como "todo horizontal" desde 540px (nunca debe volver a apilarse verticalmente arriba de ese ancho).

### 5.6 `Colophon.astro` — alineación responsive, 2 vueltas
1ra vuelta: centrado en mobile, alineado a la izquierda desde `sm` (540px) — sin estado intermedio.
2da vuelta (spec final): el corte de alineación se mueve de `sm` a `md` (768px) — entre 540 y 767px la columna de marca ocupa la fila completa (`sm:col-span-2 md:col-span-1`), empujando Contacto+Síguenos a su propia fila de 2 columnas debajo, todo centrado; recién desde 768px vuelve a la fila única de 3 columnas alineada a la izquierda. `GRID_COLS_CLASSES` y el `justify-*` de `social_links` deben usar el MISMO breakpoint (`md`) — quedó documentado un descuido real donde uno de los dos se actualizó y el otro no, hay que revisar ambos juntos si se vuelve a tocar.

### 5.7 Menú/submenús — profundidad real vs. límite de UI
La API (`genesis`) soporta árboles de menú recursivos de profundidad ILIMITADA (`MenuController::buildTree()`, `MenuItemResource`). El builder de Studio (`MenuTreeBuilder`) cappea la CREACIÓN a 3 niveles (`maxDepth(3)`) — límite de autoría, no de la API. `Header.astro` (este repo), sin embargo, **solo renderiza 1 nivel de submenú** (`item.children`, nunca `item.children[].children`) — gap conocido, **explícitamente pospuesto por el Tech Lead** ("No, dejarlo para después"). Si se vuelve a levantar este tema, no hace falta releer todo el historial — el gap y la decisión de posponer ya están documentados acá y en `TASK.md`.

---

## 6. Limitaciones del sandbox de trabajo (recordatorio permanente)

- No hay runtime de Node/Vite funcional en el sandbox de verificación (los binarios nativos de `rolldown` instalados son `darwin-arm64`, no corren en este contenedor Linux) — `npm run build`/`npm run dev` deben correrse en la máquina del Tech Lead.
- Verificación de sintaxis de archivos `.astro` se hace con un tokenizer Python de balance de brackets (`(`/`)`, `{`/`}`, `[`/`]`) sobre el archivo completo, y adicionalmente `npx tsc --noEmit --ignoreConfig` sobre el contenido del `<script>` extraído por separado (ese `tsc` local SÍ está disponible, versión 6.0.3) — este último puede arrojar un falso positivo conocido (`Property 'dataset' does not exist on type 'Element'`) cuando una función anidada dentro de un `forEach((root) => {...})` referencia `root.dataset.*` — es una pérdida de narrowing de TS sobre un parámetro `const` capturado por closure, no un bug real; ya se documentó en `Logos.astro`.
- Ningún fix de esta sesión fue confirmado visualmente en navegador real — todo queda pendiente de confirmación del Tech Lead corriendo local.

---

## 7. Estado al cierre de esta sesión (2026-09-02)

Home 100% integrado y confirmado por el Tech Lead como fiel al diseño de Figma ("quedó todo el HOME integrado tal cual el diseño de figma como espectativa"). Ver `PROGRESS.md`/`CURRENT_STATE.md` para el detalle cronológico completo de cada iteración. Próximos pasos sugeridos (no bloqueantes, a definir con el Tech Lead): extender `Header.astro` a 2-3 niveles de submenú (§5.7), y encarar el resto de páginas de contenido (Servicios, Casos de Éxito completos, Sobre CICA, Contacto) con el mismo nivel de detalle que el Home.
