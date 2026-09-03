/**
 * Tipos del contrato del API Stamless v1, tal como lo consume este
 * proyecto. Fuente de verdad legible por humanos:
 * docs/context/api/stamless-api-v1.md — mantener sincronizado a mano si
 * el contrato cambia del lado del backend (no hay generación automática).
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'unauthenticated'
  | 'token_invalid'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'too_many_requests'
  | 'server_error';

export interface ApiErrorShape {
  code?: ApiErrorCode;
  fields?: Record<string, string[]>;
  detail?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  status_code: number;
  data?: T;
  meta?: PaginationMeta;
  links?: PaginationLinks;
  errors?: ApiErrorShape;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginationLinks {
  first: string | null;
  prev: string | null;
  next: string | null;
  last: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
}

// ---------------------------------------------------------------------------
// Recursos compartidos
// ---------------------------------------------------------------------------

export interface Media {
  uuid: string;
  url: string | null;
  alt_text: string | null;
  mime_type: string | null;
}

export type LinkSourceType = 'page' | 'post' | 'custom' | 'url';
export type LinkTarget = '_self' | '_blank';

/**
 * Ícono opcional por enlace — 1:1 con `LinkIconEnum` (genesis). Solo lo
 * puebla el sub-bloque `link_list` de `colophon` (2026-09-02, "faltan
 * iconos" en la columna Contacto); cualquier otro consumidor de
 * `ContentLink` (CTAs de página, ítems de menú) siempre lo recibe `null`,
 * sin efecto — ver `LINK_ICON_MAP` en `Colophon.astro`.
 */
export type LinkIcon = 'email' | 'phone' | 'whatsapp' | 'location' | 'link';

export interface ContentLink {
  type: string;
  label: string | null;
  source_type: LinkSourceType;
  source_slug: string | null;
  href: string | null;
  target: LinkTarget;
  icon?: LinkIcon | null;
}

/**
 * Tipos de bloque conocidos por este proyecto. La lista puede crecer del
 * lado del backend sin previo aviso — cualquier código que itere
 * `block.type` DEBE ignorar tipos desconocidos sin romper la página (ver
 * `BlockRenderer.astro`), nunca asumir que esta unión es exhaustiva en
 * runtime.
 */
export type BlockType =
  | 'hero'
  | 'rich_text'
  | 'image'
  | 'cta'
  | 'features'
  | 'faq'
  | 'contact_form'
  | 'legal_notice'
  | 'heading'
  | 'split'
  | 'testimonials'
  | 'logos'
  | 'services_grid'
  | 'footer'
  | 'colophon'
  | 'footer_bottom';

