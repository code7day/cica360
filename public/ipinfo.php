<?php

declare(strict_types=1);

/**
 * Endpoint público (GET) de geolocalización por IP para UX — ver ADR-004
 * en docs/context/DECISIONS.md.
 *
 * 2026-09-12, pedido del Tech Lead: "donde se podria usar el iso
 * country_code ... para poder preseleccionar por default el pais al cargar
 * la pagina, asi se ayuda, por usabilidad". El sitio es 100% estático (sin
 * Node en producción), así que el token de ipinfo.io NO puede vivir en
 * ningún bundle de cliente (`PUBLIC_*`) — este script, corrido por el PHP
 * del propio hosting, es quien llama a ipinfo.io con el token oculto y le
 * devuelve al navegador ÚNICAMENTE el `country_code` (nunca IP/ASN/nombre
 * de proveedor — no hace falta exponer eso al cliente para el único uso
 * que se le da: preseleccionar un `<select>`). La lógica real de consulta
 * (con su propio cache) vive en `_geoip.php`, COMPARTIDA con `contacto.php`
 * — ver el docblock de ese archivo para el porqué de compartirla.
 *
 * Este endpoint es solo para UX (preselección). El tag AUTORITATIVO de
 * país de origen que sí llega siempre a Stamless en cada submit —
 * independiente de lo que el visitante haya elegido a mano en el
 * `<select>` de País — se resuelve aparte, en `contacto.php` (ver ADR-004,
 * actualización 2026-09-12, "siempre el api debe recibir el IP y
 * country_code de origen").
 *
 * Si falla por cualquier motivo (sin cURL, sin config, error de red, IP no
 * geolocalizable), responde SIEMPRE 200 con `country_code: null` — esto es
 * una mejora de UX, nunca debe verse como un error del sitio ni bloquear
 * el formulario, que sigue funcionando con el país por defecto.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/_cors.php';
cica360_apply_local_dev_cors();

function respond_ok(?string $countryCode): void
{
    http_response_code(200);
    echo json_encode(['success' => true, 'country_code' => $countryCode], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'country_code' => null]);
    exit;
}

require_once __DIR__ . '/_geoip.php';

// --- IP real del visitante — mismo criterio que contacto.php. ---
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$clientIp = trim(explode(',', $clientIp)[0]);

respond_ok(cica360_resolve_country_code($clientIp));
