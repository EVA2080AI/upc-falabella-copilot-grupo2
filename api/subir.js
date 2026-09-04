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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  return json({ ok: true, servicio: 'entregas', metodo: 'usa POST' }, 200);
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

        const carpetaEstudiante = segmento(datos.carpetaEstudiante, 80);
        const carpetaModulo = segmento(datos.carpetaModulo, 60);
        const nombreArchivo = segmento(datos.nombreFinal, 140);
        const extension = (nombreArchivo.split('.').pop() || '').toLowerCase();

        if (!carpetaEstudiante || !carpetaModulo || !nombreArchivo) {
          throw new Error('Faltan datos del estudiante o del modulo.');
        }
        if (!TIPOS[extension]) {
          throw new Error('No se acepta la extension .' + extension + '.');
        }

        const rutaGitHub = 'Estudiantes/' + carpetaEstudiante + '/' + carpetaModulo + '/entregas/' + nombreArchivo;

        return {
          allowedContentTypes: Object.values(TIPOS),
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify({
            rutaGitHub,
            estudiante: segmento(datos.estudiante, 80),
            modulo: Number(datos.moduloNumero) || 0,
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const datos = JSON.parse(tokenPayload || '{}');
        const repo = process.env.GITHUB_REPO;
        const rama = process.env.GITHUB_BRANCH || 'main';
        const cabeceras = {
          Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'portal-entregas-upc-falabella',
        };

        // 1. bajar el archivo desde Blob
        const respuesta = await fetch(blob.url);
        if (!respuesta.ok) throw new Error('No se pudo leer el archivo subido: HTTP ' + respuesta.status);
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
            message: 'Entrega: ' + datos.estudiante + ' · Modulo ' + datos.modulo + ' · ' + datos.rutaGitHub.split('/').pop(),
            content: contenido,
            branch: rama,
            ...(sha ? { sha } : {}),
          }),
        });
        if (!commit.ok) {
          const detalle = await commit.text();
          throw new Error('GitHub rechazo el commit: HTTP ' + commit.status + ' ' + detalle.slice(0, 200));
        }

        // 4. la copia en Blob ya no hace falta
        try { await del(blob.url); } catch (e) { /* no es grave */ }
      },
    });

    return json(resultado, 200);
  } catch (error) {
    console.error('[entregas]', error);
    return json({ error: error.message || 'No se pudo procesar la entrega.' }, 400);
  }
}
