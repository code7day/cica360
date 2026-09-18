import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { detectVisitorCountry, submitContactForm } from '../../lib/api';
import type { ContactFormPayload, FormData as ContactFormRecord, FormFieldData, ThankYouTemplate } from '../../lib/types';

/**
 * Única isla de cliente real de este proyecto (junto con, eventualmente,
 * el slider del hero). Envía vía `submitContactForm()` (src/lib/api.ts),
 * que pega contra `PUBLIC_CONTACT_FORM_ENDPOINT` — el proxy PHP por
 * defecto, nunca contra el API con el token de content:read (ver ADR-002).
 *
 * 2026-09-11 (pedido del Tech Lead, con captura de mockup real de
 * "Contactame"): "quiero que se genere el formulario basico y que envie al
 * endpoint correcto". Antes: stub de 4 campos (name/email/phone/message).
 * Ahora, mismos 7 campos del mockup — Nombre y Apellido/Correo
 * electrónico/Ciudad/WhatsApp/País/Área de interés/Consulta — layout de 2
 * columnas + botón pill dorado "CONTACTAME AHORA" con ícono de avión de
 * papel (`ph:paper-plane-tilt`, mismo ícono que ya usa el CTA de la topbar/
 * `Cta.astro`). El endpoint de envío NO cambió — sigue siendo
 * `submitContactForm()` → `PUBLIC_CONTACT_FORM_ENDPOINT` (proxy
 * `contacto.php` por defecto) → `POST /v1/{tenant}/forms/contacto/submit`.
 *
 * 2026-09-11..2026-09-12: varias pasadas de UX puntual (selects sin flecha
 * nativa, foco suave, sombra del botón, radio de borde, orden de campos,
 * sanitización en vivo de nombre/correo/consulta, WhatsApp con selector de
 * país + autoformato, validación de formato en `onBlur`/submit) y ADR-004
 * (preselección de país por IP vía `detectVisitorCountry()`). El detalle
 * completo de CADA una de esas vueltas quedó documentado en el historial de
 * git de este archivo — se resume acá para no perder el rastro, pero el
 * texto extendido (con las citas textuales del Tech Lead) ya no aplica
 * 1:1 al código de abajo desde la reescritura de Fase 2 (ver el bloque
 * siguiente): quedó reemplazado por lógica GENÉRICA por tipo de campo, no
 * por 7 campos hardcodeados. La intención de UX de cada una de esas vueltas
 * (foco suave, flecha propia del select, sanitización en vivo, WhatsApp con
 * bandera+código país, preselección por IP) SÍ se preserva, solo que ahora
 * aplicada dinámicamente.
 *
 * 2026-09-18, Fase 2 del plan de formularios (ADR-073 en genesis —
 * reescritura completa, pedido en vivo del Tech Lead: "no se ha integrado
 * el formulario, acabo de desactivar 2 campos en el admin [y el público
 * sigue mostrando los 7 de siempre]"). Hasta acá este componente tenía
 * CERO props y 7 campos 100% hardcodeados (`COUNTRY_OPTIONS`/
 * `AREA_OF_INTEREST_OPTIONS` copiados a mano del seeder, sin fetch
 * dinámico) — desactivar o reordenar un campo en Studio no tenía ningún
 * efecto en el sitio público, exactamente el bug reportado. Ahora:
 * - Recibe `form: FormData` (ya resuelto en build time por
 *   `ContactFormBlock.astro` vía `getForm(content.form_slug)`, ver ese
 *   archivo) y renderiza `form.fields` (ya vienen `is_active=true` y
 *   ordenados por `sort_order` desde el propio API — ver
 *   `FormController::show()` en genesis) — un campo desactivado en Studio
 *   directamente no llega acá, no hace falta filtrarlo de nuevo.
 * - Cada campo se renderiza según `FormFieldData.type` (switch sobre los
 *   11 valores de `FormFieldTypeEnum` — ver `renderField()` más abajo),
 *   NINGÚN campo queda hardcodeado por nombre salvo 2 convenciones
 *   puntuales, documentadas donde se usan: (a) el selector de país
 *   EMBEBIDO de cualquier campo `tel_country` (bandera+código de llamada,
 *   la UX de WhatsApp que motivó agregar ese tipo al catálogo, ver
 *   `FormFieldTypeEnum::TelCountry`) es un catálogo de UI puramente
 *   decorativo (`COUNTRY_OPTIONS`/`DIAL_CODES`), no depende de ningún otro
 *   campo del form; (b) la preselección por IP del `select`/`radio` de
 *   "País" de negocio, si el form define uno, matchea por NOMBRE
 *   (`country`/`pais`/`país`, ver `isCountryFieldName()`) — una
 *   convención razonable, no una garantía del esquema.
 * - `validateFieldValue()` reconstruye la validación de FORMATO leyendo
 *   `FormFieldData.validation_rules` (mismas reglas `min:`/`max:`/`regex:`
 *   que ya expone el API, sembradas en
 *   `Cliente0ContentSeeder::upsertContactForm()` y aplicadas de verdad del
 *   lado servidor en `ContactSubmissionService::rulesForField()`) en vez
 *   de reglas hardcodeadas por nombre de campo — si el Tech Lead cambia una
 *   regla en Studio, el cliente la sigue automáticamente. Los patrones
 *   `regex:/.../flags` de este proyecto ya estaban escritos en sintaxis
 *   compatible con PCRE y con el motor de regex de JS (`\p{L}` con flag
 *   `u`), así que se reutilizan tal cual vía `new RegExp()` — si algún
 *   patrón NO fuera portable, se ignora en silencio del lado cliente (el
 *   backend lo sigue aplicando igual, la autoridad real nunca fue el
 *   cliente, ver docblock de `validateFieldValue()`).
 * - El payload que viaja a `submitContactForm()` se arma dinámicamente
 *   como `{ [field.name]: valor }` — antes eran 7 propiedades fijas de
 *   `ContactFormState`. Sigue pasando por el mismo proxy/endpoint de
 *   siempre (`ContactFormPayload` en `src/lib/types.ts` no se tocó: sigue
 *   describiendo el shape "típico" de CICA360 para otros consumidores, acá
 *   se castea porque el shape real ahora es 100% dinámico).
 */

