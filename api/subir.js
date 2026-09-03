/**
 * Recepcion de entregas del curso Microsoft Copilot Chat.
 * Universidad Piloto de Colombia · Falabella · Grupo 2
 *
 * Este endpoint es OPCIONAL. El portal funciona sin el: por defecto el cargador
 * revisa el archivo en el navegador del estudiante y lo prepara para SharePoint,
 * que es el canal oficial de calificacion.
 *
 * Para activarlo:
 *   1. Desplegar el repositorio en Vercel.
 *   2. Crear un almacen de Blob y enlazarlo al proyecto, lo que define
 *      la variable de entorno BLOB_READ_WRITE_TOKEN.
 *   3. En _generador/generar.py, poner la URL de este endpoint en el campo
 *      "endpoint" de la configuracion del cargador y regenerar el portal.
 */

import { put } from '@vercel/blob';

export const config = { runtime: 'edge' };

const MAX_BYTES = 45 * 1024 * 1024;
const EXTENSIONES = new Set(['pdf', 'docx', 'pptx', 'ppt', 'png', 'jpg', 'jpeg']);

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

function responder(cuerpo, estado) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });
}

function limpiar(texto, largoMax) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, largoMax);
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CABECERAS });
  }
  if (request.method !== 'POST') {
    return responder({ error: 'Solo se acepta POST.' }, 405);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return responder({
      error: 'El servidor de entregas no esta configurado. Descarga tu archivo y subelo a SharePoint.',
    }, 503);
  }

  try {
    const formulario = await request.formData();
    const archivo = formulario.get('archivo');

    if (!archivo || typeof archivo === 'string') {
      return responder({ error: 'No llego ningun archivo.' }, 400);
    }
    if (archivo.size > MAX_BYTES) {
      return responder({ error: 'El archivo supera los 45 MB permitidos.' }, 413);
    }

    const extension = (archivo.name.split('.').pop() || '').toLowerCase();
    if (!EXTENSIONES.has(extension)) {
      return responder({ error: 'No se acepta la extension .' + extension + '.' }, 415);
    }

    const estudiante = limpiar(formulario.get('estudiante'), 80) || 'sin-nombre';
    const modulo = limpiar(formulario.get('modulo'), 2) || '0';
    const actividad = limpiar(formulario.get('actividad'), 40) || 'entrega';
    const nombre = limpiar(archivo.name, 160);
    const ruta = 'entregas/modulo-' + modulo + '/' + estudiante + '/' + Date.now() + '-' + nombre;

    const subido = await put(ruta, archivo, {
      access: 'public',
      addRandomSuffix: false,
      contentType: archivo.type || 'application/octet-stream',
    });

    return responder({
      ok: true,
      url: subido.url,
      ruta,
      estudiante,
      modulo: Number(modulo),
      actividad,
      bytes: archivo.size,
      recibido: new Date().toISOString(),
    }, 200);
  } catch (error) {
    console.error('[entregas] fallo la recepcion:', error);
    return responder({
      error: 'No se pudo guardar el archivo. Descargalo y subelo a SharePoint.',
    }, 500);
  }
}
