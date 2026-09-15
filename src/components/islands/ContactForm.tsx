import { useEffect, useId, useRef, useState } from 'react';
import type React from 'react';
import { detectVisitorCountry, submitContactForm } from '../../lib/api';

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
 * `contacto.php` por defecto) → `POST /v1/{tenant}/forms/contacto/submit` —
 * ese proxy reenvía el payload TAL CUAL, así que alcanza con que las keys
 * de `form` acá calcen con los `FormField.name` sembrados del lado de
 * genesis (`Cliente0ContentSeeder::upsertContactForm()`) para que el
 * backend los valide/persista — si se agrega un campo nuevo, hay que
 * sembrarlo ahí primero.
 *
 * `COUNTRY_OPTIONS`/`AREA_OF_INTEREST_OPTIONS` duplican a mano las mismas
 * listas ya sembradas como `FormField.options` en genesis (sin fetch
 * dinámico — alcance "formulario básico" explícito del pedido, este
 * componente no lee `block.content` todavía). Si el catálogo de países o
 * de servicios cambia, actualizar ambos lados.
 *
 * 2026-09-11, pasada de UX (2da vuelta, mismo día): "falta UX en ese
 * formulario de contactos, corregir y alinear a los otros acabados" +
 * "agrandar el icono del boton submit... deberia ser de tamaño 18px o
 * 20px". Cambios: (1) los `<select>` nativos tenían la flecha default del
 * navegador (inconsistente entre Chrome/Safari/Firefox, y visualmente
 * distinta a los `<input>` de texto vecinos) — se ocultan con
 * `appearance-none` y se agrega una flecha propia (`<SelectChevron>`, SVG
 * inline con el mismo trazo simple que el resto de íconos del sitio, no
 * depende de `astro-icon` porque este archivo es una isla React, no
 * `.astro`); (2) foco de inputs pasa de `ring-1 ring-cicaindigo-500` (borde
 * duro) a `ring-4 ring-cicaindigo-500/15` (halo suave), mismo criterio de
 * "acabado" que usa el resto del sitio para estados interactivos (colores
 * de marca, nunca grises genéricos de Tailwind sin cruzar con la paleta);
 * (3) placeholders agregados a Nombre/Correo/Ciudad/WhatsApp (antes solo
 * "Consulta" los tenía); (4) caja de éxito pasa de verde genérico de
 * Tailwind a `cicagreen-*` (la familia real de marca, ya usada en
 * `Testimonials.astro`); (5) ícono del botón de envío de 16px a 20px.
 *
 * 2026-09-11, pasada de UX (3ra vuelta, mismo día — captura del render en
 * vivo vs. captura de "la espectativa"): "observa el acabado de los inputs
 * y del boton, creo que no estan bien configurados o no estan estilados".
 * Comparado contra el resto de CTAs pill dorados del sitio (`Hero.astro`,
 * mismo texto tipo "CONTACTAME AHORA"): a este botón le faltaba por
 * completo `shadow-xl` — se veía "plano" al lado de cualquier otro CTA
 * grande del sitio, que sí lleva sombra. Se suma esa clase; color se
 * mantiene (ya coincidía con el resto). De paso, borde de los inputs de
 * `gray-200` a `gray-300` (un toque más definido, mismo criterio "no bien
 * configurado" del pedido). Ícono del botón reemplazado por el SVG real
 * que el Tech Lead usa en Figma para esta pieza (compartido tal cual) — el
 * anterior era una aproximación dibujada a mano de un avión de papel,
 * distinta de la real del diseño; ver el ícono en sí más abajo, junto al
 * `<button>`, para el detalle de por qué usa `stroke="currentColor"` en
 * vez del color fijo del SVG original de Figma.
 *
 * 2026-09-11, pasada de UX (4ta vuelta, sobre captura del resultado):
 * "sale redondeado a full y no es asi la espectativa" — la 3ra vuelta de
 * arriba sumó `shadow-xl` pero dejó pasar por alto que el radio de borde
 * seguía en `rounded-full` (pill completo), mientras que el CTA de
 * referencia real del sitio (`Hero.astro`, mismo botón tipo "CONTACTAME
 * AHORA") usa `rounded-lg` — esquinas redondeadas, no un pill. Fix:
 * `rounded-full` → `rounded-lg`, calzando con ese CTA de referencia.
 *
 * 2026-09-12 (pedido del Tech Lead: "añadimos ... seguridad y validacion en
 * el formulario de la pagina, ... validar bien los campos que sean
 * coherentes y congruentes al dato y tipo de dato" + reordenar campos +
 * reglas puntuales de nombre/correo/ciudad). Cambios:
 * (1) **Orden de campos**: "nombre, correo, pais, whatsapp, cuidad, area
 *     interes, caja de consulta" — reemplaza el orden anterior (Ciudad
 *     antes de WhatsApp/País). Mismo cambio reflejado del lado genesis
 *     (`Cliente0ContentSeeder::upsertContactForm()`, `sort_order` de cada
 *     `FormField`), aunque acá el orden real es el de este JSX, no el que
 *     devuelva el API (este componente no lee `block.content` todavía, ver
 *     docblock de arriba).
 * (2) **Sanitización EN VIVO al tipear** (`sanitizeLetters()`/
 *     `sanitizeEmailChars()`, justo debajo): nombre/ciudad descartan
 *     cualquier caracter que no sea letra Unicode o espacio, colapsan
 *     espacios dobles a uno solo, y no dejan empezar con espacio (el
 *     espacio FINAL sí se permite mientras se escribe la próxima palabra —
 *     se recorta recién en `validateField()`); correo descarta cualquier
 *     caracter fuera de `[a-zA-Z0-9@._+-]`. Los 2 truncan a su `maxLength`
 *     real. Esto es la mitad "impedir la digitación" del pedido — la otra
 *     mitad es el mensaje de error si igual el valor no cierra (formato
 *     incompleto, longitud, etc.), ver (3). WhatsApp tiene su PROPIO
 *     mecanismo de sanitización/formato, completamente rediseñado en la
 *     2da vuelta de este mismo día — ver ese bloque del docblock, más
 *     abajo, no reutiliza `sanitizeLetters()`/`sanitizeEmailChars()`.
 * (3) **Validación de FORMATO en `validateField()`** (no solo
 *     `required`/`type` nativos de HTML, que este form desactiva con
 *     `noValidate`): mismas reglas exactas que ahora aplica el backend
 *     (`ContactSubmissionService::rulesForField()` + `validation_rules` de
 *     cada `FormField` en genesis) — nombre/ciudad 3-40 caracteres, solo
 *     letras + un espacio entre palabras; correo con TLD estándar;
 *     WhatsApp con el mismo charset que ya impide tipear caracteres fuera
 *     de rango. Se corre en 2 momentos: `onBlur` (feedback inmediato campo
 *     por campo) y de nuevo completo en `handleSubmit` ANTES de llamar al
 *     API — si hay algún error, el submit se corta ahí mismo (mismo
 *     `fieldErrorClass` que ya se usaba para errores del servidor, ahora
 *     también para errores de cliente, mergeados en `displayError()`).
 *     Duplicar la validación en el cliente es earning UX (feedback
 *     instantáneo, sin esperar un round-trip), NUNCA la autoridad real —
 *     esa sigue siendo 100% del backend (ver ADR de esta fecha en
 *     `genesis/docs/context/DECISIONS.md`), que valida de nuevo TODO desde
 *     cero sin confiar en que el cliente haya corrido este mismo código.
 *
 * 2026-09-12 (2da vuelta, mismo día — pedido de UX puntual sobre WhatsApp):
 * "que al elegir el pais, tambien se pueda armar el numero whatsapp
 * requerido, poniendo una banderita con el codigo pais (+51, +54, +1, etc)
 * antes del numero whatsapp para solo permitir numeros, espacios solo 2
 * permitiendo que se formen grupos de 3 (autocompletado) ... no debe
 * permitir digitar letras u otro caractere que no sea numeros ... pero al
 * final se envia concatenado el codigo pais y el numero". Cambios:
 * - `DIAL_CODES`: código de llamada (sin el "+") por cada `COUNTRY_OPTIONS`
 *   — mantener sincronizado si se agrega un país nuevo arriba.
 * - `countryFlagEmoji()`: convierte el ISO-2 de `form.country` a su emoji
 *   de bandera (par de "Regional Indicator Symbols" Unicode) — sin
 *   necesidad de un asset de imagen por país (a diferencia del catálogo de
 *   Servicios en genesis, que sí tiene banderas reales en `public/flags/`
 *   pero solo para 8 de los 16 países de ESTE select, ver comentario de
 *   `COUNTRY_OPTIONS` más abajo).
 * - El campo WhatsApp deja de ser un único `<input>` libre: ahora es un
 *   grupo (badge de bandera+código de país, sin poder editarse a mano, +
 *   `<input>` solo para el número local). El estado del número LOCAL vive
 *   aparte (`phoneDigits`, dígitos puros, sin espacios ni código de país);
 *   `form.phone` (lo que realmente viaja a `submitContactForm()`) siempre
 *   es la concatenación YA armada `+{dialCode}{phoneDigits}` — se
 *   recalcula tanto al tipear el número (`handlePhoneChange`) como al
 *   cambiar de país (`handleCountryChange`, mismo número local, nuevo
 *   código de país).
 * - `formatPhoneDigits()`: agrupa de a 3 dígitos con un espacio entre
 *   grupos, puramente visual — el valor real (`phoneDigits`) nunca tiene
 *   espacios. Tope de 9 dígitos locales (3 grupos de 3 = "solo 2 espacios",
 *   tal como se pidió).
 * - `type="text"` (no `type="tel"`) a propósito, tal como lo pidió el Tech
 *   Lead — la restricción a solo dígitos la hace el propio
 *   `handlePhoneChange` (cualquier tecla que no sea 0-9 nunca llega a
 *   pisar el estado), no el navegador. `inputMode="numeric"` es solo un
 *   hint para que el teclado táctil en mobile arranque en modo numérico,
 *   no cambia la validación ni el tipo real del input.
 * - Formato final enviado a la API (`+{dialCode}{digits}`, ej.
 *   "+51987654321", sin espacios/guiones/paréntesis) obligó a EN-DURECER
 *   `PHONE_PATTERN` (antes toleraba espacios/guiones/paréntesis porque el
 *   usuario los tipeaba directo) — ahora exige "+" opcional seguido SOLO
 *   de dígitos, para calzar con el mismo endurecimiento del lado genesis
 *   (`ContactSubmissionService::rulesForField()`, ver PROGRESS.md de ese
 *   repo, mismo día).
 *
 * 2026-09-12 (3ra vuelta, mismo día): "la valicacion en campo de consulta,
 * ese textarea debe tener una validacion coherente al tipo de info que
 * recibirá, nada de html, solo texto, signos de puntuacion o cualquier otro
 * pero solo texto plano". Se agrega `MESSAGE_PATTERN` (allow-list de letras/
 * dígitos/espacios/puntuación común, sin `< > { } [ ] \ \` ~ ^ |`) +
 * `sanitizeMessageChars()` (descarta en vivo, mismo criterio que
 * `sanitizeLetters()`/`sanitizeEmailChars()` de arriba) + chequeo en
 * `validateField()`. Mismo pattern sembrado como `validation_rules` de este
 * campo en `Cliente0ContentSeeder::upsertContactForm()` (lado genesis) —
 * esta es, de nuevo, solo la mitad de UX; la autoridad real sigue siendo
 * 100% del backend (`ContactSubmissionService::rulesForField()` +
 * `NoHtmlTags`, que ya corrían para cualquier campo tipo Textarea desde la
 * 1ra vuelta de este mismo día).
 *
 * 2026-09-12 (4ta vuelta, mismo día — ADR-004): "donde se podria usar el
 * iso country_code ... para poder preseleccionar por default el pais al
 * cargar la pagina, asi se ayuda, por usabilidad". Al montar, un
 * `useEffect` llama a `detectVisitorCountry()` (`src/lib/api.ts`, que pega
 * contra el proxy PHP `ipinfo.php` — el token de ipinfo.io nunca puede
 * viajar al bundle del cliente en un sitio 100% estático) y, si devuelve un
 * país presente en `COUNTRY_OPTIONS`, lo preselecciona. `countryTouchedRef`
 * evita que esto pise una elección manual del visitante, sea ANTES o
 * DESPUÉS de que la consulta resuelva. El pedido también mencionaba "de
 * paso enviamos al api el IP para seguimiento" — genesis YA captura
 * `$request->ip()` en cada submit (`FormSubmissionController`/
 * `Contact::ip_address`), pero como este form pasa por el proxy
 * `contacto.php` (server-to-server), sin un fix ahí genesis vería la IP
 * del hosting de CICA360, no la del visitante — ver el fix de
 * `X-Forwarded-For` en `public/contacto.php`, mismo día, y el ADR-004 para
 * el detalle completo de ambos lados.
 */

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Estado local del form: a diferencia de `ContactFormPayload`, acá todos
 * los campos son siempre string (controlled input), incluso los
 * opcionales. El índice explícito es necesario para que TS acepte pasar
 * este objeto directo a `submitContactForm()`, cuyo parámetro
 * (`ContactFormPayload`) tiene su propio índice — sin esto, tsc tira
 * ts(2345) "Index signature ... is missing" (mismo tipo de error que en
 * src/lib/api.ts::qs()).
 */