interface Props {
  form: ContactFormRecord;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

/** Valor colectado por campo, indexado por `FormFieldData.name`. */
type FieldValue = string | boolean | string[];

// ---------------------------------------------------------------------------
// Catálogo de país/código de llamada — SOLO para el selector embebido de
// cualquier campo tipo `tel_country` (bandera + "+código"), UX heredada de
// la 2da vuelta del 2026-09-12 ("armar el numero whatsapp... poniendo una
// banderita con el codigo pais"). Es un catálogo de UI puramente decorativo,
// desacoplado de las `options` reales de cualquier `select` de "País" de
// negocio que el form pueda definir (ver docblock de arriba, punto (a)).
// ---------------------------------------------------------------------------
const COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'AR', label: 'Argentina' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'BR', label: 'Brasil' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'CL', label: 'Chile' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Perú' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'CO', label: 'Colombia' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'PA', label: 'Panamá' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'HN', label: 'Honduras' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'GT', label: 'Guatemala' },
];

const DIAL_CODES: Record<string, string> = {
  AR: '54',
  UY: '598',
  BR: '55',
  BO: '591',
  CL: '56',
  PY: '595',
  PE: '51',
  EC: '593',
  CO: '57',
  VE: '58',
  PA: '507',
  CR: '506',
  NI: '505',
  HN: '504',
  SV: '503',
  GT: '502',
};

function dialCodeFor(countryIso2: string): string {
  return DIAL_CODES[countryIso2] ?? '';
}

/** Emoji de bandera a partir de un ISO 3166-1 alpha-2 (ej. "PE" → 🇵🇪) — ver "Regional Indicator Symbols" Unicode. */
function countryFlagEmoji(countryIso2: string): string {
  return countryIso2
    .toUpperCase()
    .replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

/** Dígitos del número LOCAL (sin código de país) — "grupos de 3, máximo 2 espacios" (2026-09-12) = 3 grupos de 3 = 9 dígitos. */
const PHONE_LOCAL_DIGITS = 9;

/** Descarta cualquier caracter que no sea dígito y trunca a `PHONE_LOCAL_DIGITS`. */
function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_LOCAL_DIGITS);
}

/** Agrupa de a 3 dígitos separados por espacio, puramente visual — el valor real nunca tiene espacios. */
function formatPhoneDigits(digits: string): string {
  return digits.match(/.{1,3}/g)?.join(' ') ?? '';
}

