/**
 * Recepcion de entregas: del navegador del estudiante al repositorio de GitHub.
 * Universidad Piloto de Colombia · Falabella · Grupo 2 · Curso Microsoft Copilot Chat
 *
 * Como funciona:
 *   1. El portal pide aqui un token de subida (onBeforeGenerateToken). Se valida
 *      quien es, que modulo es, la extension y el tamano, y se decide la ruta.
 *   2. El navegador sube el archivo directo a Vercel Blob con ese token. Asi no
 *      pasa por esta funcion y no aplica el limite de 4,5 MB por peticion.
 *   3. Cuando termina, Vercel Blob llama aqui de nuevo (onUploadCompleted): se
 *      descarga el archivo, se hace commit al repositorio con la API de GitHub
 *      en Estudiantes/<estudiante>/<modulo>/entregas/, y se borra la copia de Blob.
 *   4. GitHub Pages se redespliega solo y la entrega queda visible en el portal.
 *
 * Variables de entorno necesarias en Vercel:
 *   BLOB_READ_WRITE_TOKEN  la inyecta el store de Blob al conectarlo al proyecto
 *   GITHUB_TOKEN           token con permiso de escritura de contenido en el repo
 *   GITHUB_REPO            por ejemplo EVA2080AI/upc-falabella-copilot-grupo2
 *   GITHUB_BRANCH          opcional, por defecto main
 */

import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';

const MAX_BYTES = 45 * 1024 * 1024;

const TIPOS = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(cuerpo, estado) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado || 200,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Deja solo letras, numeros, espacio, punto, guion y guion bajo. Sin tildes ni rutas. */
function segmento(texto, largoMax) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ._-]+/g, '')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, largoMax || 120);
}

/** Segmento de ruta: como `segmento`, pero no puede empezar ni terminar en punto, espacio ni guion. */
function segmentoRuta(texto, largoMax) {
  return segmento(texto, largoMax).replace(/^[ ._-]+|[ ._-]+$/g, '');
}

