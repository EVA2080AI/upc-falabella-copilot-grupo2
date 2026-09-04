# Portal de entregas · Microsoft Copilot Chat

Universidad Piloto de Colombia · Falabella · **Grupo 2**

**Sitio publicado:** https://eva2080ai.github.io/upc-falabella-copilot-grupo2/

Portal web con la carpeta de cada estudiante, los cinco módulos del curso, el PDF oficial
de cada actividad, un tutorial paso a paso para resolverla con Copilot **sin licencia de pago**,
y un cargador que revisa el archivo antes de que se entregue.

## Qué contiene

```
index.html                        Portal general con los 22 estudiantes
Estudiantes/
  <Nombre del estudiante>/
    index.html                    Panel con sus cinco módulos
    Modulo 1 - Diagnostico/
      index.html                  Cargador y ficha de la actividad
      Actividad_0_Diagnostico.pdf El enunciado oficial
      Tutorial Modulo 1 - ....doc El tutorial paso a paso
    Modulo 2 - Infografia/
    Modulo 3 - Documento de solucion/
    Modulo 4 - Manual del sistema/
    Modulo 5 - Presentacion final/
assets/
  estilos.css                     Hoja de estilos del portal
  cargador.js                     Validación y preparación de las entregas
  blob-client.js                  Cliente de subida a Vercel Blob, empaquetado con esbuild
api/
  subir.js                        Recibe la entrega y hace el commit al repositorio
_generador/
  datos.py                        Datos maestros: módulos, pesos y requisitos
  generar.py                      Regenera todo el portal
  plantilla_doc.py                Plantilla de Word para los tutoriales
_assets/
  estudiantes.json                Listado de estudiantes (sin correos)
  pdf/                            Los cinco PDFs originales de las actividades
  tutoriales/                     Los cinco tutoriales en formato .doc
```

## Los cinco módulos

| Módulo | Actividad | Entregable | Modalidad | Peso |
|---|---|---|---|---|
| 1 | Diagnóstico del problema | PDF de 3 a 5 páginas | Individual o pareja | 20 % |
| 2 | Infografía de la solución | PDF o imagen ≥ 1920 px | Individual o pareja | 25 % |
| 3 | Documento de la solución | Word o PDF, 4 a 6 páginas | Grupo de máx. 3 | 25 % |
| 4 | Manual del sistema o asistente | Word o PDF, mín. 8 páginas y 3 capturas | Individual | 35 % |
| 5 | Presentación y prototipo en vivo | PPT o PDF, mín. 10 diapositivas | Grupo de máx. 3 | 40 % |

## El cargador de archivos

Cada carpeta de módulo tiene un `index.html` que acepta el archivo del estudiante, lo revisa
**dentro de su propio navegador** y lo sube al repositorio con un clic:

- **PDF** — cuenta las páginas reales con pdf.js y las compara contra el mínimo de la actividad.
- **Imagen** — mide el ancho en píxeles y verifica el mínimo de 1920 px de la infografía.
- **PowerPoint** — abre el `.pptx` y cuenta las diapositivas.
- **Word** — cuenta las palabras, estima las páginas y cuenta las capturas incrustadas.
- **Todos** — verifica la extensión permitida y el peso máximo de 45 MB.

Después renombra el archivo con la convención del curso
(`M3_Documento-Solucion_Nombre-Apellido_2026-09-04.pdf`), lo guarda en el navegador con IndexedDB
para que no se pierda al recargar, y lo sube.

## Dónde quedan las entregas

**En este mismo repositorio**, en `Estudiantes/<estudiante>/<módulo>/entregas/`. Así el docente
las recoge de GitHub y quedan publicadas en el portal con el resto del material del módulo.

Cada subida es un **commit a nombre del estudiante**, como lo haría un desarrollador: el autor y el
committer llevan su nombre, el mensaje lo escribe el estudiante en el portal si quiere, y en la
página del módulo se ve el historial de commits de su carpeta. Los estudiantes no necesitan cuenta
de GitHub: la identidad del commit la pone la función a partir del nombre con que aparecen en el
portal, con un correo `noreply` derivado.

El camino del archivo, de principio a fin:

1. El portal pide a `api/subir.js`, desplegada en Vercel, un token de subida. La función valida
   el estudiante, el módulo, la extensión y el tamaño, y fija la ruta de destino.
2. El navegador sube el archivo directo a Vercel Blob con ese token. Por eso no aplica el límite
   de 4,5 MB por petición de las funciones: una presentación de 30 MB pasa sin problema.
3. Al terminar, Vercel Blob avisa a la misma función, que descarga el archivo, hace el commit
   con la API de GitHub y borra la copia de Blob.
4. GitHub Pages se redespliega solo y la entrega aparece en el portal en uno o dos minutos.
   Si el estudiante sube otra versión con el mismo nombre, reemplaza la anterior y queda un
   commit nuevo en el historial.

La función necesita tres variables de entorno en Vercel:

| Variable | Qué es |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | La pone sola el store de Blob al vincularlo al proyecto |
| `GITHUB_REPO` | `EVA2080AI/upc-falabella-copilot-grupo2` |
| `GITHUB_TOKEN` | Token con permiso de escritura de contenido **solo en este repositorio** |

Para el token conviene uno de grano fino, creado en
`github.com/settings/personal-access-tokens/new` con acceso únicamente a este repositorio y el
permiso *Contents: Read and write*. Se carga con `vercel env add GITHUB_TOKEN production` y
después se redespliega con `vercel --prod`.

## Regenerar el portal

```bash
python3 _generador/generar.py
```

Lee `_assets/estudiantes.json` y `_generador/datos.py`, y reconstruye las 110 carpetas de módulo,
los 22 paneles de estudiante y la portada. Para añadir o quitar a alguien, edita el JSON y vuelve
a ejecutarlo.

## Dos versiones del portal, y por qué

La carpeta de Google Drive del curso está compartida como **editor para cualquiera con el enlace**,
que es lo que permite a los estudiantes subir su entrega sin tener cuenta de Google. El efecto
secundario es que **quien tenga el enlace también puede borrar lo que ya esté subido**. Por eso el
generador produce dos versiones:

```bash
python3 _generador/generar.py                    # versión privada: con los enlaces de Drive
```

Usa la versión **privada** para repartirla por un canal cerrado, por ejemplo la carpeta de
que es el canal oficial de calificación de todas formas.

## Privacidad

El repositorio **no contiene correos corporativos**. Los nombres de los
estudiantes sí aparecen, porque cada quien necesita encontrar su carpeta; todas las páginas llevan
`noindex, nofollow` y la cabecera `X-Robots-Tag` para que no queden en buscadores. Dos archivos
tienen datos que no se publican y están en `.gitignore`:

| Archivo | Qué contiene |
|---|---|
| `_assets/estudiantes.privado.json` | Los correos `@falabella.com.co` de los 22 estudiantes |
| `_assets/drive.json` | Identificadores de carpetas de Drive de un diseño anterior; ya no se usan |
