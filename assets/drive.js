/* ==========================================================================
   Enlaces a las carpetas de Google Drive del curso.
   Universidad Piloto de Colombia · Falabella · Grupo 2

   Los enlaces NO van escritos en el HTML. Se leen al cargar la pagina desde
   _assets/drive.json, un archivo que queda fuera del control de versiones.

   El motivo: la carpeta de Drive del curso esta compartida como editor para
   cualquiera con el enlace, que es lo que permite entregar sin cuenta de
   Google. Quien tenga esos enlaces tambien podria borrar lo ya subido, asi
   que no pueden quedar en un sitio publico. Si el archivo no esta, la pagina
   funciona igual y solo muestra el destino de SharePoint.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.PORTAL || {};
  if (!CFG.estudiante || !CFG.rutaBase) return;

  fetch(CFG.rutaBase + '_assets/drive.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (mapa) {
      if (!mapa) return;
      var reg = mapa[CFG.estudiante];
      if (!reg) return;

      var base = 'https://drive.google.com/drive/folders/';

      // Panel del estudiante: carpeta raiz.
      var raiz = document.getElementById('drive-estudiante');
      if (raiz && reg.id) {
        raiz.innerHTML = '';
        raiz.appendChild(boton(base + reg.id, 'Abrir mi carpeta en Google Drive ↗', 'btn pequeno principal'));
        raiz.style.marginRight = '8px';
      }

      // Pagina de modulo: carpeta del modulo.
      if (!CFG.moduloNumero) return;
      var idMod = (reg.modulos || {})[String(CFG.moduloNumero)];
      if (!idMod) return;

      var arriba = document.getElementById('drive-modulo');
      if (arriba) {
        arriba.innerHTML = '';
        arriba.appendChild(boton(base + idMod, '📂 Mi carpeta de este módulo en Google Drive ↗', 'btn sutil'));
      }
      var entrega = document.getElementById('drive-entrega');
      if (entrega) {
        entrega.innerHTML = '';
        entrega.appendChild(boton(base + idMod, '☁️ Subirlo a Google Drive ↗', 'btn principal'));
      }

      // Si hay carpeta de Drive, ese es el destino que se nombra en el texto.
      var destino = document.getElementById('nombre-destino');
      if (destino) destino.textContent = 'Google Drive';
    })
    .catch(function () { /* sin drive.json la pagina funciona igual */ });

  function boton(url, texto, clases) {
    var a = document.createElement('a');
    a.className = clases;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = texto;
    return a;
  }
})();
