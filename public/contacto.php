<?php

declare(strict_types=1);

/**
 * Proxy server-side del formulario de contacto — ver ADR-002 en
 * docs/context/DECISIONS.md y docs/context/ARCHITECTURE.md §3.
 *
 * Este script recibe el POST del navegador (desde la isla React
 * ContactForm.tsx, vía src/lib/api.ts::submitContactForm()) y lo reenvía
 * server-side a la API de Stamless con el Bearer token de la ability
 * `forms:submit` — el token NUNCA está en este archivo ni en ningún
 * archivo versionado en git: se lee de `.env` (mismo `.env` que usa
 * Node/Astro en build time) vía `_env.php`, que hay que copiar a mano un
 * nivel por encima del document root en el servidor — ver el docblock de
 * `_env.php` para el detalle de seguridad de esa ubicación, y ADR-002
 * (actualización 2026-09-12) en docs/context/DECISIONS.md.
 *
 * Requiere: PHP con la extensión cURL habilitada (estándar en shared
 * hosting real). Si el hosting no tiene PHP, usar el fallback de token
 * acotado documentado en ADR-002 en vez de este proxy.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/_cors.php';
cica360_apply_local_dev_cors();

// El preflight que el navegador manda ANTES del POST real cuando el
// request es cross-origin con `Content-Type: application/json` (dev local
// con MAMP, ver docblock de `_cors.php`) — cortamos acá, antes de exigir
// POST, para no devolverle un 405 al preflight.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Nota de compatibilidad: se evita a propósito cualquier sintaxis de PHP
 * 8.1+ (tipo `never`, enums, readonly, etc.) porque no está confirmado
 * qué versión de PHP corre el shared hosting real del cliente — este
 * script apunta a ser compatible desde PHP 7.4+.
 */
function respond(int $status, array $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Método no permitido.', 'status_code' => 405]);
}

if (!function_exists('curl_init')) {
    // Error de configuración del hosting, no del visitante — log server-side
    // (no se expone el detalle interno en la response).
    error_log('[contacto.php] La extensión cURL de PHP no está habilitada en este hosting.');
    respond(500, ['success' => false, 'message' => 'Error interno. Intentá de nuevo más tarde.', 'status_code' => 500]);
}

require_once __DIR__ . '/_env.php';

// Nombres de variable IGUALES a los que ya documenta `.env` — así el mismo
// archivo sirve para Node/Astro (build time) y para este proxy (runtime),
// sin duplicar ni renombrar nada (ver ADR-002, actualización 2026-09-12).
define('STAMLESS_API_URL', (string) cica360_env('STAMLESS_API_URL', ''));
define('STAMLESS_TENANT_SLUG', (string) cica360_env('STAMLESS_TENANT_SLUG', ''));
define('STAMLESS_FORMS_TOKEN', (string) cica360_env('STAMLESS_FORMS_PROXY_TOKEN', ''));
define('CONTACT_FORM_SLUG', (string) cica360_env('CONTACT_FORM_SLUG', 'contacto'));

foreach (['STAMLESS_API_URL', 'STAMLESS_TENANT_SLUG', 'STAMLESS_FORMS_TOKEN'] as $required) {
    if (constant($required) === '') {
        error_log("[contacto.php] Falta la variable {$required} en .env (ver .env.example) — el .env debe existir en el servidor un nivel por encima del document root, ver _env.php.");
        respond(500, ['success' => false, 'message' => 'Error interno. Intentá de nuevo más tarde.', 'status_code' => 500]);
    }
}

// --- Rate limit best-effort por IP (defensa en profundidad — el rate
// limit real, autoritativo, ya lo aplica la API de Stamless: 10/min en
// forms/submit). Guarda un archivo de 0 bytes por IP en el directorio
// temporal del sistema y rechaza si el anterior es muy reciente. No
// requiere Redis/Memcached ni nada que el shared hosting no tenga.
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$clientIp = trim(explode(',', $clientIp)[0]);
$rateLimitFile = sys_get_temp_dir() . '/cica360_contacto_' . hash('sha256', $clientIp) . '.lock';
$minSecondsBetweenSubmits = 5;

if (is_file($rateLimitFile) && (time() - (int) filemtime($rateLimitFile)) < $minSecondsBetweenSubmits) {
    respond(429, ['success' => false, 'message' => 'Demasiadas solicitudes. Intentá más tarde.', 'status_code' => 429, 'errors' => ['code' => 'too_many_requests']]);
}

// --- Body ---
$rawBody = file_get_contents('php://input') ?: '';
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    respond(422, ['success' => false, 'message' => 'Revisá los datos enviados.', 'status_code' => 422, 'errors' => ['code' => 'validation']]);
}

// Honeypot server-side (además del honeypot del lado del cliente en
// ContactForm.tsx): si el campo trampa viene con contenido, es un bot.
// Respondemos éxito falso sin pegarle a la API real, para no darle
// feedback útil ni gastar cupo del rate limit real en spam.
if (!empty($payload['website'])) {
    respond(201, ['success' => true, 'message' => 'Formulario enviado correctamente.', 'status_code' => 201, 'data' => ['uuid' => null]]);
}
unset($payload['website']);

touch($rateLimitFile);

