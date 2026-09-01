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
 * archivo versionado en git: vive en `contacto.config.php`, que hay que
 * crear a mano en el servidor (ver contacto.config.example.php) y que
 * está en .gitignore a propósito.
 *
 * Requiere: PHP con la extensión cURL habilitada (estándar en shared
 * hosting real). Si el hosting no tiene PHP, usar el fallback de token
 * acotado documentado en ADR-002 en vez de este proxy.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

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

$configPath = __DIR__ . '/contacto.config.php';

if (!is_file($configPath)) {
    error_log('[contacto.php] Falta contacto.config.php — ver contacto.config.example.php para crearlo.');
    respond(500, ['success' => false, 'message' => 'Error interno. Intentá de nuevo más tarde.', 'status_code' => 500]);
}

require $configPath;
// Debe definir las constantes: STAMLESS_API_URL, STAMLESS_TENANT_SLUG,
// STAMLESS_FORMS_TOKEN, y opcionalmente CONTACT_FORM_SLUG (default 'contacto').

foreach (['STAMLESS_API_URL', 'STAMLESS_TENANT_SLUG', 'STAMLESS_FORMS_TOKEN'] as $required) {
    if (!defined($required) || constant($required) === '') {
        error_log("[contacto.php] Falta la constante {$required} en contacto.config.php.");
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

// --- Forward a Stamless ---
$formSlug = defined('CONTACT_FORM_SLUG') ? CONTACT_FORM_SLUG : 'contacto';
$targetUrl = rtrim(STAMLESS_API_URL, '/') . '/v1/' . STAMLESS_TENANT_SLUG . '/forms/' . rawurlencode($formSlug) . '/submit';

$ch = curl_init($targetUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: Bearer ' . STAMLESS_FORMS_TOKEN,
    ],
    CURLOPT_TIMEOUT => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
]);

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