interface ContactFormState {
  name: string;
  email: string;
  city: string;
  phone: string;
  country: string;
  area_of_interest: string;
  message: string;
  [key: string]: string;
}

/**
 * 2026-09-11, ampliado el mismo día: "aumentar mas paises del continente
 * latinoamericano centro-sur". Los primeros 8 tienen bandera real
 * sembrada para el catálogo de Servicios (`public/flags/`) — pero ESTE
 * select es texto plano, sin ícono, así que sumar países acá no depende
 * de tener un asset de bandera nuevo. Completa Centro y Sudamérica
 * hispanohablante (sin México/Norteamérica, sin Caribe, sin Guyana/
 * Surinam/Belice — no pedidos). "Argentina" primero, mismo default
 * visible que el mockup. Mantener sincronizado con `$countryOptions` en
 * `Cliente0ContentSeeder::upsertContactForm()` (genesis) si esta lista
 * cambia.
 */
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

/**
 * Código de llamada internacional (sin el "+") por cada país de
 * `COUNTRY_OPTIONS` de arriba — 2026-09-12, pedido del Tech Lead: "el +51
 * para peru, +54 para argentina, y asi que muestre el codigo pais de
 * llamada". Mantener sincronizado con `COUNTRY_OPTIONS` si se agrega un
 * país nuevo ahí (si falta una entrada acá, `dialCodeFor()` devuelve `''`
 * — el badge queda como "+" solo, visible pero sin romper nada).
 */
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

