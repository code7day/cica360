# Prompt para el agente del otro proyecto

> Copia todo lo que va debajo de la línea y pégaselo al agente que trabaje en ese
> repositorio. Está escrito para que funcione sin que tú tengas que explicar nada más.
> Lo único que debes ajustar es el bloque **CONTEXTO DEL PROYECTO** del final.

---

# Tarea: estructurar el contexto del repositorio para agentes de IA

Vas a dejar este proyecto preparado para que cualquier agente de IA —tú, otro modelo,
o una sesión futura sin memoria de esta— pueda trabajar en él de forma segura y
consistente desde el primer minuto.

**No es una tarea de documentación.** Es una tarea de arquitectura de contexto. El
criterio de éxito es concreto: *un agente que solo lee `AGENTS.md` debe poder empezar
a trabajar sin romper nada y sabiendo dónde buscar el resto.*

## Regla que gobierna todo lo demás

**No inventes ni un solo hecho.** Cada afirmación que escribas tiene que estar
verificada contra el repositorio: leída en el código, en la configuración, en las
migraciones o en el historial de git. Si algo no lo puedes verificar, no lo escribes;
lo anotas en una lista de preguntas abiertas al final de tu informe.

Un documento de contexto que miente es peor que no tener ninguno: el agente que lo lea
tomará decisiones sobre una realidad falsa, y con más confianza que si no supiera nada.

---

## Fase 1 — Inventario (antes de escribir nada)

Recorre el repositorio y **repórtame** lo que encuentres. No escribas ficheros todavía.

1. **Stack real y versiones exactas.** Léelas de los manifiestos de dependencias y de
   los ficheros de bloqueo, no de lo que diga el README. El README suele estar
   desactualizado; el lockfile no miente.
2. **Contexto de IA ya existente.** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
   `.cursorrules`, `.github/copilot-instructions.md`, `.mcp.json`, carpetas
   `.claude/`, `.agents/`, `docs/`. Para cada uno: cuántas líneas, si está
   actualizado, y **si contradice a otro**. Las contradicciones son el hallazgo más
   valioso de esta fase.
3. **Duplicados.** Ficheros con contenido idéntico o casi idéntico en dos sitios.
   Compáralos por hash, no a ojo.
4. **Estructura del código.** Los directorios de primer nivel y qué vive en cada uno.
5. **Modelo de dominio.** Las entidades principales y cómo se relacionan. Si hay
   multi-tenancy, aislamiento por cliente o segregación de datos, **descríbelo con
   precisión y di qué mecanismo lo garantiza** — es lo que más caro sale equivocar.
6. **Comandos reales.** Cómo se arranca, se prueba, se compila y se despliega.
   Verifícalos en los scripts, no los supongas.
7. **Reglas implícitas.** Busca en el historial de git y en los comentarios del código
   las cosas que alguien aprendió por las malas: "no tocar esto", "esto rompe X",
   revert de commits, avisos en mayúsculas.
8. **Secretos versionados.** Busca credenciales, tokens y claves en ficheros que estén
   bajo control de versiones. Si encuentras algo, **dímelo de inmediato y no lo copies
   en ningún documento nuevo.**

Entrégame este inventario y **espera mi confirmación** antes de la Fase 2. Si detectas
contradicciones entre documentos existentes, pregúntame cuál es la versión correcta —
no elijas tú.

---

## Fase 2 — Estructura

Monta esta jerarquía. El principio es **divulgación progresiva**: una sola puerta de
entrada, todo lo demás se carga solo cuando hace falta.

```
AGENTS.md                   # La única que se lee SIEMPRE. Máximo ~200 líneas.
CLAUDE.md                   # Puntero. ~30 líneas. NO es una copia.
GEMINI.md                   # Puntero. ~30 líneas. NO es una copia.
docs/
  context/
    ARCHITECTURE.md         # Qué hay y cómo encaja
    DOMAINS_AND_ROUTING.md  # Modelo de dominio, rutas, permisos, aislamiento
    DECISIONS.md            # POR QUÉ algo es como es
    CURRENT_STATE.md        # Qué está hecho, a medias, o roto
    TASK.md                 # En qué se está trabajando ahora
  <tema>/                   # Módulos, seguridad, despliegue… bajo demanda
```

### `AGENTS.md` — la puerta de entrada

Seis secciones, en este orden:

1. **Qué es este proyecto.** Tres o cuatro frases. Para qué sirve, quién lo usa, qué
   pasa si se cae.
2. **Mapa de la documentación.** Una tabla *cuándo → qué fichero*. Esta sección es la
   más importante del documento: es lo que permite que el resto sea corto.
3. **Reglas que no se negocian.** Con subsecciones. Cada regla **dice por qué**, y si
   viene de un incidente real, lo cuenta. Una prohibición sin motivo se la salta
   cualquiera; una prohibición con la cicatriz al lado, no.
4. **Comandos.** Los que se usan de verdad, verificados.
5. **Convenciones de código** y una subsección de **trampas conocidas**: los
   comportamientos contraintuitivos del stack con los que ya tropezó alguien.