/** Texto libre de una linea: sin caracteres de control ni saltos, con tildes intactas. */
function textoLinea(texto, largoMax) {
  return String(texto || '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, largoMax || 140);
}

/** Identidad del autor del commit: el nombre tal como aparece en el portal, con tildes, y un correo noreply. */
function autor(nombre) {
  const visible = textoLinea(nombre, 80).replace(/[<>]/g, '') || 'Estudiante';
  const slug = segmento(nombre, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'estudiante';
  return { name: visible, email: slug + '@estudiantes.noreply.upc-falabella-copilot-grupo2' };
}

/** Mensaje del commit: el del estudiante si lo escribio, si no uno automatico. */
function mensajeCommit(datos) {
  const propio = textoLinea(datos.mensaje, 140);
  const archivo = datos.rutaGitHub.split('/').pop();
  const cabecera = 'M\u00f3dulo ' + datos.modulo + ': ' + (propio || 'entrega de ' + archivo);
  return cabecera + '\n\n' + 'Estudiante: ' + datos.estudiante + '\nArchivo: ' + archivo + '\nEntregado desde el portal del curso';
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET ?listar=<carpetaEstudiante>/<carpetaModulo>
 * Devuelve los archivos y los ultimos commits de la carpeta de entregas de un
 * estudiante, consultando GitHub con el token del servidor. Asi el portal no
 * gasta el limite de 60 peticiones por hora de la API anonima, que 23 personas
 * en una misma red agotarian en minutos.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const listar = url.searchParams.get('listar');
  if (!listar) return json({ ok: true, servicio: 'entregas', metodo: 'usa POST' }, 200);
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return json({ error: 'El servidor de entregas no est\u00e1 configurado.' }, 503);
  }
  const partes = listar.split('/').map((x) => segmentoRuta(x, 80)).filter(Boolean);
  if (partes.length !== 2) return json({ error: 'Ruta inv\u00e1lida.' }, 400);
  const carpeta = 'Estudiantes/' + partes[0] + '/' + partes[1] + '/entregas';
  const repo = process.env.GITHUB_REPO;
  const rama = process.env.GITHUB_BRANCH || 'main';
  const cabeceras = {
    Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portal-entregas-upc-falabella',
  };
  const base = 'https://api.github.com/repos/' + repo;
  const ruta = carpeta.split('/').map(encodeURIComponent).join('/');
  try {
    const [rc, rh] = await Promise.all([
      fetch(base + '/contents/' + ruta + '?ref=' + rama, { headers: cabeceras }),
      fetch(base + '/commits?sha=' + rama + '&per_page=8&path=' + ruta, { headers: cabeceras }),
    ]);
    const archivos = rc.ok ? (await rc.json()) : [];
    const commits = rh.ok ? (await rh.json()) : [];
    return new Response(JSON.stringify({
      archivos: (Array.isArray(archivos) ? archivos : []).filter((f) => f.type === 'file')
        .map((f) => ({ nombre: f.name, bytes: f.size, url: f.html_url })),
      commits: (Array.isArray(commits) ? commits : []).map((c) => ({
        sha: c.sha, url: c.html_url,
        fecha: c.commit && c.commit.author && c.commit.author.date,
        autor: c.commit && c.commit.author && c.commit.author.name,
        titulo: ((c.commit && c.commit.message) || '').split('\n')[0],
      })),
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return json({ error: 'No se pudo consultar GitHub en este momento.' }, 502);
  }
}

export async function POST(request) {

  const faltan = ['BLOB_READ_WRITE_TOKEN', 'GITHUB_TOKEN', 'GITHUB_REPO']
    .filter((v) => !process.env[v]);
  if (faltan.length) {
    return json({ error: 'El servidor de entregas no esta configurado: falta ' + faltan.join(', ') }, 503);
  }

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Cuerpo invalido.' }, 400); }

  try {
    const resultado = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let datos = {};
        try { datos = JSON.parse(clientPayload || '{}'); } catch (e) { /* sin datos */ }

        const carpetaEstudiante = segmentoRuta(datos.carpetaEstudiante, 80);
        const carpetaModulo = segmentoRuta(datos.carpetaModulo, 60);
        const nombreArchivo = segmentoRuta(datos.nombreFinal, 140);
        const punto = nombreArchivo.lastIndexOf('.');
        const extension = punto > 0 ? nombreArchivo.slice(punto + 1).toLowerCase() : '';

        if (!carpetaEstudiante || !carpetaModulo || !nombreArchivo) {
          throw new Error('Faltan datos del estudiante o del m\u00f3dulo.');
        }
        if (!TIPOS[extension]) {
          throw new Error('No se acepta la extensi\u00f3n .' + (extension || 'sin extensi\u00f3n') + '.');
        }

        // La ruta de Blob debe ser exactamente la que se deriva de los datos ya limpios:
        // asi nadie obtiene un token para escribir en otra parte del store.
        const rutaBlob = 'entregas/' + carpetaEstudiante + '/' + carpetaModulo + '/' + nombreArchivo;
        const pathLimpio = String(pathname || '').split('/').map((x) => segmentoRuta(x, 140)).join('/');
        if (pathLimpio !== rutaBlob) {
          throw new Error('La ruta de subida no coincide con los datos de la entrega.');
        }

        const rutaGitHub = 'Estudiantes/' + carpetaEstudiante + '/' + carpetaModulo + '/entregas/' + nombreArchivo;

        return {
          allowedContentTypes: Object.values(TIPOS),
          maximumSizeInBytes: MAX_BYTES,
          // Sufijo aleatorio: cada subida tiene una URL nueva en Blob. Sin el, la CDN de
          // Blob puede servir un 404 cacheado de una version anterior borrada y la
          // descarga para el commit falla. En GitHub el archivo conserva su nombre limpio.
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            rutaGitHub,
            estudiante: textoLinea(datos.estudiante, 80).replace(/[<>]/g, ''),
            modulo: Number(datos.moduloNumero) || 0,
            mensaje: textoLinea(datos.mensaje, 140),
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          await commitEnGitHub(blob, tokenPayload);
        } catch (error) {
          console.error('[entregas] fallo el commit:', error);
          await registrarError(blob, tokenPayload, error);
          throw error;
        } finally {
          try { await del(blob.url); } catch (e) { /* no es grave */ }
        }
      },
    });

    return json(resultado, 200);
  } catch (error) {
    console.error('[entregas]', error);
    return json({ error: error.message || 'No se pudo procesar la entrega.' }, 400);
  }
}

/** Guarda un rastro del fallo en el store, para poder diagnosticarlo con `vercel blob list`. */
async function registrarError(blob, tokenPayload, error) {
  try {
    const { put } = await import('@vercel/blob');
    const cuerpo = JSON.stringify({
      cuando: new Date().toISOString(),
      archivo: blob && blob.pathname,
      tokenPayload,
      error: String(error && error.message || error),
    }, null, 2);
    await put('errores/' + Date.now() + '.json', cuerpo, {
      access: 'public', contentType: 'application/json', addRandomSuffix: true,
    });
  } catch (e) { /* si ni esto se puede, no hay mas que hacer */ }
}

async function commitEnGitHub(blob, tokenPayload) {
        const datos = JSON.parse(tokenPayload || '{}');
        const repo = process.env.GITHUB_REPO;
        const rama = process.env.GITHUB_BRANCH || 'main';
        const cabeceras = {
          Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'portal-entregas-upc-falabella',
        };

        // 1. bajar el archivo desde Blob, sin cache y con reintentos por si la CDN aun no lo tiene
        let respuesta;
        for (let intento = 1; intento <= 4; intento++) {
          respuesta = await fetch(blob.url + (blob.url.includes('?') ? '&' : '?') + 'v=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          });
          if (respuesta.ok) break;
          if (intento < 4) await new Promise((r) => setTimeout(r, 1500 * intento));
        }
        if (!respuesta || !respuesta.ok) {
          throw new Error('No se pudo leer el archivo subido: HTTP ' + (respuesta && respuesta.status));
        }
        const contenido = Buffer.from(await respuesta.arrayBuffer()).toString('base64');

        // 2. si ya existe en el repo, GitHub exige su sha para reemplazarlo
        const urlContenido = 'https://api.github.com/repos/' + repo + '/contents/' + encodeURI(datos.rutaGitHub);
        let sha;
        const existente = await fetch(urlContenido + '?ref=' + rama, { headers: cabeceras });
        if (existente.ok) sha = (await existente.json()).sha;

        // 3. commit
        const commit = await fetch(urlContenido, {
          method: 'PUT',
          headers: { ...cabeceras, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: mensajeCommit(datos),
            content: contenido,
            branch: rama,
            author: autor(datos.estudiante),
            committer: autor(datos.estudiante),
            ...(sha ? { sha } : {}),
          }),
        });
        if (!commit.ok) {
          const detalle = await commit.text();
          throw new Error('GitHub rechazo el commit: HTTP ' + commit.status + ' ' + detalle.slice(0, 200));
        }

}
