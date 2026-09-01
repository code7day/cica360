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

export interface ContentLink {
  type: string;
  label: string | null;
  source_type: LinkSourceType;
  source_slug: string | null;
  href: string | null;
  target: LinkTarget;
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
  | 'services_grid';

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
// Menus
// ---------------------------------------------------------------------------

export type MenuItemType = 'page' | 'post' | 'external' | 'custom';

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