/** Convención de nombre para el `select`/`radio` de "País" de negocio (preselección por IP, punto (b) del docblock de arriba). */
function isCountryFieldName(name: string): boolean {
  return ['country', 'pais', 'país'].includes(name.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Validación de FORMATO — genérica por `FormFieldTypeEnum` + reglas propias
// de cada `FormField` (`validation_rules`, ver docblock de arriba). Nunca es
// la autoridad real: el backend (`ContactSubmissionService::rulesForField()`)
// vuelve a validar todo desde cero sin confiar en que el cliente haya
// corrido este mismo código — esto es earning UX (feedback instantáneo).
// ---------------------------------------------------------------------------
interface ParsedRules {
  min?: number;
  max?: number;
  patterns: RegExp[];
}

/**
 * Interpreta `FormFieldData.validation_rules` (mismo array de strings estilo
 * Laravel que sembró `Cliente0ContentSeeder::upsertContactForm()`, ej.
 * `["min:3","max:40","regex:/^\\p{L}+(?: \\p{L}+)*$/u"]`) reconociendo 3
 * formas: `min:N`, `max:N` y `regex:/patrón/flags`. Cualquier otra regla
 * Laravel (`in:`, `email:rfc,filter`, etc.) se ignora acá a propósito — ya
 * está cubierta por las reglas BASE por tipo en `validateFieldValue()`, y no
 * todas tienen un equivalente 1:1 útil del lado cliente. Un `regex:` que no
 * sea sintaxis válida de JS (poco probable, ver docblock de arriba) se
 * descarta en silencio con `try/catch` — nunca debe romper el render del
 * formulario por una regla que el cliente no puede interpretar.
 */
function parseValidationRules(rules: string[] | null | undefined): ParsedRules {
  const parsed: ParsedRules = { patterns: [] };

  for (const rule of rules ?? []) {
    if (rule.startsWith('min:')) {
      const value = Number(rule.slice(4));
      if (!Number.isNaN(value)) parsed.min = value;
      continue;
    }

    if (rule.startsWith('max:')) {
      const value = Number(rule.slice(4));
      if (!Number.isNaN(value)) parsed.max = value;
      continue;
    }

    if (rule.startsWith('regex:')) {
      const raw = rule.slice('regex:'.length);
      const lastSlash = raw.lastIndexOf('/');

      if (raw.startsWith('/') && lastSlash > 0) {
        const source = raw.slice(1, lastSlash);
        const flags = raw.slice(lastSlash + 1);

        try {
          parsed.patterns.push(new RegExp(source, flags));
        } catch {
          // Patrón no portable a JS — se ignora del lado cliente, el
          // backend lo sigue aplicando igual (ver docblock de esta función).
        }
      }
    }
  }

  return parsed;
}

/** Tope de largo por defecto cuando `validation_rules` no trae su propio `max:` — mismos defaults que `ContactSubmissionService::rulesForField()`. */
const DEFAULT_MAX_BY_TYPE: Partial<Record<string, number>> = {
  text: 255,
  hidden: 255,
  email: 255,
  tel: 255,
  tel_country: 255,
  textarea: 2000,
};

const EMAIL_PATTERN = /^[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
/** Mismo endurecimiento que la regla base de `FormFieldTypeEnum::Tel`/`TelCountry` en el backend: "+" opcional seguido solo de dígitos. */
const TEL_PATTERN = /^\+?[0-9]{6,20}$/;
/** Aproximación cliente de `App\Rules\NoHtmlTags` (defensa en profundidad contra XSS) — cualquier `<tag>` bien formado. */
const HTML_TAG_PATTERN = /<[^>]*>/;
/** Mismos tipos a los que el backend aplica `NoHtmlTags` en `rulesForField()`. */
const TYPES_REJECTING_HTML = new Set(['text', 'textarea', 'email', 'tel', 'tel_country', 'hidden']);

/**
 * `field.options` en el tipo `FormFieldData` (types.ts) es
 * `Array<{value,label}> | null | undefined` — pero el JSON real que
 * devuelve el API viene de una columna `jsonb` sin más garantía que esa a
 * nivel de tipo TS (compile-time, no runtime). En vivo llegó a aparecer un
 * valor que no es `null`/`undefined` (así que `field.options ?? []` no lo
 * agarra) pero TAMPOCO es un array real — `(field.options ?? []).map(...)`
 * revienta con `TypeError: ... .map is not a function` (visto en
 * producción, campo `radio`). Este helper es el único punto de acceso a
 * `field.options` en todo el componente: `Array.isArray()` es la única
 * garantía real en runtime, cualquier otra cosa (objeto, string, `false`,
 * etc.) se trata como "sin opciones" — nunca crashea el render de TODO el
 * formulario por un dato mal formado de UN campo.
 */
function fieldOptions(field: FormFieldData): Array<{ value: string; label: string }> {
  return Array.isArray(field.options) ? field.options : [];
}

/**
 * Un campo `select`/`radio` sin opciones válidas no tiene nada que ofrecer
 * al visitante — mejor no mostrarlo que mostrar un control roto o vacío que
 * nadie puede completar. Pedido explícito del Tech Lead: "el API deja de
 * compartir esos campos [cuando no vienen bien] y por lo tanto en cica360
 * debería ser sensible si no viene en el json, entonces no mostrar ese
 * campo" — mismo criterio de "fallo silencioso, nunca romper el resto del
 * formulario" que ya usa `ContactFormBlock.astro` para un `form_slug`
 * huérfano.
 */
function fieldIsRenderable(field: FormFieldData): boolean {
  if (field.type === 'select' || field.type === 'radio') {
    return fieldOptions(field).length > 0;
  }
  return true;
}

function validateFieldValue(field: FormFieldData, rawValue: string): string | null {
  const value = rawValue.trim();

  if (field.is_required && !value) {
    return `${field.label} es un campo obligatorio.`;
  }

  if (!value) {
    return null;
  }

  const { min, max, patterns } = parseValidationRules(field.validation_rules);
  const effectiveMax = max ?? DEFAULT_MAX_BY_TYPE[field.type] ?? 255;

  if (value.length > effectiveMax) {
    return `No puede superar los ${effectiveMax} caracteres.`;
  }

  if (min && value.length < min) {
    return `Debe tener al menos ${min} caracteres.`;
  }

  if (field.type === 'email' && !EMAIL_PATTERN.test(value)) {
    return 'Ingresá un correo electrónico válido (ej. nombre@dominio.com).';
  }

  if ((field.type === 'tel' || field.type === 'tel_country') && !TEL_PATTERN.test(value)) {
    return 'Ingresá un número de teléfono válido.';
  }

  if (TYPES_REJECTING_HTML.has(field.type) && HTML_TAG_PATTERN.test(value)) {
    return 'No se permiten etiquetas HTML.';
  }

  for (const pattern of patterns) {
    if (!pattern.test(value)) {
      return 'El formato ingresado no es válido.';
    }
  }

  const optionsForField = fieldOptions(field);
  if ((field.type === 'select' || field.type === 'radio') && optionsForField.length > 0) {
    const allowed = optionsForField.map((option) => option.value);
    if (!allowed.includes(value)) {
      return 'Seleccioná una opción válida.';
    }
  }

  return null;
}

/** Descarta `<`/`>` mientras se tipea (defensa en vivo contra HTML/markup, ver `TYPES_REJECTING_HTML`) y trunca al máximo efectivo del campo. */
function sanitizeTextLike(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, '').slice(0, maxLength);
}

/** Charset típico de una dirección de correo — descarta cualquier otro caracter al tipear. */
function sanitizeEmailChars(value: string, maxLength: number): string {
  return value.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Estilos compartidos — sin cambios respecto de las pasadas de UX previas.
// ---------------------------------------------------------------------------
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-cicaindigo-300 focus:ring-4 focus:ring-cicaindigo-500/15 focus:outline-none';
const selectClass = `${inputClass} cursor-pointer appearance-none pr-10`;
const labelClass = 'mb-2 block text-sm font-semibold text-gray-700';
const requiredMarkClass = 'text-red-500';
const fieldErrorClass = 'mt-1 text-sm text-red-600';
const checkOrRadioClass = 'text-cicaindigo-500 focus:ring-cicaindigo-500/40 size-4';

/** Flecha propia del `<select>` (reemplaza la nativa vía `appearance-none`) — mismo trazo simple ya usado en el resto del sitio. */
function SelectChevron() {
  return (
    <svg
      className="text-cicaindigo-500 pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Estado inicial — construido dinámicamente a partir de `form.fields`, ya
// no hay un `ContactFormState` fijo de 7 propiedades.
// ---------------------------------------------------------------------------
function buildInitialValues(fields: FormFieldData[]): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};

  for (const field of fields) {
    if (field.type === 'checkbox' && fieldOptions(field).length > 0) {
      values[field.name] = [];
    } else if (field.type === 'checkbox') {
      values[field.name] = false;
    } else {
      values[field.name] = '';
    }
  }

  return values;
}

function buildInitialPhoneState(fields: FormFieldData[]): Record<string, { country: string; digits: string }> {
  const state: Record<string, { country: string; digits: string }> = {};

  for (const field of fields) {
    if (field.type === 'tel_country') {
      state[field.name] = { country: COUNTRY_OPTIONS[0]!.value, digits: '' };
    }
  }

  return state;
}

export default function ContactForm({ form }: Props) {
  // `file` explícitamente prohibido server-side (ver `rulesForField()` en
  // genesis, "este endpoint solo acepta JSON") — si algún día alguien lo
  // agrega desde el picker de `FormResource`, acá simplemente no se
  // renderiza, en vez de mandar un campo que el backend va a rechazar
  // siempre. `hidden` tampoco se renderiza: el esquema actual de
  // `FormField` no tiene una columna de "valor por defecto" para un campo
  // oculto, así que hoy no hay ningún dato que mostrar/enviar por ese tipo.
  // `fieldIsRenderable()` descarta además cualquier `select`/`radio` sin
  // opciones válidas (ver docblock de esa función) — pedido explícito del
  // Tech Lead tras un `TypeError: (field.options ?? []).map is not a
  // function` en vivo: si el JSON de un campo puntual no viene con la forma
  // esperada, ese campo se cae del formulario en silencio en vez de romper
  // el render de TODOS los campos. Filtrado ACÁ (no solo al renderizar)
  // para que tampoco entre a `values`/`payload`/validación — un campo que
  // no se muestra no debe intentar validarse ni enviarse.
  const sortedFields = useMemo(
    () =>
      [...form.fields]
        .filter((field) => field.type !== 'file' && field.type !== 'hidden' && fieldIsRenderable(field))
        .sort((a, b) => a.sort_order - b.sort_order),
    [form.fields],
  );

  const fieldByName = useMemo(() => {
    const map: Record<string, FormFieldData> = {};
    for (const field of sortedFields) map[field.name] = field;
    return map;
  }, [sortedFields]);

  const [values, setValues] = useState<Record<string, FieldValue>>(() => buildInitialValues(sortedFields));
  const [phoneState, setPhoneState] = useState<Record<string, { country: string; digits: string }>>(() =>
    buildInitialPhoneState(sortedFields),
  );
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Errores de FORMATO del servidor (por nombre de campo).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // Errores de FORMATO detectados en el cliente (`validateFieldValue()`) —
  // capa separada, se combinan recién al renderizar (`displayError()`).
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  // Honeypot: campo real para bots, oculto visualmente — convención fija
  // del backend (`FormSubmissionController::store()` chequea literalmente
  // la key `honeypot`), no es parte de `form.fields`.
  const [honeypot, setHoneypot] = useState('');
  const [submittedName, setSubmittedName] = useState('');
  const [thankYouData, setThankYouData] = useState<ThankYouTemplate | null>(null);

  const formId = useId();

  // Por-campo: `true` en cuanto el visitante toca a mano el selector de país
  // (embebido de un `tel_country`, o el `select`/`radio` de "País" de
  // negocio) — el auto-detect por IP de abajo nunca debe pisar una
  // elección manual, sea ANTES o DESPUÉS de que resuelva el fetch.
  const countryTouchedRef = useRef<Record<string, boolean>>({});

  /**
   * ADR-004 (2026-09-12): preselecciona por geolocalización de IP (i) el
   * selector embebido de CUALQUIER campo `tel_country` presente, y (ii) el
   * `select`/`radio` de "País" de negocio si el form define uno (ver
   * `isCountryFieldName()`) — generalizado acá desde la versión original
   * (que solo tenía un campo "country" fijo). Si `detectVisitorCountry()`
   * falla o tarda de más, ya resuelve `null` en silencio (ver esa función)
   * y los defaults quedan como estaban.
   */
  useEffect(() => {
    let cancelled = false;

    detectVisitorCountry().then((code) => {
      if (cancelled || !code || !COUNTRY_OPTIONS.some((option) => option.value === code)) {
        return;
      }

      setPhoneState((prev) => {
        let changed = false;
        const next = { ...prev };

        for (const field of sortedFields) {
          if (field.type !== 'tel_country' || countryTouchedRef.current[field.name]) continue;
          if (next[field.name]?.country === code) continue;
          next[field.name] = { country: code, digits: next[field.name]?.digits ?? '' };
          changed = true;
        }

        return changed ? next : prev;
      });

      for (const field of sortedFields) {
        if (field.type !== 'select' && field.type !== 'radio') continue;
        if (!isCountryFieldName(field.name) || countryTouchedRef.current[field.name]) continue;
        if (!fieldOptions(field).some((option) => option.value === code)) continue;

        setValues((prev) => (prev[field.name] === code ? prev : { ...prev, [field.name]: code }));
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateValue(name: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: value }));

    // Si el campo ya tenía un error de cliente mostrado, lo re-evalúa en
    // caliente (no espera al próximo blur) — mismo criterio que la versión
    // hardcodeada anterior.
    setClientErrors((prev) => {
      if (!prev[name]) return prev;
      const field = fieldByName[name];
      const message = field && typeof value === 'string' ? validateFieldValue(field, value) : null;
      return { ...prev, [name]: message ?? '' };
    });
  }

  function handleTextChange(field: FormFieldData, rawValue: string) {
    const { max } = parseValidationRules(field.validation_rules);
    const effectiveMax = max ?? DEFAULT_MAX_BY_TYPE[field.type] ?? 255;

    const sanitized =
      field.type === 'email'
        ? sanitizeEmailChars(rawValue, effectiveMax)
        : field.type === 'number' || field.type === 'date'
          ? rawValue.slice(0, effectiveMax)
          : sanitizeTextLike(rawValue, effectiveMax);

    updateValue(field.name, sanitized);
  }

  function handleSelectChange(field: FormFieldData, value: string) {
    if (isCountryFieldName(field.name)) {
      countryTouchedRef.current[field.name] = true;
    }
    updateValue(field.name, value);
  }

  function handleCheckboxToggle(field: FormFieldData, checked: boolean) {
    updateValue(field.name, checked);
  }

  function handleCheckboxGroupToggle(field: FormFieldData, optionValue: string, checked: boolean) {
    setValues((prev) => {
      const current = Array.isArray(prev[field.name]) ? (prev[field.name] as string[]) : [];
      const next = checked ? [...current, optionValue] : current.filter((value) => value !== optionValue);
      return { ...prev, [field.name]: next };
    });
  }

  /** Sanitiza a puros dígitos (ver `sanitizePhoneDigits`) y recalcula el valor final `+{dialCode}{digits}` que de verdad viaja al API. */
  function handlePhoneDigitsChange(field: FormFieldData, rawValue: string) {
    const digits = sanitizePhoneDigits(rawValue);
    const country = phoneState[field.name]?.country ?? COUNTRY_OPTIONS[0]!.value;

    setPhoneState((prev) => ({ ...prev, [field.name]: { country, digits } }));

    const dialCode = dialCodeFor(country);
    updateValue(field.name, digits ? `+${dialCode}${digits}` : '');
  }

  /** Cambiar el país del selector embebido recalcula `phone` con el MISMO número local ya tipeado pero el código de país nuevo. */
  function handlePhoneCountryChange(field: FormFieldData, countryIso: string) {
    countryTouchedRef.current[field.name] = true;
    const digits = phoneState[field.name]?.digits ?? '';

    setPhoneState((prev) => ({ ...prev, [field.name]: { country: countryIso, digits } }));

    const dialCode = dialCodeFor(countryIso);
    updateValue(field.name, digits ? `+${dialCode}${digits}` : '');
  }

  function handleBlur(field: FormFieldData) {
    if (field.type === 'checkbox') {
      const value = values[field.name];
      const missing = field.is_required && (Array.isArray(value) ? value.length === 0 : !value);
      setClientErrors((prev) => ({ ...prev, [field.name]: missing ? `${field.label} es un campo obligatorio.` : '' }));
      return;
    }

    const raw = typeof values[field.name] === 'string' ? (values[field.name] as string) : '';
    const message = validateFieldValue(field, raw);
    setClientErrors((prev) => ({ ...prev, [field.name]: message ?? '' }));
  }

  /** `fieldErrors` (servidor) tiene prioridad sobre `clientErrors` (cliente) — en la práctica nunca conviven, `clientErrors` se limpia en cada submit nuevo. */
  function displayError(name: string): string | null {
    return fieldErrors[name]?.[0] ?? clientErrors[name] ?? null;
  }

  // React 19.2+ deprecó `FormEvent`/`FormEventHandler` para el evento
  // `submit` en favor de `SubmitEvent` (que sí expone `submitter`).
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (honeypot) {
      // Bot: fingimos éxito sin llamar al API, para no darle feedback útil.
      setStatus('success');
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});

    const nextClientErrors: Record<string, string> = {};

    for (const field of sortedFields) {
      if (field.type === 'checkbox') {
        const value = values[field.name];
        const missing = field.is_required && (Array.isArray(value) ? value.length === 0 : !value);
        if (missing) nextClientErrors[field.name] = `${field.label} es un campo obligatorio.`;
        continue;
      }

      const raw = typeof values[field.name] === 'string' ? (values[field.name] as string) : '';
      const message = validateFieldValue(field, raw);
      if (message) nextClientErrors[field.name] = message;
    }

    setClientErrors(nextClientErrors);

    if (Object.keys(nextClientErrors).length > 0) {
      setStatus('error');
      setErrorMessage('Revisá los campos marcados antes de enviar.');
      return;
    }

    setStatus('submitting');

    // Payload dinámico `{ [field.name]: valor }` — reemplaza al viejo
    // `ContactFormState` fijo de 7 propiedades (ver docblock de este
    // archivo, Fase 2). `ContactFormPayload` (src/lib/types.ts) sigue
    // describiendo el shape "típico" de CICA360 para otros consumidores;
    // acá el shape real es dinámico, de ahí el cast.
    const payload: Record<string, unknown> = {};
    for (const field of sortedFields) {
      payload[field.name] = values[field.name];
    }

    const result = await submitContactForm(payload as unknown as ContactFormPayload);

    if (result.success) {
      const nameField = sortedFields.find((field) => ['name', 'nombre', 'full_name'].includes(field.name));
      const nameValue = nameField && typeof values[nameField.name] === 'string' ? (values[nameField.name] as string).trim() : '';

      setSubmittedName(nameValue);
      if (result.data.thank_you) {
        setThankYouData(result.data.thank_you);
      }
      setStatus('success');
      setValues(buildInitialValues(sortedFields));
      setPhoneState(buildInitialPhoneState(sortedFields));
      countryTouchedRef.current = {};
      return;
    }

    setStatus('error');
    setErrorMessage(result.message);
    setFieldErrors(result.fields ?? {});
  }

  /** Un campo por `FormFieldData.type` — ver docblock de este archivo (Fase 2) para el detalle de qué convenciones NO son 100% genéricas. */
  function renderField(field: FormFieldData) {
    const fieldId = `${formId}-${field.name}`;
    const error = displayError(field.name);
    const requiredMark = field.is_required && <span className={requiredMarkClass}>*</span>;

    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.uuid} className="sm:col-span-2">
            <label htmlFor={fieldId} className={labelClass}>
              {field.label} {requiredMark}
            </label>
            <textarea
              id={fieldId}
              name={field.name}
              rows={5}
              placeholder={field.placeholder ?? undefined}
              aria-invalid={Boolean(error)}
              value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
              onChange={(e) => handleTextChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              className={`${inputClass} resize-y`}
            />
            {field.help_text && !error && <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>}
            {error && <p className={fieldErrorClass}>{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.uuid}>
            <label htmlFor={fieldId} className={labelClass}>
              {field.label} {requiredMark}
            </label>
            <div className="relative">
              <select
                id={fieldId}
                name={field.name}
                aria-invalid={Boolean(error)}
                value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
                onChange={(e) => handleSelectChange(field, e.target.value)}
                onBlur={() => handleBlur(field)}
                className={selectClass}
              >
                <option value="" disabled>
                  {field.placeholder ?? 'Elegí una opción'}
                </option>
                {fieldOptions(field).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
            {error && <p className={fieldErrorClass}>{error}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.uuid} className="sm:col-span-2">
            <span className={labelClass}>
              {field.label} {requiredMark}
            </span>
            <div className="flex flex-col gap-2">
              {fieldOptions(field).map((option) => (
                <label key={option.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={values[field.name] === option.value}
                    onChange={() => handleSelectChange(field, option.value)}
                    onBlur={() => handleBlur(field)}
                    className={checkOrRadioClass}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {error && <p className={fieldErrorClass}>{error}</p>}
          </div>
        );

      case 'checkbox': {
        const checkboxOptions = fieldOptions(field);
        if (checkboxOptions.length > 0) {
          const selected = Array.isArray(values[field.name]) ? (values[field.name] as string[]) : [];

          return (
            <div key={field.uuid} className="sm:col-span-2">
              <span className={labelClass}>
                {field.label} {requiredMark}
              </span>
              <div className="flex flex-col gap-2">
                {checkboxOptions.map((option) => (
                  <label key={option.value} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={selected.includes(option.value)}
                      onChange={(e) => handleCheckboxGroupToggle(field, option.value, e.target.checked)}
                      onBlur={() => handleBlur(field)}
                      className={`${checkOrRadioClass} rounded`}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {error && <p className={fieldErrorClass}>{error}</p>}
            </div>
          );
        }

        return (
          <div key={field.uuid} className="sm:col-span-2 flex items-start gap-2">
            <input
              id={fieldId}
              type="checkbox"
              checked={Boolean(values[field.name])}
              onChange={(e) => handleCheckboxToggle(field, e.target.checked)}
              onBlur={() => handleBlur(field)}
              className={`${checkOrRadioClass} mt-1 rounded`}
            />
            <div>
              <label htmlFor={fieldId} className="text-sm text-gray-700">
                {field.label} {requiredMark}
              </label>
              {error && <p className={fieldErrorClass}>{error}</p>}
            </div>
          </div>
        );
      }

      case 'tel_country': {
        const phone = phoneState[field.name] ?? { country: COUNTRY_OPTIONS[0]!.value, digits: '' };

        return (
          <div key={field.uuid}>
            <label htmlFor={fieldId} className={labelClass}>
              {field.label} {requiredMark}
            </label>
            <div className="flex items-stretch">
              <select
                aria-label={`Código de país para ${field.label}`}
                value={phone.country}
                onChange={(e) => handlePhoneCountryChange(field, e.target.value)}
                className="border-gray-300 bg-gray-50 text-gray-700 h-auto cursor-pointer appearance-none rounded-l-lg border border-r-0 pl-3 pr-6 text-sm"
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {countryFlagEmoji(option.value)} +{dialCodeFor(option.value)}
                  </option>
                ))}
              </select>
              <input
                id={fieldId}
                name={field.name}
                type="text"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder={field.placeholder ?? '987 654 321'}
                maxLength={11}
                aria-invalid={Boolean(error)}
                value={formatPhoneDigits(phone.digits)}
                onChange={(e) => handlePhoneDigitsChange(field, e.target.value)}
                onBlur={() => handleBlur(field)}
                className={`${inputClass} rounded-l-none`}
              />
            </div>
            {error && <p className={fieldErrorClass}>{error}</p>}
          </div>
        );
      }

      case 'number':
      case 'date':
      case 'tel':
      case 'email':
      case 'text':
      default:
        return (
          <div key={field.uuid}>
            <label htmlFor={fieldId} className={labelClass}>
              {field.label} {requiredMark}
            </label>
            <input
              id={fieldId}
              name={field.name}
              type={
                field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : field.type === 'email'
                      ? 'email'
                      : field.type === 'tel'
                        ? 'tel'
                        : 'text'
              }
              placeholder={field.placeholder ?? undefined}
              aria-invalid={Boolean(error)}
              value={typeof values[field.name] === 'string' ? (values[field.name] as string) : ''}
              onChange={(e) => handleTextChange(field, e.target.value)}
              onBlur={() => handleBlur(field)}
              className={inputClass}
            />
            {field.help_text && !error && <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>}
            {error && <p className={fieldErrorClass}>{error}</p>}
          </div>
        );
    }
  }

  if (status === 'success') {
    const firstName = submittedName.split(' ')[0];
    const effectiveTitle = thankYouData?.title ?? (firstName ? `¡Muchas gracias, ${firstName}!` : '¡Muchas gracias por contactarnos!');
    const effectiveAlertTitle = thankYouData?.alert_title ?? 'Tiempo de respuesta estimado:';
    const effectiveAlertDescription = thankYouData?.alert_description ?? 'Menos de 24 horas hábiles (Lunes a Viernes de 9:00 a 18:00).';
    const effectiveButtonLabel = thankYouData?.button_label ?? 'Enviar otra consulta';

    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center rounded-2xl border border-cicagreen-200/80 bg-gradient-to-b from-cicagreen-50/70 via-white to-white p-8 sm:p-12 text-center shadow-lg transition-all"
      >
        {/* Badge circular con icono de verificación */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cicagreen-100 text-cicagreen-600 ring-8 ring-cicagreen-50/90 shadow-sm">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Título de agradecimiento */}
        <h3 className="text-2xl sm:text-3xl font-bold text-cicaindigo-900 tracking-tight">
          {effectiveTitle}
        </h3>

        {/* Mensaje principal (HTML sanitizado con <strong>) */}
        {thankYouData?.description ? (
          <div
            className="mt-2.5 max-w-md text-sm sm:text-base text-gray-600 leading-relaxed [&>p]:m-0 [&>strong]:font-semibold [&>strong]:text-cicaindigo-900"
            dangerouslySetInnerHTML={{ __html: thankYouData.description }}
          />
        ) : (
          <p className="mt-2.5 max-w-md text-sm sm:text-base text-gray-600 leading-relaxed">
            Hemos recibido tu consulta correctamente. Un asesor especializado de{' '}
            <span className="font-semibold text-cicaindigo-900">CICA360</span> revisará tu información y se pondrá en contacto contigo a la brevedad.
          </p>
        )}

        {/* Caja de expectativas y tiempos de respuesta */}
        {(effectiveAlertTitle || effectiveAlertDescription) && (
          <div className="mt-6 w-full max-w-md rounded-xl border border-gray-100 bg-gray-50/90 p-4 text-left text-sm text-gray-600 shadow-xs">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-cicagreen-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                {effectiveAlertTitle && <span className="font-medium text-gray-900">{effectiveAlertTitle}</span>}
                {effectiveAlertDescription && <p className="text-xs text-gray-500 mt-0.5">{effectiveAlertDescription}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Botón para enviar otra consulta */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setSubmittedName('');
              setThankYouData(null);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 hover:text-cicaindigo-900 hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-cicaindigo-500/15 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {effectiveButtonLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Honeypot — oculto para personas, visible para bots que autocompletan todo. Convención fija del backend (key `honeypot`), no es un `FormField`. */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor={`${formId}-website`}>No completar este campo</label>
        <input
          id={`${formId}-website`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Grid de 2 columnas — los campos `textarea`/`radio`/checkbox-múltiple
          fuerzan `sm:col-span-2` (ver `renderField()`) para no quedar
          apretados en media columna. El ORDEN real es `field.sort_order`
          (`sortedFields`), definido en Studio — ya no un orden fijo en JSX. */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
        {sortedFields.map((field) => renderField(field))}
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="border-cicagold-500 bg-cicagold-500 text-cicaindigo-500 hover:bg-cicagold-600 hover:text-cicaindigo-900 mx-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border px-8 py-3 text-sm font-bold tracking-[0.1em] uppercase shadow-xl transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Enviando…' : 'Contactame ahora'}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="20" height="20" fill="none" aria-hidden="true">
          <path
            d="M9.91337 12.0877C9.72226 11.897 9.49449 11.7469 9.24381 11.6465L1.31381 8.4665C1.21912 8.42851 1.13833 8.36246 1.08226 8.27722C1.0262 8.19199 0.997552 8.09164 1.00016 7.98966C1.00278 7.88767 1.03652 7.78892 1.09688 7.70667C1.15723 7.62442 1.2413 7.56259 1.33781 7.5295L20.3378 1.0295C20.4264 0.997494 20.5223 0.991386 20.6143 1.01189C20.7062 1.03239 20.7904 1.07866 20.857 1.14528C20.9236 1.21189 20.9699 1.2961 20.9904 1.38805C21.0109 1.48 21.0048 1.57589 20.9728 1.6645L14.4728 20.6645C14.4397 20.761 14.3779 20.8451 14.2956 20.9054C14.2134 20.9658 14.1146 20.9995 14.0126 21.0021C13.9107 21.0048 13.8103 20.9761 13.7251 20.92C13.6398 20.864 13.5738 20.7832 13.5358 20.6885L10.3558 12.7565C10.255 12.506 10.1045 12.2785 9.91337 12.0877ZM9.91337 12.0877L20.8538 1.1495"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