6. **Estado y prioridades.** Un puntero a `TASK.md`, no una copia.

Termina el fichero con: *"Fuente de verdad. Actualizar aquí, no en los punteros."*

### Los punteros

`CLAUDE.md` y `GEMINI.md` llevan tres o cuatro reglas críticas —las que no puede
saltarse nadie ni por accidente— y una línea que diga que la fuente de verdad es
`AGENTS.md`. **Nunca dupliques contenido.** Dos copias del mismo hecho divergen; a
partir de ahí dos agentes creen cosas distintas y ninguno sabe cuál va bien.

Si el proyecto ya tiene skills, guías o reglas duplicadas en dos carpetas, **fusiónalas
en una y deja un enlace simbólico** en la otra ruta. Una sola copia física.

### `DECISIONS.md` — el que más valor aporta

Aquí va **solo lo que no se puede deducir leyendo el código**: por qué se eligió esta
librería y no la otra, por qué esa tabla se dejó a medias, qué se intentó y no
funcionó. Todo lo que sí es deducible del código **no se documenta** — se pudre en tres
semanas y nadie lo actualiza.

Formato por entrada: fecha, decisión, alternativas descartadas y motivo. Cuando una
decisión anterior resulte equivocada, **no la borres**: márcala como corregida y deja
la nota. El historial de por qué algo cambió vale tanto como el estado actual.

---

## Fase 3 — Convertir en código las reglas que importan

Esta fase es la que separa un contexto decorativo de uno que funciona.

Revisa las reglas que escribiste en `AGENTS.md` y pregúntate, una por una: **¿puede
esto ser una barrera en vez de una frase?** La documentación informa; el código impide.

Ejemplos del tipo de cosa que se puede blindar:

- Comandos destructivos (reconstruir la base de datos, borrados masivos): bloquéalos en
  el arranque de la aplicación, no solo en un `.md`.
- Rutas de despliegue peligrosas: confirmación explícita, o eliminar la opción.
- Invariantes de datos: restricciones en la base, no comentarios.
- Convenciones de estilo: linter en CI.

**Cada barrera lleva su test de regresión.** Y si el proyecto ya tiene una prohibición
escrita que el código contradice —una opción de script que hace justo lo prohibido—,
eso es un hallazgo prioritario: repórtamelo.

---

## Fase 4 — MCP

Revisa `.mcp.json` (o el equivalente) y propón la configuración mínima que dé a los
agentes lo que necesitan, **sin abrir más de lo necesario**:

- Expón **capacidades del proyecto**: consultar el esquema, ejecutar la suite de tests,
  leer logs, inspeccionar rutas.
- **Nunca** credenciales en el fichero versionado. Van por variables de entorno.
- **Nunca** un servidor con acceso de escritura a producción.
- Documenta en `AGENTS.md` qué hace cada servidor y cuándo usarlo. Un MCP que nadie
  sabe para qué sirve no lo usa nadie.

Si propones añadir un servidor MCP nuevo, justifica qué problema concreto resuelve.

---

## Fase 5 — Verificación

Antes de darlo por terminado:

1. **La prueba del agente nuevo.** Lee tu propio `AGENTS.md` como si no supieras nada
   del proyecto. ¿Podrías hacer un cambio pequeño sin romper nada? ¿Sabrías dónde
   buscar lo que falta? Si no, corrígelo.
2. **Verifica cada comando** que documentaste, ejecutándolo.
3. **Cero duplicados.** Comprueba por hash que ningún contenido esté en dos sitios.
4. **Cero contradicciones** entre `AGENTS.md`, los punteros y `docs/context/`.
5. **Presupuesto respetado**: `AGENTS.md` por debajo de ~200 líneas.
6. Si tocaste código en la Fase 3, **la suite de tests en verde**.

## Qué me entregas

- El inventario de la Fase 1, con las contradicciones y los secretos si los hubo.
- Los ficheros creados o modificados, y **qué eliminaste o fusionaste, con el motivo**.
- Las barreras de código que propusiste o implementaste.
- **Las preguntas abiertas**: todo lo que no pudiste verificar. Esta lista es parte del
  entregable, no una señal de trabajo incompleto. Prefiero una pregunta a una
  suposición escrita como si fuera un hecho.

## Cómo trabajar

- Cambios **incrementales y verificables**, no una reescritura de golpe.
- Si vas a borrar o fusionar algo, **enséñame antes qué y por qué**.
- Cuando dudes entre dos interpretaciones, pregunta. No elijas y sigas.
- Si descubres que algo que ya escribiste era falso, **corrígelo y dímelo**. Que hayas
  documentado algo mal no es el problema; que se quede mal, sí.

---

## CONTEXTO DEL PROYECTO

> Rellena esto antes de enviar el prompt. Cuanto más concreto, mejor sale.

- **Nombre y propósito:**
- **Stack:**
- **Entornos** (local / stage / producción) y **cuáles llevan datos reales:**
- **Reglas innegociables que ya conoces:**
- **Incidentes previos** que el agente debe conocer:
- **Quién más trabaja en el repositorio:**