/**
 * Emoji de bandera a partir de un código ISO 3166-1 alpha-2 (ej. "PE" →
 * 🇵🇪) — cada letra se mapea a su "Regional Indicator Symbol" Unicode
 * (`A` = U+1F1E6, offset fijo de 127397 sobre el código ASCII de la
 * letra). No depende de ningún asset de imagen (a diferencia de las
 * banderas reales del catálogo de Servicios en genesis, `public/flags/`,
 * que además solo cubren 8 de los 16 países de este `<select>`) — funciona
 * automáticamente para cualquier país que se agregue a `COUNTRY_OPTIONS`
 * en el futuro, sin necesidad de sumar un asset nuevo.
 */
function countryFlagEmoji(countryIso2: string): string {
  return countryIso2
    .toUpperCase()
    .replace(/./g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

/** Mismos 9 títulos reales del catálogo de Servicios (`Cliente0ServicesSeeder`, mismo orden) — ver docblock de arriba. */
const AREA_OF_INTEREST_OPTIONS: string[] = [
  'Seguridad Financiera',
  'Seguro Financiero',
  'Asesoría y Consultoría Estratégica',
  'Asesoría Contable y Financiera',
  'Asesoría Editorial Integral',
  'Turismo y Asesoría Vacacional',
  'Bienes Raíces e Inversión',
  'Asesoramiento Legal Integral',
  'Asesoría Notarial',
];

const initialForm: ContactFormState = {
  name: '',
  email: '',
  city: '',
  phone: '',
  country: COUNTRY_OPTIONS[0]!.value,
  area_of_interest: '',
  message: '',
};

/**
 * Reglas de formato (2026-09-12) — MISMOS patterns que
 * `genesis/database/seeders/Cliente0ContentSeeder.php::upsertContactForm()`
 * siembra en `FormField.validation_rules` para este form puntual, y que
 * `ContactSubmissionService::rulesForField()` aplica del lado del API.
 * Repetidos acá a propósito (no hay forma de compartir código entre un
 * repo PHP y uno TypeScript en este proyecto) — si el Tech Lead cambia una
 * de estas reglas, hay que actualizar AMBOS lados o el cliente y el
 * servidor van a discrepar en qué es "válido".
 */
const LETTERS_PATTERN = /^\p{L}+(?: \p{L}+)*$/u;
const EMAIL_PATTERN = /^[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
/**
 * 2026-09-12 (2da vuelta): el valor real de `phone` deja de ser lo que el
 * usuario tipea directo (podía traer espacios/guiones/paréntesis) — ahora
 * es SIEMPRE la concatenación armada por el propio componente
 * (`+{dialCode}{phoneDigits}`, ver `handlePhoneChange`/`handleCountryChange`
 * más abajo), así que el pattern se endurece a "+" opcional seguido SOLO
 * de dígitos — mismo endurecimiento en paralelo del lado genesis
 * (`ContactSubmissionService::rulesForField()`).
 */
const PHONE_PATTERN = /^\+?[0-9]{6,20}$/;
/**
 * 2026-09-12 (3ra vuelta): "esa textarea debe tener una validacion coherente
 * al tipo de info que recibirá, nada de html, solo texto, signos de
 * puntuacion o cualquier otro pero solo texto plano". Allow-list (letras
 * Unicode + dígitos + espacios/saltos de línea + puntuación común en
 * español), deliberadamente SIN `< > { } [ ] \ \` ~ ^ |` — los caracteres
 * típicos de HTML/markup/código. Mismo pattern que
 * `Cliente0ContentSeeder::upsertContactForm()` siembra como
 * `validation_rules` de este campo del lado genesis.
 */
const MESSAGE_PATTERN = /^[\p{L}\p{N}\s.,;:!?'"()\-_¿¡%/@#&*+=$°]*$/u;

const NAME_MAX_LENGTH = 40;
const CITY_MAX_LENGTH = 40;
const EMAIL_MAX_LENGTH = 255;
/** Dígitos del número LOCAL (sin código de país) — "espacios solo 2 permitiendo que se formen grupos de 3" = 3 grupos de 3 = 9 dígitos. */
const PHONE_LOCAL_DIGITS = 9;
const MESSAGE_MAX_LENGTH = 2000;

/**
 * Filtra, mientras se tipea, cualquier caracter que no sea letra Unicode
 * (cubre acentos/ñ/ç sin listarlos a mano) o espacio — "impedir la
 * digitación de caracteres restringidos" del pedido. Colapsa 2+ espacios
 * seguidos a uno solo y no deja EMPEZAR con espacio; el espacio final
 * (mientras se sigue escribiendo la próxima palabra) sí se deja pasar acá,
 * `validateField()` es quien exige que no quede un espacio colgado al
 * momento de validar/enviar.
 */
function sanitizeLetters(value: string, maxLength: number): string {
  return value
    .replace(/[^\p{L} ]/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ /, '')
    .slice(0, maxLength);
}

/** Charset típico de una dirección de correo — descarta cualquier otro caracter al tipear (espacios incluidos). */
function sanitizeEmailChars(value: string): string {
  return value.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, EMAIL_MAX_LENGTH);
}

/** Descarta cualquier caracter que no sea dígito (letras, espacios, "+", etc. tipeados a mano nunca llegan a pisar el estado) y trunca a `PHONE_LOCAL_DIGITS`. */
function sanitizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_LOCAL_DIGITS);
}

/** Agrupa de a 3 dígitos separados por espacio, puramente visual (ej. "987654321" → "987 654 321") — el valor real (`phoneDigits`) nunca tiene espacios. */
function formatPhoneDigits(digits: string): string {
  return digits.match(/.{1,3}/g)?.join(' ') ?? '';
}

/**
 * Filtra, mientras se tipea, cualquier caracter fuera de `MESSAGE_PATTERN`
 * (letras/dígitos/espacios incl. saltos de línea/puntuación común) —
 * descarta en particular `< > { } [ ] \ \` ~ ^ |`, que es lo que se pidió
 * excluir ("nada de html"). No usa una sola regex de reemplazo global
 * porque `MESSAGE_PATTERN` es de anclas completas (`^...$`), así que se
 * filtra caracter por caracter.
 */
function sanitizeMessageChars(value: string): string {
  return Array.from(value)
    .filter((char) => MESSAGE_PATTERN.test(char))
    .join('')
    .slice(0, MESSAGE_MAX_LENGTH);
}

/**
 * Validación de FORMATO por campo (además de la sanitización en vivo de
 * arriba, que ya impide la mayoría de caracteres inválidos): cubre lo que
 * el usuario puede seguir escribiendo mal aunque el charset esté bien
 * (longitud, espacio final colgado, correo incompleto, opción de un
 * `<select>` sin elegir). `null` = válido. No valida presencia de campos
 * NO obligatorios vacíos (WhatsApp/Consulta) — eso es lo que ya hacía
 * `required` nativo para los obligatorios, remplazado acá porque el form
 * usa `noValidate`.
 */
function validateField(key: keyof ContactFormState, rawValue: string): string | null {
  const value = rawValue.trim();

  switch (key) {
    case 'name':
      if (!value) return 'Ingresá tu nombre y apellido.';
      if (value.length < 3) return 'Debe tener al menos 3 caracteres.';
      if (value.length > NAME_MAX_LENGTH) return `No puede superar los ${NAME_MAX_LENGTH} caracteres.`;
      if (!LETTERS_PATTERN.test(value)) return 'Solo se permiten letras, con un espacio entre cada palabra.';
      return null;

    case 'email':
      if (!value) return 'Ingresá tu correo electrónico.';
      if (value.length > EMAIL_MAX_LENGTH) return `No puede superar los ${EMAIL_MAX_LENGTH} caracteres.`;
      if (!EMAIL_PATTERN.test(value)) return 'Ingresá un correo electrónico válido (ej. nombre@dominio.com).';
      return null;

    case 'city':
      if (!value) return 'Ingresá tu ciudad.';
      if (value.length < 3) return 'Debe tener al menos 3 caracteres.';
      if (value.length > CITY_MAX_LENGTH) return `No puede superar los ${CITY_MAX_LENGTH} caracteres.`;
      if (!LETTERS_PATTERN.test(value)) return 'Solo se permiten letras, con un espacio entre cada palabra.';
      return null;

    case 'phone':
      if (value && !PHONE_PATTERN.test(value)) {
        return 'Ingresá un número de WhatsApp válido.';
      }
      return null;

    case 'country':
      if (!value) return 'Seleccioná tu país.';
      return null;

    case 'area_of_interest':
      if (!value) return 'Seleccioná un área de interés.';
      return null;

    case 'message':
      if (value.length > MESSAGE_MAX_LENGTH) return `No puede superar los ${MESSAGE_MAX_LENGTH} caracteres.`;
      if (value && !MESSAGE_PATTERN.test(value)) return 'Solo se permite texto plano y signos de puntuación (sin HTML).';
      return null;

    default:
      return null;
  }
}

/** Todas las keys reales del form (sin el honeypot, que no es parte de `ContactFormState`) — usadas para validar TODO el form de una pasada antes de enviar (ver `handleSubmit`). */
const ALL_FIELD_KEYS: Array<keyof ContactFormState> = ['name', 'email', 'city', 'phone', 'country', 'area_of_interest', 'message'];

// 2026-09-12 (3ra pasada de UX sobre este form): "hay un marco ring o
// border negro que al estar activo ingresando se mantiene ... que sea mas
// suave no negro" — el borde de foco usaba `cicaindigo-500` (#2D2C4D, un
// navy muy oscuro que a simple vista se lee como negro); baja a
// `cicaindigo-300` (#A298B8, lavanda suave) — mismo halo (`ring-4
// ring-cicaindigo-500/15`) sin cambios, ya era sutil por la opacidad baja.
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-cicaindigo-300 focus:ring-4 focus:ring-cicaindigo-500/15 focus:outline-none';
/** Mismo `inputClass`, más `appearance-none` (oculta la flecha nativa) + padding derecho para la flecha propia (`<SelectChevron>`). */
const selectClass = `${inputClass} cursor-pointer appearance-none pr-10`;
const labelClass = 'mb-2 block text-sm font-semibold text-gray-700';
const requiredMarkClass = 'text-red-500';
const fieldErrorClass = 'mt-1 text-sm text-red-600';

/**
 * Flecha propia del `<select>` (reemplaza la nativa vía `appearance-none`
 * en `selectClass`) — mismo trazo simple ya usado en los botones "Más
 * servicios"/"Más casos" (`ph:caret-down`, ver `ServicesGrid.astro`/
 * `TestimonialsGrid.astro`), redibujado a mano acá porque `astro-icon` es
 * un componente de Astro, no disponible dentro de una isla React.
 * `pointer-events-none`: el click debe caer sobre el `<select>` de abajo,
 * no sobre el ícono.
 */
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

export default function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialForm);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // Errores de FORMATO detectados en el cliente (`validateField()`) — capa
  // separada de `fieldErrors` (esos vienen del servidor). Se combinan recién
  // al renderizar, ver `displayError()` más abajo.
  const [clientErrors, setClientErrors] = useState<Partial<Record<keyof ContactFormState, string>>>({});
  // Honeypot: campo real para bots, oculto visualmente (no display:none —
  // algunos bots lo detectan; se usa posicionamiento fuera de pantalla).
  const [honeypot, setHoneypot] = useState('');

  const formId = useId();

  // Número LOCAL de WhatsApp (solo dígitos, sin código de país ni espacios)
  // — `form.phone` es un campo DERIVADO de este estado + `form.country` (ver
  // `handlePhoneChange`/`handleCountryChange` más abajo), no se edita nunca
  // directo vía `updateField()`.
  const [phoneDigits, setPhoneDigits] = useState('');

  // `true` en cuanto el visitante toca el <select> de País a mano — el
  // auto-detect por IP de abajo nunca debe pisar una elección manual
  // (ni la de ANTES de que resuelva el fetch, ni la de DESPUÉS: por eso es
  // un ref, no un state — no necesita re-renderizar nada por sí solo).
  const countryTouchedRef = useRef(false);

  /**
   * 2026-09-12, pedido del Tech Lead: "que al elegir el pais ... asi se
   * ayuda, por usabilidad" — preseleccionar el país por geolocalización de
   * IP al cargar la página (ver ADR-004, `detectVisitorCountry()` en
   * `src/lib/api.ts`, que pega contra el proxy PHP `ipinfo.php`). Nunca
   * pisa una elección manual del visitante (chequea `countryTouchedRef`
   * tanto antes de lanzar el fetch como al resolver, por si el visitante
   * elige un país mientras la consulta todavía está en vuelo) ni un país
   * detectado que no esté en `COUNTRY_OPTIONS`. Si falla o tarda de más,
   * `detectVisitorCountry()` ya resuelve `null` en silencio (ver esa
   * función) — el país por defecto (Argentina) queda como estaba.
   */
  useEffect(() => {
    let cancelled = false;

    detectVisitorCountry().then((code) => {
      if (cancelled || countryTouchedRef.current || !code) {
        return;
      }

      if (!COUNTRY_OPTIONS.some((option) => option.value === code)) {
        return;
      }

      setForm((prev) => (prev.country === code ? prev : { ...prev, country: code }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Sanitiza EN VIVO según el campo (ver funciones `sanitize*` arriba) antes de guardar en el estado — `phone`/`country` tienen sus propios handlers dedicados más abajo, no pasan por acá. */
  function sanitizeForField(key: keyof ContactFormState, value: string): string {
    switch (key) {
      case 'name':
        return sanitizeLetters(value, NAME_MAX_LENGTH);
      case 'city':
        return sanitizeLetters(value, CITY_MAX_LENGTH);
      case 'email':
        return sanitizeEmailChars(value);
      case 'message':
        return sanitizeMessageChars(value);
      default:
        return value;
    }
  }

  function updateField<K extends keyof ContactFormState>(key: K, value: string) {
    const sanitized = sanitizeForField(key, value);
    setForm((prev) => ({ ...prev, [key]: sanitized }));

    // Si el campo ya tenía un error de cliente mostrado, lo re-evalúa en
    // caliente (no espera al próximo blur) — feedback más inmediato al
    // corregir un valor que ya se había marcado inválido.
    setClientErrors((prev) => (prev[key] ? { ...prev, [key]: validateField(key, sanitized) ?? '' } : prev));
  }

  function handleBlur<K extends keyof ContactFormState>(key: K) {
    const message = validateField(key, form[key]);
    setClientErrors((prev) => ({ ...prev, [key]: message ?? '' }));
  }

  /**
   * WhatsApp (2026-09-12): el `<input>` solo maneja el número LOCAL — acá
   * se sanitiza a puros dígitos (`sanitizePhoneDigits`, cualquier letra u
   * otro caracter nunca llega a pisar el estado) y se recalcula
   * `form.phone` como la concatenación final `+{dialCode}{digits}`, que es
   * lo que de verdad viaja a `submitContactForm()`.
   */
  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = sanitizePhoneDigits(event.target.value);
    setPhoneDigits(digits);

    const dialCode = dialCodeFor(form.country);
    const nextPhone = digits ? `+${dialCode}${digits}` : '';
    setForm((prev) => ({ ...prev, phone: nextPhone }));
    setClientErrors((prev) => (prev.phone ? { ...prev, phone: validateField('phone', nextPhone) ?? '' } : prev));
  }

  /**
   * Cambiar de país no solo actualiza `form.country` — también recalcula
   * `form.phone` con el MISMO número local ya tipeado pero el código de
   * país nuevo (ej. si ya había "987654321" cargado y el visitante pasa de
   * Perú a Argentina, `phone` pasa de "+51987654321" a "+54987654321" sin
   * que el visitante tenga que volver a tipear el número).
   */
  function handleCountryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    countryTouchedRef.current = true;
    const country = event.target.value;
    const dialCode = dialCodeFor(country);
    const nextPhone = phoneDigits ? `+${dialCode}${phoneDigits}` : '';

    setForm((prev) => ({ ...prev, country, phone: nextPhone }));
    setClientErrors((prev) => (prev.country ? { ...prev, country: validateField('country', country) ?? '' } : prev));
  }

  /** `fieldErrors` (servidor) tiene prioridad de FORMATO/copy sobre `clientErrors` (cliente) — pero un campo que el cliente ya sabe que está mal no debería mostrar 2 mensajes distintos a la vez; en la práctica nunca conviven: `clientErrors` se limpia por completo en cada submit nuevo (ver `handleSubmit`). */
  function displayError(key: keyof ContactFormState): string | null {
    return fieldErrors[key]?.[0] ?? clientErrors[key] ?? null;
  }

  // React 19.2+ deprecó `FormEvent`/`FormEventHandler` para el evento
  // `submit` en favor de `SubmitEvent` (que sí expone `submitter`, entre
  // otras cosas). No es un tema de cómo se importa el tipo — el tipo en sí
  // está deprecado, por eso el fix anterior (namespace import) no alcanzaba.
  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (honeypot) {
      // Bot: fingimos éxito sin llamar al API, para no darle feedback útil.
      setStatus('success');
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});

    // Validación de formato ANTES de llamar al API (2026-09-12) — corta acá
    // mismo si algo no cierra, sin gastar un round-trip contra el backend
    // (que de todos modos vuelve a validar todo desde cero, ver
    // `ContactSubmissionService::assertFieldsAreValid()` del lado genesis).
    const nextClientErrors: Partial<Record<keyof ContactFormState, string>> = {};
    for (const key of ALL_FIELD_KEYS) {
      const message = validateField(key, form[key]);
      if (message) nextClientErrors[key] = message;
    }
    setClientErrors(nextClientErrors);

    if (Object.keys(nextClientErrors).length > 0) {
      setStatus('error');
      setErrorMessage('Revisá los campos marcados antes de enviar.');
      return;
    }

    setStatus('submitting');

    const result = await submitContactForm(form);

    if (result.success) {
      setStatus('success');
      setForm(initialForm);
      setPhoneDigits('');
      return;
    }

    setStatus('error');
    setErrorMessage(result.message);
    setFieldErrors(result.fields ?? {});
  }

  if (status === 'success') {
    return (
      <div role="status" className="border-cicagreen-200 bg-cicagreen-50 text-cicagreen-800 rounded-lg border p-4 text-sm">
        Gracias por escribirnos. Te vamos a contactar a la brevedad.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* Honeypot — oculto para personas, visible para bots que autocompletan todo. */}
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

      {/* Orden de campos (2026-09-12, pedido del Tech Lead): nombre, correo,
          país, whatsapp, ciudad, área de interés, consulta — reemplaza el
          orden anterior (ciudad antes de país/whatsapp). */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-name`} className={labelClass}>
            Nombre y Apellido <span className={requiredMarkClass}>*</span>
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Tu nombre completo"
            minLength={3}
            maxLength={NAME_MAX_LENGTH}
            aria-invalid={Boolean(displayError('name'))}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            className={inputClass}
          />
          {displayError('name') && <p className={fieldErrorClass}>{displayError('name')}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-email`} className={labelClass}>
            Correo electrónico <span className={requiredMarkClass}>*</span>
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            maxLength={EMAIL_MAX_LENGTH}
            aria-invalid={Boolean(displayError('email'))}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            className={inputClass}
          />
          {displayError('email') && <p className={fieldErrorClass}>{displayError('email')}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-country`} className={labelClass}>
            País <span className={requiredMarkClass}>*</span>
          </label>
          <div className="relative">
            <select
              id={`${formId}-country`}
              name="country"
              required
              aria-invalid={Boolean(displayError('country'))}
              value={form.country}
              onChange={handleCountryChange}
              onBlur={() => handleBlur('country')}
              className={selectClass}
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          {displayError('country') && <p className={fieldErrorClass}>{displayError('country')}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-phone`} className={labelClass}>
            WhatsApp
          </label>
          {/* Grupo bandera+código de país (no editable, se arma solo desde
              "País" de arriba) + input del número local — ver
              `handlePhoneChange`/`handleCountryChange` y el docblock de
              este archivo (2026-09-12, 2da vuelta) para el detalle
              completo de por qué el input es `type="text"` y no `"tel"`. */}
          <div className="flex items-stretch">
            <span
              className="border-gray-300 bg-gray-50 text-gray-700 inline-flex shrink-0 items-center gap-1.5 rounded-l-lg border border-r-0 px-3 text-sm"
              aria-hidden="true"
            >
              <span className="text-base leading-none">{countryFlagEmoji(form.country)}</span>
              <span>+{dialCodeFor(form.country)}</span>
            </span>
            <input
              id={`${formId}-phone`}
              name="phone"
              type="text"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="987 654 321"
              maxLength={11}
              aria-invalid={Boolean(displayError('phone'))}
              value={formatPhoneDigits(phoneDigits)}
              onChange={handlePhoneChange}
              onBlur={() => handleBlur('phone')}
              className={`${inputClass} rounded-l-none`}
            />
          </div>
          {displayError('phone') && <p className={fieldErrorClass}>{displayError('phone')}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-city`} className={labelClass}>
            Ciudad <span className={requiredMarkClass}>*</span>
          </label>
          <input
            id={`${formId}-city`}
            name="city"
            type="text"
            required
            autoComplete="address-level2"
            placeholder="Tu ciudad"
            minLength={3}
            maxLength={CITY_MAX_LENGTH}
            aria-invalid={Boolean(displayError('city'))}
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
            onBlur={() => handleBlur('city')}
            className={inputClass}
          />
          {displayError('city') && <p className={fieldErrorClass}>{displayError('city')}</p>}
        </div>

        <div>
          <label htmlFor={`${formId}-area_of_interest`} className={labelClass}>
            Área de interés <span className={requiredMarkClass}>*</span>
          </label>
          <div className="relative">
            <select
              id={`${formId}-area_of_interest`}
              name="area_of_interest"
              required
              aria-invalid={Boolean(displayError('area_of_interest'))}
              value={form.area_of_interest}
              onChange={(e) => updateField('area_of_interest', e.target.value)}
              onBlur={() => handleBlur('area_of_interest')}
              className={selectClass}
            >
              <option value="" disabled>
                Elegí un área
              </option>
              {AREA_OF_INTEREST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
          {displayError('area_of_interest') && <p className={fieldErrorClass}>{displayError('area_of_interest')}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-message`} className={labelClass}>
          Consulta
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={5}
          placeholder="Escribe tu consulta aquí..."
          maxLength={MESSAGE_MAX_LENGTH}
          aria-invalid={Boolean(displayError('message'))}
          value={form.message}
          onChange={(e) => updateField('message', e.target.value)}
          onBlur={() => handleBlur('message')}
          className={`${inputClass} resize-y`}
        />
        {displayError('message') && <p className={fieldErrorClass}>{displayError('message')}</p>}
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {
        /* `cursor-pointer`/`disabled:cursor-not-allowed` (2026-09-10, pedido
        del Tech Lead: "en los enlaces del navbar y donde exista un enlace
        o action deberia de mostrarse el cursor-pointer") — sin esta
        clase, un `<button>` normal muestra el cursor de flecha por
        default en cualquier navegador (a diferencia de un `<a href>`), y
        cuando está deshabilitado (envío en curso) el cursor pasa a
        "prohibido" para reforzar que no es clickeable en ese momento. */
      }
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="border-cicagold-500 bg-cicagold-500 text-cicaindigo-500 hover:bg-cicagold-600 hover:text-cicaindigo-900 mx-auto inline-flex cursor-pointer items-center gap-2 rounded-lg border px-8 py-3 text-sm font-bold tracking-[0.1em] uppercase shadow-xl transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Enviando…' : 'Contactame ahora'}
        {/* 2026-09-11 (2da pasada de UX, mismo día): (1) el botón se veía
            "plano" comparado con el resto de CTAs dorados del sitio — el
            pill de `Hero.astro` (mismo texto tipo "CONTACTAME AHORA") ya
            lleva `shadow-xl`, acá faltaba por completo; sumado arriba en
            `className`. (2) ícono reemplazado por el SVG real que el Tech
            Lead usa en Figma para este botón (compartido tal cual, viewBox
            22×22) — el ícono anterior era una aproximación de avión de
            papel dibujada a mano, distinta de la pieza real del diseño.
            `stroke="currentColor"` (no el `#2D2C4D` fijo del original en
            Figma) para que el ícono siga el mismo cambio de color que el
            texto en :hover (`hover:text-cicaindigo-900`), igual que hacía
            el ícono anterior con `fill="currentColor"`. */}
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
