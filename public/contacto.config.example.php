<?php

/**
 * Copiar este archivo a `contacto.config.php` (mismo directorio) y
 * completar los valores reales — `contacto.config.php` está en
 * .gitignore a propósito, NUNCA debe commitearse con el token real.
 *
 * En producción: crear este archivo directo en el servidor (por FTP/SFTP
 * o el editor de archivos del panel del hosting), fuera del flujo de
 * deploy por git — el mismo patrón que `.env` para el resto del proyecto.
 */

// Sin /v1/{tenant_slug} — igual que STAMLESS_API_URL en .env.
define('STAMLESS_API_URL', 'https://api.stamless.io');

define('STAMLESS_TENANT_SLUG', 'cica360');

// Token de Console (Desarrolladores -> API Tokens) con ÚNICAMENTE la
// ability forms:submit. NUNCA usar acá un token que tenga content:read.
define('STAMLESS_FORMS_TOKEN', '');

// Slug del form a enviar — coincide con el seed real de CICA360.
define('CONTACT_FORM_SLUG', 'contacto');
