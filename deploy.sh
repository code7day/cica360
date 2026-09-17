#!/bin/bash

# ==============================================================================
# SCRIPT DE DESPLIEGUE AUTOMATIZADO - CICA360 (FTP CPANEL / FEROZO)
# ==============================================================================

set -e

# Colores de terminal
COLOR_RESET="\033[0m"
COLOR_PRIMARY="\033[38;2;217;119;6m"     # Amber
COLOR_SUCCESS="\033[38;2;16;185;129m"    # Green
COLOR_INFO="\033[38;2;59;130;246m"       # Blue
COLOR_WARNING="\033[38;2;245;158;11m"    # Yellow
COLOR_ERROR="\033[38;2;239;68;68m"       # Red
COLOR_MUTED="\033[38;2;156;163;175m"     # Gray

SKIP_BUILD=false
DIST_DIR="dist"

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--dir)
            DIST_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Uso: $0 [--no-build] [-d <directorio_dist>]"
            echo ""
            echo "Opciones:"
            echo "  --no-build       Omite 'npm run build' y despliega el 'dist/' actual"
            echo "  -d, --dir <path> Especifica la ruta local de la carpeta 'dist/'"
            echo "  -h, --help       Muestra esta ayuda"
            echo ""
            echo "Variables soportadas en .env o .env.production:"
            echo "  FTP_HOST         Servidor FTP (default: c2701532.ferozo.com)"
            echo "  FTP_USER         Usuario FTP (default: ftp@c2701532.ferozo.com)"
            echo "  FTP_PASSWORD     Contraseña FTP"
            echo "  FTP_REMOTE_DIR   Directorio remoto (default: public_html)"
            echo "  FTP_PORT         Puerto FTP (default: 21)"
            exit 0
            ;;
        *)
            echo -e "${COLOR_ERROR}Opción no reconocida: $1${COLOR_RESET}"
            exit 1
            ;;
    esac
done

# Función para cargar variables desde archivos .env
load_env_file() {
    local env_path="$1"
    if [ -f "$env_path" ]; then
        echo -e "${COLOR_MUTED}⚙️  Leyendo configuración desde ${env_path}...${COLOR_RESET}"
        while IFS= read -r line || [ -n "$line" ]; do
            line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            if [ -z "$line" ] || [ "${line#\#}" != "$line" ]; then
                continue
            fi
            if echo "$line" | grep -q "="; then
                key=$(echo "${line%%=*}" | tr -d '[:space:]')
                value=$(echo "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                case "$key" in
                    FTP_HOST) [ -z "$ENV_FTP_HOST" ] && ENV_FTP_HOST="$value" ;;
                    FTP_USER) [ -z "$ENV_FTP_USER" ] && ENV_FTP_USER="$value" ;;
                    FTP_PASS|FTP_PASSWORD) [ -z "$ENV_FTP_PASS" ] && ENV_FTP_PASS="$value" ;;
                    FTP_REMOTE_DIR|FTP_DIR) [ -z "$ENV_FTP_REMOTE_DIR" ] && ENV_FTP_REMOTE_DIR="$value" ;;
                    FTP_PORT) [ -z "$ENV_FTP_PORT" ] && ENV_FTP_PORT="$value" ;;
                esac
            fi
        done < "$env_path" || true
    fi
}

# Cargar archivos .env locales
load_env_file ".env.production"
load_env_file ".env.local"
load_env_file ".env"

# Prioridad: Variables de entorno explícitas > Archivo .env > Valores por defecto de Ferozo
FTP_HOST="${FTP_HOST:-${ENV_FTP_HOST:-c2701532.ferozo.com}}"
FTP_USER="${FTP_USER:-${ENV_FTP_USER:-ftp@c2701532.ferozo.com}}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-${ENV_FTP_REMOTE_DIR:-public_html}}"
FTP_PORT="${FTP_PORT:-${ENV_FTP_PORT:-21}}"
FTP_PASS="${FTP_PASS:-${FTP_PASSWORD:-${ENV_FTP_PASS}}}"

