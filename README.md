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
  drive.js                        Inserta los enlaces de Drive al abrir la página
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

Cada carpeta de módulo tiene un `index.html` que acepta el archivo del estudiante y lo revisa
**dentro de su propio navegador**, sin enviarlo a ningún servidor externo:

- **PDF** — cuenta las páginas reales con pdf.js y las compara contra el mínimo de la actividad.
- **Imagen** — mide el ancho en píxeles y verifica el mínimo de 1920 px de la infografía.
- **PowerPoint** — abre el `.pptx` y cuenta las diapositivas.
- **Word** — cuenta las palabras, estima las páginas y cuenta las capturas incrustadas.
- **Todos** — verifica la extensión permitida y el peso máximo de 45 MB.

Después renombra el archivo con la convención del curso
(`M3_Documento-Solucion_Nombre-Apellido_2026-09-03.pdf`), lo guarda en el navegador con IndexedDB
para que no se pierda al recargar, y ofrece descargarlo listo o abrir directamente la carpeta
de SharePoint donde debe subirse.

### Carga hacia un servidor (opcional)

El cargador trae un segundo carril ya implementado. Si se define un endpoint en la configuración
de la página, el archivo se envía de verdad por `POST` como `multipart/form-data`:

```js
window.PORTAL = { /* ... */ endpoint: "https://tu-servidor/api/subir" };
```

Sin endpoint definido, ese botón queda oculto y el portal funciona solo con el carril local.

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
PORTAL_PUBLICO=1 python3 _generador/generar.py   # versión pública: solo SharePoint
```

Usa la versión **privada** para repartirla por un canal cerrado, por ejemplo la carpeta de
SharePoint del curso o un archivo comprimido enviado por correo. Usa la versión **pública** para
cualquier sitio en línea abierto, como GitHub Pages: ahí los estudiantes entregan por SharePoint,
que es el canal oficial de calificación de todas formas.

## Privacidad

El repositorio **no contiene correos corporativos** ni identificadores de Drive. Los nombres de los
estudiantes sí aparecen, porque cada quien necesita encontrar su carpeta; todas las páginas llevan
`noindex, nofollow` y la cabecera `X-Robots-Tag` para que no queden en buscadores. Dos archivos
tienen datos que no se publican y están en `.gitignore`:

| Archivo | Qué contiene |
|---|---|
| `_assets/estudiantes.privado.json` | Los correos `@falabella.com.co` de los 22 estudiantes |
| `_assets/drive.json` | Los identificadores de las 132 carpetas de Drive, que dan permiso de escritura |
