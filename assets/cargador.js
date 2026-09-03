/* ==========================================================================
   Cargador de entregables
   Universidad Piloto de Colombia · Falabella · Grupo 2
   Curso: Microsoft Copilot Chat

   Funciona en dos carriles:
     1. LOCAL  (siempre): valida el archivo contra los requisitos oficiales de
        la actividad, lo renombra con la convencion del curso, lo guarda en el
        navegador (IndexedDB) y lo empaqueta para subirlo a SharePoint.
     2. SERVIDOR (opcional): si la pagina define window.PORTAL.endpoint, el
        archivo se envia de verdad al servidor del curso.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.PORTAL || {};
  var MAX_MB = 45;
  var BD = 'entregas-upc-falabella-g2';
  var ALMACEN = 'archivos';

  /* ---------------------------------------------------------------- utiles */
  function $(s, r) { return (r || document).querySelector(s); }
  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function ext(nombre) {
    var p = nombre.lastIndexOf('.');
    return p < 0 ? '' : nombre.slice(p + 1).toLowerCase();
  }
  function limpiar(t) {
    return String(t || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  function plural(n, uno, muchos) { return n === 1 ? uno : muchos; }
  function nArch(n) { return n + ' ' + plural(n, 'archivo', 'archivos'); }
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function cargarScript(url) {
    return new Promise(function (ok, mal) {
      if (document.querySelector('script[src="' + url + '"]')) return ok();
      var s = document.createElement('script');
      s.src = url; s.onload = ok; s.onerror = function () { mal(new Error('No se pudo cargar ' + url)); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------------------------------- almacen local */
  function abrirBD() {
    return new Promise(function (ok, mal) {
      var p = indexedDB.open(BD, 1);
      p.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(ALMACEN)) {
          db.createObjectStore(ALMACEN, { keyPath: 'id' });
        }
      };
      p.onsuccess = function () { ok(p.result); };
      p.onerror = function () { mal(p.error); };
    });
  }
  function guardarLocal(reg) {
    return abrirBD().then(function (db) {
      return new Promise(function (ok, mal) {
        var tx = db.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).put(reg);
        tx.oncomplete = function () { ok(true); };
        tx.onerror = function () { mal(tx.error); };
      });
    }).catch(function () { return false; });
  }
  function borrarLocal(id) {
    return abrirBD().then(function (db) {
      return new Promise(function (ok) {
        var tx = db.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).delete(id);
        tx.oncomplete = function () { ok(true); };
        tx.onerror = function () { ok(false); };
      });
    }).catch(function () { return false; });
  }
  function leerLocal(prefijo) {
    return abrirBD().then(function (db) {
      return new Promise(function (ok) {
        var tx = db.transaction(ALMACEN, 'readonly');
        var pet = tx.objectStore(ALMACEN).getAll();
        pet.onsuccess = function () {
          ok((pet.result || []).filter(function (r) { return r.id.indexOf(prefijo) === 0; }));
        };
        pet.onerror = function () { ok([]); };
      });
    }).catch(function () { return []; });
  }

  /* ------------------------------------------------ inspeccion de archivos */
  function contarPaginasPDF(archivo) {
    return cargarScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
      .then(function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return archivo.arrayBuffer();
      })
      .then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; })
      .then(function (doc) { return doc.numPages; })
      .catch(function () { return null; });
  }

  function medirImagen(archivo) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(archivo);
      var im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); ok({ ancho: im.naturalWidth, alto: im.naturalHeight }); };
      im.onerror = function () { URL.revokeObjectURL(url); ok(null); };
      im.src = url;
    });
  }

  function inspeccionarOffice(archivo, tipo) {
    return cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
      .then(function () { return window.JSZip.loadAsync(archivo); })
      .then(function (zip) {
        if (tipo === 'pptx') {
          var n = 0;
          zip.forEach(function (ruta) { if (/^ppt\/slides\/slide\d+\.xml$/.test(ruta)) n++; });
          return { diapositivas: n };
        }
        var doc = zip.file('word/document.xml');
        if (!doc) return {};
        return doc.async('string').then(function (xml) {
          var texto = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          var palabras = texto ? texto.split(' ').length : 0;
          var imagenes = 0;
          zip.forEach(function (ruta) { if (/^word\/media\//.test(ruta)) imagenes++; });
          return { palabras: palabras, paginasAprox: Math.max(1, Math.round(palabras / 380)), imagenes: imagenes };
        });
      })
      .catch(function () { return {}; });
  }

  /* ------------------------------------------------------- reglas por modulo */
  function validar(archivo) {
    var req = CFG.requisitos || {};
    var e = ext(archivo.name);
    var puntos = [];
    var bloqueante = false;

    // 1. formato
    var permitidos = (req.formatos || ['pdf']).map(function (x) { return x.toLowerCase(); });
    if (permitidos.indexOf(e) >= 0) {
      puntos.push({ tipo: 'si', texto: 'Formato .' + e + ' aceptado para esta actividad.' });
    } else {
      bloqueante = true;
      puntos.push({
        tipo: 'no',
        texto: 'Esta actividad se entrega en ' + permitidos.map(function (x) { return '.' + x; }).join(' o ') +
               '. Tu archivo es .' + (e || 'sin extensi\u00f3n') + '.'
      });
    }

    // 2. tamano
    if (archivo.size > MAX_MB * 1048576) {
      bloqueante = true;
      puntos.push({ tipo: 'no', texto: 'Pesa ' + bytes(archivo.size) + '. El l\u00edmite es ' + MAX_MB + ' MB. Comprime las im\u00e1genes antes de subirlo.' });
    } else if (archivo.size < 20000) {
      puntos.push({ tipo: 'duda', texto: 'Pesa solo ' + bytes(archivo.size) + '. Verifica que no sea un archivo vac\u00edo o incompleto.' });
    }

    // 3. inspeccion segun tipo
    var trabajo;
    if (e === 'pdf') {
      trabajo = contarPaginasPDF(archivo).then(function (paginas) {
        if (paginas === null) {
          puntos.push({ tipo: 'duda', texto: 'No se pudo leer el PDF para contar las p\u00e1ginas. \u00c1brelo y rev\u00edsalo t\u00fa.' });
          return;
        }
        var esDiapo = CFG.moduloNumero === 5;
        var unidad = plural(paginas, esDiapo ? 'diapositiva' : 'p\u00e1gina', esDiapo ? 'diapositivas' : 'p\u00e1ginas');
        var unidadPl = esDiapo ? 'diapositivas' : 'p\u00e1ginas';
        var min = req.paginasMin || 0;
        if (min && paginas < min) {
          puntos.push({ tipo: 'no', texto: 'Tiene ' + paginas + ' ' + unidad + ' y el m\u00ednimo exigido es ' + min + '. Te ' + plural(min - paginas, 'falta', 'faltan') + ' ' + (min - paginas) + '.' });
        } else if (min) {
          puntos.push({ tipo: 'si', texto: 'Tiene ' + paginas + ' ' + unidad + ', cumple el m\u00ednimo de ' + min + '.' });
        } else {
          puntos.push({ tipo: 'si', texto: 'Tiene ' + paginas + ' ' + unidad + '.' });
        }
        if (req.paginasMax && paginas > req.paginasMax) {
          puntos.push({ tipo: 'duda', texto: 'El enunciado sugiere m\u00e1ximo ' + req.paginasMax + ' ' + unidadPl + '. Revisa si puedes recortar.' });
        }
      });
    } else if (['png', 'jpg', 'jpeg', 'webp'].indexOf(e) >= 0) {
      trabajo = medirImagen(archivo).then(function (m) {
        if (!m) { puntos.push({ tipo: 'duda', texto: 'No se pudieron leer las dimensiones de la imagen.' }); return; }
        var minAncho = req.anchoMin || 0;
        if (minAncho && m.ancho < minAncho) {
          puntos.push({ tipo: 'no', texto: 'La imagen mide ' + m.ancho + ' \u00d7 ' + m.alto + ' px. El m\u00ednimo exigido es ' + minAncho + ' px de ancho. Exp\u00f3rtala de nuevo en alta resoluci\u00f3n.' });
        } else {
          puntos.push({ tipo: 'si', texto: 'La imagen mide ' + m.ancho + ' \u00d7 ' + m.alto + ' px' + (minAncho ? ', cumple el m\u00ednimo de ' + minAncho + ' px de ancho.' : '.') });
        }
      });
    } else if (e === 'pptx') {
      trabajo = inspeccionarOffice(archivo, 'pptx').then(function (d) {
        if (!d || typeof d.diapositivas !== 'number') { puntos.push({ tipo: 'duda', texto: 'No se pudo contar las diapositivas.' }); return; }
        var min = req.paginasMin || 0;
        if (min && d.diapositivas < min) {
          puntos.push({ tipo: 'no', texto: 'Tiene ' + d.diapositivas + ' ' + plural(d.diapositivas, 'diapositiva', 'diapositivas') + ' y el m\u00ednimo exigido es ' + min + '. Te ' + plural(min - d.diapositivas, 'falta', 'faltan') + ' ' + (min - d.diapositivas) + '.' });
        } else {
          puntos.push({ tipo: 'si', texto: 'Tiene ' + d.diapositivas + ' ' + plural(d.diapositivas, 'diapositiva', 'diapositivas') + (min ? ', cumple el m\u00ednimo de ' + min + '.' : '.') });
        }
      });
    } else if (e === 'docx') {
      trabajo = inspeccionarOffice(archivo, 'docx').then(function (d) {
        if (!d || !d.palabras) { puntos.push({ tipo: 'duda', texto: 'No se pudo analizar el documento de Word.' }); return; }
        var min = req.paginasMin || 0;
        puntos.push({ tipo: 'si', texto: 'Contiene ' + d.palabras.toLocaleString('es-CO') + ' palabras, unas ' + d.paginasAprox + ' ' + plural(d.paginasAprox, 'p\u00e1gina', 'p\u00e1ginas') + ' aproximadas.' });
        if (min && d.paginasAprox < min) {
          puntos.push({ tipo: 'duda', texto: 'El m\u00ednimo son ' + min + ' p\u00e1ginas. Word pagina distinto seg\u00fan el formato, as\u00ed que \u00e1brelo y confirma el n\u00famero real antes de entregar.' });
        }
        if (req.imagenesMin) {
          if (d.imagenes >= req.imagenesMin) {
            puntos.push({ tipo: 'si', texto: 'Incluye ' + d.imagenes + ' ' + plural(d.imagenes, 'imagen o captura', 'im\u00e1genes o capturas') + ', cumple el m\u00ednimo de ' + req.imagenesMin + '.' });
          } else {
            puntos.push({ tipo: 'no', texto: 'Incluye ' + d.imagenes + ' ' + plural(d.imagenes, 'imagen', 'im\u00e1genes') + ' y el enunciado exige m\u00ednimo ' + req.imagenesMin + ' capturas o diagramas.' });
          }
        }
      });
    } else {
      trabajo = Promise.resolve();
    }

    return trabajo.then(function () {
      var hayNo = puntos.some(function (p) { return p.tipo === 'no'; });
      return { puntos: puntos, apto: !bloqueante && !hayNo, bloqueante: bloqueante };
    });
  }

  /* ------------------------------------------------------- nombre normalizado */
  function nombreFinal(archivo) {
    return 'M' + CFG.moduloNumero + '_' + limpiar(CFG.moduloCorto) + '_' +
      limpiar(CFG.estudiante) + '_' + hoy() + '.' + ext(archivo.name);
  }

  /* ------------------------------------------------------------------ interfaz */
  var estado = [];

  function pinta() {
    var lista = $('#lista-archivos');
    var accion = $('#acciones-entrega');
    if (!lista) return;
    lista.innerHTML = '';

    if (!estado.length) {
      if (accion) accion.classList.add('oculto');
      return;
    }
    if (accion) accion.classList.remove('oculto');

    estado.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = 'archivo';

      var ic = document.createElement('div');
      ic.className = 'ic';
      ic.textContent = (ext(it.archivo.name) || '?').toUpperCase().slice(0, 4);

      var info = document.createElement('div');
      info.className = 'info';

      var nom = document.createElement('span');
      nom.className = 'nom';
      nom.textContent = it.nombreFinal;

      var met = document.createElement('span');
      met.className = 'met';
      met.textContent = 'Original: ' + (it.original || it.archivo.name) + '  ·  ' + bytes(it.archivo.size);

      info.appendChild(nom);
      info.appendChild(met);

      var dic = document.createElement('div');
      dic.className = 'dictamen';
      if (!it.revision) {
        var esperando = document.createElement('div');
        esperando.innerHTML = '<span class="marca duda">·</span><span>Revisando el archivo…</span>';
        dic.appendChild(esperando);
      } else {
        it.revision.puntos.forEach(function (p) {
          var d = document.createElement('div');
          var marca = document.createElement('span');
          marca.className = 'marca ' + p.tipo;
          marca.textContent = p.tipo === 'si' ? '✓' : p.tipo === 'no' ? '✕' : '!';
          var txt = document.createElement('span');
          txt.className = p.tipo;
          txt.textContent = p.texto;
          d.appendChild(marca); d.appendChild(txt);
          dic.appendChild(d);
        });
      }
      info.appendChild(dic);

      if (it.progreso != null) {
        var b = document.createElement('div');
        b.className = 'barra';
        b.innerHTML = '<i style="width:' + it.progreso + '%"></i>';
        info.appendChild(b);
      }

      var quitar = document.createElement('button');
      quitar.className = 'quitar';
      quitar.type = 'button';
      quitar.title = 'Quitar este archivo';
      quitar.setAttribute('aria-label', 'Quitar ' + it.nombreFinal);
      quitar.textContent = '×';
      quitar.onclick = function () {
        borrarLocal(it.id);
        estado.splice(i, 1);
        pinta();
      };

      li.appendChild(ic); li.appendChild(info); li.appendChild(quitar);
      lista.appendChild(li);
    });

    var listos = estado.filter(function (x) { return x.revision && x.revision.apto; }).length;
    var res = $('#resumen-estado');
    if (res) {
      if (listos === estado.length) {
        res.className = 'aviso bien';
        res.innerHTML = '<strong>Todo en orden</strong><p>' + listos + ' de ' + nArch(estado.length) +
          ' ' + plural(listos, 'cumple', 'cumplen') + ' los requisitos de la actividad. Ya puedes descargar tu entrega con el nombre correcto y subirla a tu carpeta de SharePoint.</p>';
      } else {
        res.className = 'aviso ojo';
        res.innerHTML = '<strong>Revisa lo marcado en rojo</strong><p>' + listos + ' de ' + nArch(estado.length) +
          ' ' + plural(listos, 'cumple', 'cumplen') + ' los requisitos. Corrige los puntos se\u00f1alados y vuelve a cargar el archivo; si entregas as\u00ed, pierdes puntos.</p>';
      }
    }
  }

  function agregar(archivos) {
    Array.prototype.forEach.call(archivos, function (archivo) {
      var it = {
        id: CFG.clave + '::' + archivo.name + '::' + archivo.size,
        archivo: archivo,
        original: archivo.name,
        nombreFinal: nombreFinal(archivo),
        revision: null,
        progreso: null
      };
      estado = estado.filter(function (x) { return x.id !== it.id; });
      estado.push(it);
      pinta();
      validar(archivo).then(function (r) {
        it.revision = r;
        pinta();
        guardarLocal({
          id: it.id, clave: CFG.clave, estudiante: CFG.estudiante,
          modulo: CFG.moduloNumero, nombre: it.nombreFinal, original: archivo.name,
          tamano: archivo.size, fecha: new Date().toISOString(), blob: archivo
        });
      });
    });
  }

  function descargarUno(it) {
    var url = URL.createObjectURL(it.archivo);
    var a = document.createElement('a');
    a.href = url; a.download = it.nombreFinal;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function descargarTodo() {
    if (estado.length === 1) return descargarUno(estado[0]);
    cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js').then(function () {
      var zip = new window.JSZip();
      estado.forEach(function (it) { zip.file(it.nombreFinal, it.archivo); });
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'M' + CFG.moduloNumero + '_' + limpiar(CFG.estudiante) + '_entrega.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  function enviarServidor() {
    if (!CFG.endpoint) return;
    var boton = $('#btn-enviar');
    if (boton) { boton.disabled = true; boton.textContent = 'Enviando…'; }

    var tareas = estado.map(function (it) {
      var fd = new FormData();
      fd.append('archivo', it.archivo, it.nombreFinal);
      fd.append('estudiante', CFG.estudiante);
      fd.append('modulo', String(CFG.moduloNumero));
      fd.append('actividad', CFG.moduloCorto);
      it.progreso = 10; pinta();
      return fetch(CFG.endpoint, { method: 'POST', body: fd })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { it.progreso = 100; it.enlace = d.url; pinta(); return true; })
        .catch(function () { it.progreso = null; pinta(); return false; });
    });

    Promise.all(tareas).then(function (res) {
      var bien = res.filter(Boolean).length;
      var caja = $('#resumen-envio');
      if (caja) {
        caja.classList.remove('oculto');
        caja.className = bien === res.length ? 'aviso bien' : 'aviso alerta';
        caja.innerHTML = bien === res.length
          ? '<strong>Enviado al servidor del curso</strong><p>Se ' + plural(bien, 'recibi\u00f3', 'recibieron') + ' ' + nArch(bien) + '. Igual sube tu entrega a la carpeta de SharePoint, que es el canal oficial de calificaci\u00f3n.</p>'
          : '<strong>El env\u00edo al servidor fall\u00f3</strong><p>Se ' + plural(bien, 'envi\u00f3', 'enviaron') + ' ' + bien + ' de ' + res.length + '. Usa el bot\u00f3n de descargar y sube el archivo directamente a SharePoint.</p>';
      }
      if (boton) { boton.disabled = false; boton.textContent = 'Enviar al servidor del curso'; }
    });
  }

  /* ------------------------------------------------------------------ arranque */
  function iniciar() {
    var zona = $('#zona-carga');
    var input = $('#entrada-archivo');
    if (!zona || !input) return;

    zona.addEventListener('click', function () { input.click(); });
    zona.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () { agregar(input.files); input.value = ''; });

    ['dragenter', 'dragover'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('encima'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.remove('encima'); });
    });
    zona.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) agregar(e.dataTransfer.files);
    });

    var bajar = $('#btn-descargar');
    if (bajar) bajar.addEventListener('click', descargarTodo);

    var enviar = $('#btn-enviar');
    if (enviar) {
      if (CFG.endpoint) enviar.addEventListener('click', enviarServidor);
      else enviar.classList.add('oculto');
    }

    // recuperar lo que el estudiante ya habia cargado en este navegador
    leerLocal(CFG.clave + '::').then(function (guardados) {
      if (!guardados.length) return;
      var caja = $('#recuperados');
      if (!caja) return;
      caja.classList.remove('oculto');
      caja.className = 'aviso';
      caja.innerHTML = '<strong>Recuperamos tu trabajo anterior</strong>' +
        '<p>Ya hab\u00edas cargado ' + nArch(guardados.length) + ' en este navegador. ' +
        (guardados.length === 1 ? 'Aparece' : 'Aparecen') +
        ' abajo con la revisi\u00f3n al d\u00eda. Si vas a entregar otra versi\u00f3n, qu\u00edtalo y carga la nueva.</p>';
      guardados.forEach(function (g) {
        if (!g.blob) return;
        if (estado.some(function (x) { return x.id === g.id; })) return;
        var it = {
          id: g.id,
          archivo: new File([g.blob], g.original || g.nombre, { type: g.blob.type }),
          original: g.original || g.nombre,
          nombreFinal: g.nombre, revision: null, progreso: null
        };
        estado.push(it);
        validar(it.archivo).then(function (r) { it.revision = r; pinta(); });
      });
      pinta();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