// --- País de origen por IP (2026-09-12, pedido del Tech Lead: "cabe la
// posibilidad abierta de que el cliente cambie de pais en el formulario
// pero siempre el api debe recibir el IP y country_code de origen, por
// favor asegurarse eso") — se resuelve DE NUEVO acá, siempre, en el
// momento del envío, a partir de $clientIp (la IP real de la conexión).
// Deliberadamente NO se reutiliza ningún valor que el navegador haya
// mandado en el payload (ej. un eventual "country_code" detectado por el
// GET a ipinfo.php al cargar la página): ese lookup de UX es best-effort y
// puede no haber corrido, fallado, o (si alguna vez se sumara al payload)
// ser manipulado por el cliente — la única fuente de verdad de "origen"
// es la IP de ESTA conexión, resuelta server-side. Completamente
// independiente de `payload['country']` (el país que el visitante elige a
// mano en el `<select>` — dato de negocio, no geolocalización), que el
// visitante puede cambiar libremente sin afectar este valor.
//
// Best-effort, igual que ipinfo.php: si falla por cualquier motivo (sin
// cURL/token, red, IP no geolocalizable), `$originCountryCode` queda
// `null` y el header simplemente no se manda — NUNCA bloquea ni demora
// más de lo que ya tarda `cica360_resolve_country_code()` (con su propio
// timeout corto) el envío del formulario. Es un dato opcional también del
// lado de Stamless (ver ADR correspondiente en genesis): no es obligatorio
// para ningún tenant, cada uno decide si lo usa según si su proxy lo
// manda o no.
require_once __DIR__ . '/_geoip.php';
$originCountryCode = cica360_resolve_country_code($clientIp);

// --- Forward a Stamless ---
$targetUrl = rtrim(STAMLESS_API_URL, '/') . '/v1/' . STAMLESS_TENANT_SLUG . '/forms/' . rawurlencode(CONTACT_FORM_SLUG) . '/submit';

$forwardHeaders = [
    'Content-Type: application/json',
    'Accept: application/json',
    'Authorization: Bearer ' . STAMLESS_FORMS_TOKEN,
    // 2026-09-12 (ADR-004): esta llamada es server-to-server (este
    // script corre en el hosting de CICA360 y le pega a Stamless por
    // cURL) — sin este header, Stamless vería como "IP del visitante"
    // la IP saliente de ESTE hosting, siempre la misma para cualquier
    // visitante. Se reenvía la IP real ($clientIp, ya calculada arriba
    // para el rate limit de este mismo script) para que
    // FormSubmissionController::store() (genesis) la use en vez de la
    // suya propia al guardar Contact::ip_address.
    'X-Forwarded-For: ' . $clientIp,
];

if ($originCountryCode !== null) {
    // Opcional: solo se manda si se pudo resolver. Ver comentario arriba
    // de $originCountryCode para el porqué de resolverlo siempre de nuevo
    // acá en vez de confiar en cualquier valor que venga en $payload.
    $forwardHeaders[] = 'X-Origin-Country: ' . $originCountryCode;
}

// 2026-09-12, pedido del Tech Lead: "validar que el formulario solo
// reciba de un dominio de la app (website cliente) que fue configurada al
// crear un token, por seguridad". Esta llamada es server-to-server (ver
// comentario de X-Forwarded-For arriba) — no hay un `Origin` de navegador
// real que reenviar, así que este proxy declara el SUYO propio explícito
// (el dominio público real de este sitio, `PUBLIC_SITE_URL` del mismo
// `.env` que ya usa Node/Astro), para que
// `FormSubmissionController::assertOriginIsAllowed()` (genesis) lo valide
// contra los `Domain` registrados para este tenant. Ver ADR
// correspondiente en `docs/context/DECISIONS.md`, mismo día.
$siteHost = parse_url((string) cica360_env('PUBLIC_SITE_URL', ''), PHP_URL_HOST);

if (is_string($siteHost) && $siteHost !== '') {
    $forwardHeaders[] = 'X-Forwarded-Host: ' . $siteHost;
}

if (!empty($_SERVER['HTTP_REFERER'])) {
    $forwardHeaders[] = 'Referer: ' . $_SERVER['HTTP_REFERER'];
} elseif (!empty($_SERVER['HTTP_ORIGIN'])) {
    $forwardHeaders[] = 'Origin: ' . $_SERVER['HTTP_ORIGIN'];
}

$ch = curl_init($targetUrl);
$curlOptions = [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
];

$insecureTls = cica360_env('STAMLESS_DEV_INSECURE_TLS') === 'true'
    || str_ends_with((string) parse_url(STAMLESS_API_URL, PHP_URL_HOST), '.host');

if ($insecureTls) {
    $curlOptions[CURLOPT_SSL_VERIFYPEER] = false;
    $curlOptions[CURLOPT_SSL_VERIFYHOST] = false;
}

curl_setopt_array($ch, $curlOptions);

$responseBody = curl_exec($ch);
$curlErrno = curl_errno($ch);
$httpStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlErrno !== 0 || $responseBody === false) {
    error_log('[contacto.php] cURL error al llamar a Stamless: errno ' . $curlErrno);
    respond(502, ['success' => false, 'message' => 'No se pudo conectar con el servidor. Intentá de nuevo.', 'status_code' => 502]);
}

// Reenviamos el envelope de Stamless tal cual — mismo shape que espera
// src/lib/api.ts::submitContactForm() del lado del cliente, así el front
// no necesita saber que hay un proxy en el medio.
http_response_code($httpStatus > 0 ? $httpStatus : 500);
echo $responseBody;
