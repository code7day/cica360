/**
 * Fondo sólido vs. degradado — genérico, no específico de un bloque
 * (2026-09-02, pedido del Tech Lead: "que cualquier sección donde se
 * requiera tenga opción a gradiente"). Consume los mismos 4 campos que
 * `PropertiesSchema` (genesis) agrega a CUALQUIER bloque que los pida
 * explícitamente en su `PropertiesSchema::make([...])`: `background_type`
 * (`solid`/`gradient`), `background_color` (color base, también el color
 * "sólido" si no hay degradado), `background_color_secondary` (segundo
 * color, solo si `background_type === 'gradient'`), `gradient_direction`
 * (1:1 con las clases reales de Tailwind `bg-gradient-to-*`).
 *
 * Primer consumidor: `Colophon.astro`. Cualquier bloque futuro que sume
 * estos 4 campos a su propio `PropertiesSchema::make([...])` puede reusar
 * esta misma función sin tocar nada acá.
 */

export type GradientDirection = 'to-r' | 'to-l' | 'to-t' | 'to-b' | 'to-tr' | 'to-tl' | 'to-br' | 'to-bl';

export interface BackgroundColorProperties {
  background_type?: 'solid' | 'gradient' | null;
  background_color?: string | null;
  background_color_secondary?: string | null;
  gradient_direction?: GradientDirection | null;
}

const GRADIENT_DIRECTION_CSS: Record<GradientDirection, string> = {
  'to-r': 'to right',
  'to-l': 'to left',
  'to-t': 'to top',
  'to-b': 'to bottom',
  'to-tr': 'to top right',
  'to-tl': 'to top left',
  'to-br': 'to bottom right',
  'to-bl': 'to bottom left',
};

/**
 * Devuelve una declaración CSS lista para un `style` inline (termina en
 * `;`), o `''` si no hay ningún color base configurado (nada que pintar —
 * el bloque cae al fondo transparente/heredado por defecto).
 *
 * Degradado solo si `background_type === 'gradient'` Y hay un color
 * secundario cargado — sin el segundo color, cae a sólido (nunca un
 * degradado con un solo extremo, que visualmente sería indistinguible de
 * un color plano pero rompería si alguien espera 2 colores).
 */
export function resolveBackgroundStyle(properties: BackgroundColorProperties | null | undefined): string {
  const base = properties?.background_color;
  if (!base) {
    return '';
  }

  if (properties?.background_type === 'gradient' && properties.background_color_secondary) {
    const direction = GRADIENT_DIRECTION_CSS[properties.gradient_direction ?? 'to-r'];

    return `background-image: linear-gradient(${direction}, ${base}, ${properties.background_color_secondary});`;
  }

  return `background-color: ${base};`;
}