export interface Block {
  uuid: string;
  /** string, no BlockType — un tipo desconocido debe poder pasar por acá. */
  type: string;
  pretitle: string | null;
  title: string | null;
  subtitle: string | null;
  /** Forma libre según `type` — ver el manual del API para el detalle por bloque. */
  content: Record<string, unknown>;
  links: ContentLink[];
  properties: Record<string, unknown>;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export type PageType = 'page' | 'landing' | 'header' | 'footer' | 'colophon' | 'legal';

export interface PageSummary {
  uuid: string;
  slug: string;
  type: PageType | string;
  is_home: boolean;
  pretitle: string | null;
  title: string;
  subtitle: string | null;
  published_at: string | null;
}

export interface PageMeta {
  seo_title?: string | null;
  seo_description?: string | null;
  [key: string]: unknown;
}

export interface Page extends PageSummary {
  meta: PageMeta;
  links: ContentLink[];
  properties: Record<string, unknown>;
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface PostSummary {
  uuid: string;
  slug: string;
  pretitle: string | null;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  published_at: string | null;
  featured_image: Media | null;
}

export interface Post extends PostSummary {
  /** HTML ya renderizado (no bloques) — se inyecta directo en el layout de post. */
  content: string | null;
  meta: PageMeta;
  links: ContentLink[];
  properties: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/**
 * 2026-09-02 (ver ADR-044) — primer endpoint público del módulo de
 * Servicios. `content` es JSON libre según el form de `ServiceResource`
 * en Studio (Filament): párrafo intro + "¿Qué ofrecemos?" (checks) +
 * "Coberturas" (acordeón) + "¿Por qué elegirnos?" + tip de ayuda — sin
 * conversión a HTML del lado del backend (a diferencia de `Post.content`,
 * que sí es rich text ya renderizado).
 */
export interface ServiceCountry {
  iso: string;
  name: string;
}

export interface ServiceOffer {
  highlight: string;
  text: string;
}

export interface ServiceCoverage {
  label: string;
  intro: string | null;
  items: string[];
}

export interface ServiceContent {
  intro?: string | null;
  offers?: ServiceOffer[];
  coverages?: ServiceCoverage[];
  why_choose_us?: { title?: string | null; text?: string | null };
  tip?: { title?: string | null; text?: string | null };
  [key: string]: unknown;
}

export interface ServiceSummary {
  uuid: string;
  slug: string;
  pretitle: string | null;
  title: string;
  subtitle: string | null;
  countries: ServiceCountry[];
  image: Media | null;
}

export interface Service extends ServiceSummary {
  content: ServiceContent;
  meta: PageMeta;
  links: ContentLink[];
  properties: Record<string, unknown>;
  published_at: string | null;
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

export type MenuItemType = 'page' | 'post' | 'service' | 'external' | 'custom';

export interface MenuItem {
  uuid: string;
  title: string;
  type: MenuItemType | string;
  href: string | null;
  /** Resuelto por el backend desde `Page.is_home` — siempre `false` para post/external/custom. No inferir "es Home" comparando `href === '/'`. */
  is_home: boolean;
  target: LinkTarget;
  sort_order: number;
  children: MenuItem[];
}

export interface Menu {
  uuid: string;
  name: string;
  slug: string;
  items: MenuItem[];
}

// ---------------------------------------------------------------------------
// Sliders
// ---------------------------------------------------------------------------

export type BackgroundType = 'image' | 'video';

export interface SlideMedia {
  image_desktop: Media | null;
  image_tablet: Media | null;
  image_mobile: Media | null;
  video_desktop: Media | null;
  video_mobile: Media | null;
}

/**
 * Posición del contenedor de pretitle/title/subtitle/CTA sobre el slide,
 * `{vertical}-{horizontal}`. En mobile el front siempre fuerza
 * `bottom-center`, sin importar el valor configurado.
 */
export type PositionContainer =
  | 'top-left'
  | 'middle-left'
  | 'bottom-left'
  | 'top-center'
  | 'middle-center'
  | 'bottom-center'
  | 'top-right'
  | 'middle-right'
  | 'bottom-right';

/** Alineación del texto/CTA dentro del contenedor. En mobile se fuerza `center`. */
export type AlignContent = 'left' | 'center' | 'right';

/** Shape SVG sobrepuesto en el borde inferior (o superior) de un slide/bloque. */
export type DecoratorShape = 'none' | 'wave' | 'zigzag' | 'curve' | 'diagonal' | 'triangle';

/** Valores de CSS `mix-blend-mode` con soporte estable en todos los navegadores. */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/**
 * `properties` de un Slide. Todos los campos son opcionales — pueden venir
 * ausentes si nunca se configuraron en Studio; ver
 * docs/context/api/stamless-api-v1.md para los defaults de cada uno.
 */
export interface SlideProperties {
  position_container?: PositionContainer;
  align_content?: AlignContent;
  decorator_bottom?: DecoratorShape;
  decorator_bottom_color?: string | null;
  decorator_bottom_opacity?: number;
  slide_background_color?: string | null;
  slide_background_brightness?: number | null;
  slide_background_opacity?: number;
  slide_background_blend_mode?: BlendMode;
  slide_background_filter_saturate?: number;
  slide_background_filter_grayscale?: number;
  slide_background_filter_sepia?: number;
  slide_background_filter_contrast?: number;
  slide_background_filter_hue_rotate?: number;
  slide_background_filter_blur?: number;
}

export interface Slide {
  uuid: string;
  pretitle: string | null;
  title: string | null;
  subtitle: string | null;
  background_type: BackgroundType;
  media: SlideMedia;
  has_presentation_video: boolean;
  presentation_youtube_id: string | null;
  links: ContentLink[];
  properties: SlideProperties;
  sort_order: number;
}

/**
 * `properties` de un Slider (no de un Slide individual) — 2026-08-31,
 * corrección del Tech Lead sobre la primera pasada del mismo día: la flecha
 * de scroll no se prende/apaga por slide, es una sola vez por Slider,
 * sobrepuesta al decorador inferior de todas las slides detrás.
 */
export interface SliderProperties {
  show_scroll_indicator?: boolean;
}

export interface Slider {
  uuid: string;
  title: string;
  slug: string;
  properties: SliderProperties;
  slides: Slide[];
}

// ---------------------------------------------------------------------------
// Colophon (bloque `colophon`, pie de página multi-columna)
// ---------------------------------------------------------------------------

/**
 * Plataformas del sub-bloque `social_links` — 1:1 con `SocialPlatformEnum`
 * (genesis). El ícono real (predeterminado por plataforma) vive del lado de
 * ESTE front, no del backend — ver `SOCIAL_PLATFORM_ICONS` en `Colophon.astro`.
 */
export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'x' | 'youtube' | 'tiktok' | 'whatsapp';

export interface ColophonLinkListData {
  items: ContentLink[];
}

export interface ColophonSocialLinksData {
  items: { platform: SocialPlatform; url: string }[];
}

export interface ColophonImageLinkData {
  image: Media | null;
  links: ContentLink[];
}

/**
 * Sub-bloque anidado dentro de `content.columns[].blocks[]` — mismo shape
 * `{type, data}` que un bloque de página normal (`Block`), pero SIN
 * `uuid`/`pretitle`/`title`/`subtitle`/`properties`/`sort_order` propios
 * (no son registros `Block` de la tabla, viven solo dentro del jsonb
 * `content` del bloque `colophon`). `type` es un string ancho (no una unión
 * cerrada) por el mismo motivo que `Block.type` — un tipo de sub-bloque
 * desconocido debe poder pasar sin romper `ColumnBlockRenderer`.
 */
export interface ColophonSubBlock {
  type: string;
  data: ColophonLinkListData | ColophonSocialLinksData | ColophonImageLinkData | Record<string, unknown>;
}

export interface ColophonColumn {
  title: string | null;
  description: string | null;
  blocks: ColophonSubBlock[];
}

export interface ColophonContent {
  columns: ColophonColumn[];
  /** Solo presente cuando `properties.background_type === 'image'` (2026-09-02, ver ADR-041 actualización). */
  background_image?: Media | null;
}

/**
 * Bloque `footer_bottom` — 2 campos opcionales, layout (centrado vs. a los
 * costados) decidido en runtime por `FooterBottom.astro` según cuáles
 * vengan no vacíos (ver `PageResource.php`, comentario del bloque).
 */
/** Ítem de menú ya resuelto (nivel principal únicamente, ver `ResolvesPublicLinks`). */
export interface FooterBottomMenuItem {
  title: string | null;
  href: string | null;
}

export interface FooterBottomMenu {
  name: string;
  items: FooterBottomMenuItem[];
}

/**
 * Bloque `footer_bottom` — rediseño 2026-09-02 (ver genesis ADR-042).
 * `copyright_text`: personalizado, solo presente en planes pagos SIN
 * plantilla forzada — el backend ya fuerza `null` en Free/Freemium (gate
 * de white-label) y también en el plan Auspicio/Convenio (ver
 * `copyright_html`), así que el frontend solo necesita un fallback
 * hardcodeado cuando ambos vengan vacíos.
 *
 * `copyright_html` (2026-09-02, ADR-043, plan Auspicio/Convenio): HTML ya
 * compuesto y sanitizado por el backend (`ResolvesPublicLinks` escapa el
 * fragmento libre del tenant con `e()` antes de envolverlo en la plantilla
 * fija "©[fragmento] - Todos los derechos son reservados <br/> Powered by
 * Stamless") — SOLO presente para tenants en ese plan. Cuando viene, tiene
 * prioridad sobre `copyright_text` (que en ese caso siempre es `null`) y
 * se renderiza como HTML crudo, no como texto — ver `FooterBottom.astro`.
 *
 * Lado derecho (opcional, mutuamente excluyente): `menu` (ya resuelto,
 * nivel principal + `href`) si se eligió "Mostrar menú"; `right_text` si
 * se eligió "Mostrar texto personalizado"; ninguno de los 2 si no se
 * seleccionó nada — en ese caso el div derecho no se renderiza.
 */
export interface FooterBottomContent {
  copyright_text: string | null;
  copyright_html?: string | null;
  right_type?: 'menu' | 'text' | null;
  menu?: FooterBottomMenu | null;
  right_text?: string | null;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export interface ContactFormPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  [key: string]: unknown;
}

export interface ContactFormSuccessData {
  uuid: string;
}