echo -e "\n${COLOR_PRIMARY}========================================================================${COLOR_RESET}"
echo -e "${COLOR_PRIMARY}🚀 DESPLIEGUE DE CICA360 A CPANEL / FEROZO (FTP)${COLOR_RESET}"
echo -e "${COLOR_PRIMARY}========================================================================${COLOR_RESET}"
echo -e "Servidor FTP:   ${COLOR_INFO}ftp://${FTP_HOST}:${FTP_PORT}${COLOR_RESET}"
echo -e "Usuario FTP:    ${COLOR_INFO}${FTP_USER}${COLOR_RESET}"
echo -e "Directorio:     ${COLOR_INFO}/${FTP_REMOTE_DIR}/${COLOR_RESET}"
echo -e "Autenticación:  ${COLOR_INFO}$([ -n "$FTP_PASS" ] && echo "Cargada desde .env" || echo "Pendiente por terminal")${COLOR_RESET}"
echo -e "${COLOR_PRIMARY}========================================================================${COLOR_RESET}"

# 1. Compilar Astro a dist/ usando configuración de producción
if [ "$SKIP_BUILD" = false ]; then
    echo -e "\n${COLOR_INFO}📦 Compilando sitio estático con Astro para producción ('npm run build')...${COLOR_RESET}"
    export ASTRO_TELEMETRY_DISABLED=1

    # Cargar variables de .env.production en el entorno para el build de Astro si existe
    if [ -f ".env.production" ]; then
        echo -e "${COLOR_MUTED}⚙️  Exportando variables de .env.production para el build...${COLOR_RESET}"
        while IFS= read -r line || [ -n "$line" ]; do
            line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            if [ -z "$line" ] || [ "${line#\#}" != "$line" ]; then
                continue
            fi
            if echo "$line" | grep -q "="; then
                key=$(echo "${line%%=*}" | tr -d '[:space:]')
                value=$(echo "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                export "$key=$value"
            fi
        done < ".env.production" || true
    fi

    npm run build
fi

# Validar existencia de dist
if [ ! -d "$DIST_DIR" ]; then
    echo -e "\n${COLOR_ERROR}❌ Error: No se encontró la carpeta '${DIST_DIR}'.${COLOR_RESET}"
    exit 1
fi

# Inyectar .env de producción en dist/.env
if [ -f ".env.production" ]; then
    echo -e "${COLOR_INFO}📄 Generando ${DIST_DIR}/.env a partir de .env.production...${COLOR_RESET}"
    cp .env.production "${DIST_DIR}/.env"
elif [ -f ".env" ]; then
    echo -e "${COLOR_INFO}📄 Copiando .env a ${DIST_DIR}/.env...${COLOR_RESET}"
    cp .env "${DIST_DIR}/.env"
fi

if [ -f "public/.htaccess" ]; then
    echo -e "${COLOR_INFO}📄 Copiando .htaccess a ${DIST_DIR}/.htaccess...${COLOR_RESET}"
    cp public/.htaccess "${DIST_DIR}/.htaccess"
fi

TOTAL_FILES=$(find "$DIST_DIR" -type f | wc -l | tr -d ' ')
echo -e "\n${COLOR_SUCCESS}✅ Directorio dist listo:${COLOR_RESET} ${DIST_DIR} (${TOTAL_FILES} archivos)"

# 2. Solicitar contraseña FTP si no vino en el .env
if [ -z "$FTP_PASS" ]; then
    echo -e "\n${COLOR_WARNING}🔑 Ingresa la contraseña para ${FTP_USER}:${COLOR_RESET}"
    read -r -s FTP_PASS
    echo ""
    if [ -z "$FTP_PASS" ]; then
        echo -e "${COLOR_ERROR}❌ La contraseña no puede estar vacía.${COLOR_RESET}"
        exit 1
    fi
fi

# 3. Desplegar vía FTP (LFTP con mirror incremental o Python ftplib nativo)
echo -e "\n${COLOR_INFO}📡 Conectando y sincronizando archivos con ${FTP_HOST}...${COLOR_RESET}"

if command -v lftp >/dev/null 2>&1; then
    echo -e "${COLOR_MUTED}Usando lftp (mirror incremental)...${COLOR_RESET}"
    
    lftp -u "${FTP_USER}","${FTP_PASS}" "${FTP_HOST}" <<EOF
set ssl:verify-certificate no
set ftp:ssl-allow yes
set net:timeout 15
set net:max-retries 3
cd ${FTP_REMOTE_DIR} || mkdir -p ${FTP_REMOTE_DIR} && cd ${FTP_REMOTE_DIR}
mirror --reverse --delete --verbose --exclude .well-known/ --exclude cgi-bin/ ${DIST_DIR}/ .
bye
EOF

else
    echo -e "${COLOR_MUTED}Usando motor Python ftplib nativo...${COLOR_RESET}"

    python3 - <<PYEOF
import os
import sys
import ftplib
import ssl

host = "${FTP_HOST}"
user = "${FTP_USER}"
password = """${FTP_PASS}"""
remote_base = "${FTP_REMOTE_DIR}"
local_base = os.path.abspath("${DIST_DIR}")
port = int("${FTP_PORT:-21}")

print(f"-> Conectando a {host}:{port} con soporte FTPS / TLS...")
ftp = None
try:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    ftp = ftplib.FTP_TLS(context=context, timeout=30)
    ftp.connect(host, port)
    ftp.login(user, password)
    ftp.prot_p()
    ftp.set_pasv(True)
    print("-> Autenticado correctamente vía FTPS (TLS Seguro).")
except Exception as e:
    print(f"-> Conexión FTPS reportó: {e}. Intentando FTP estándar...")
    try:
        ftp = ftplib.FTP(timeout=30)
        ftp.connect(host, port)
        ftp.login(user, password)
        ftp.set_pasv(True)
        print("-> Autenticado vía FTP estándar.")
    except Exception as err:
        print(f"Error de conexión FTP: {err}", file=sys.stderr)
        sys.exit(1)

def ensure_remote_dir(path):
    parts = path.strip("/").split("/")
    current = ""
    for part in parts:
        if not part:
            continue
        current += "/" + part
        try:
            ftp.cwd(current)
        except Exception:
            try:
                ftp.mkd(current)
                ftp.cwd(current)
            except Exception as e:
                pass

try:
    ensure_remote_dir(remote_base)
except Exception as e:
    print(f"Error al acceder a /{remote_base}: {e}", file=sys.stderr)
    sys.exit(1)

file_list = []
for root, dirs, files in os.walk(local_base):
    for f in files:
        if not f.startswith(".DS_Store"):
            file_list.append((root, f))

total_files_count = len(file_list)
total_uploaded = 0
upload_errors = 0

for root, file in file_list:
    rel_path = os.path.relpath(root, local_base)
    if rel_path == ".":
        remote_dir = f"/{remote_base}"
    else:
        remote_dir = f"/{remote_base}/{rel_path.replace(os.sep, '/')}"
    
    ensure_remote_dir(remote_dir)
    local_file_path = os.path.join(root, file)
    
    try:
        with open(local_file_path, "rb") as f:
            ftp.storbinary(f"STOR {file}", f)
            total_uploaded += 1
            sys.stdout.write(f"\r-> Subidos {total_uploaded}/{total_files_count} archivos... ({file[:35]})")
            sys.stdout.flush()
    except Exception as e:
        upload_errors += 1
        print(f"\n[!] Error subiendo {file} ({local_file_path}): {e}", file=sys.stderr)

ftp.quit()
print(f"\n-> ¡{total_uploaded}/{total_files_count} archivos transferidos con éxito!")
if upload_errors > 0:
    print(f"[!] Hubo {upload_errors} errores durante la transferencia.", file=sys.stderr)
    sys.exit(1)
PYEOF

fi

echo -e "\n${COLOR_SUCCESS}========================================================================${COLOR_RESET}"
echo -e "${COLOR_SUCCESS}🎉 ¡DESPLIEGUE DE CICA360 COMPLETADO CON ÉXITO EN CPANEL!${COLOR_RESET}"
echo -e "${COLOR_SUCCESS}========================================================================${COLOR_RESET}"
echo -e "Ruta remota: ${COLOR_INFO}/${FTP_REMOTE_DIR}/${COLOR_RESET}"
echo -e "Sitio en vivo: ${COLOR_INFO}https://cica360.com${COLOR_RESET}"
