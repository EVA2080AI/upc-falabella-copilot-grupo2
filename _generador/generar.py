# -*- coding: utf-8 -*-
"""
Genera la estructura completa del portal de entregas.

  UNIVERSIDAD piloto grupo 2 Falabella/
    index.html                          portal general con los 22 estudiantes
    Estudiantes/<Nombre>/index.html     panel del estudiante con sus 5 modulos
    Estudiantes/<Nombre>/<Modulo>/      pdf de la actividad + tutorial .doc + cargador

Se ejecuta con:  python3 _generador/generar.py
"""
import io, json, os, shutil, sys, unicodedata, html, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from datos import CURSO, MODULOS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_EST = os.path.join(RAIZ, "Estudiantes")
DIR_PDF = os.path.join(RAIZ, "_assets", "pdf")
DIR_TUT = os.path.join(RAIZ, "_assets", "tutoriales")
HOY = datetime.date.today().strftime("%d de %B de %Y")

# Mapa de carpetas de Google Drive, si ya se creo la estructura alli.
# Formato: {"<nombre del estudiante>": {"id": "...", "modulos": {"1": "...", ...}}}
#
# Los enlaces de Drive dan permiso de ESCRITURA sobre las entregas, asi que no
# deben quedar en un sitio publico: cualquiera con el enlace podria borrarlas.
# Con PORTAL_PUBLICO=1 se genera la version sin ellos, apta para publicar.
PUBLICO = os.environ.get("PORTAL_PUBLICO") == "1"

DRIVE = {}
_ruta_drive = os.path.join(RAIZ, "_assets", "drive.json")
if os.path.exists(_ruta_drive) and not PUBLICO:
    DRIVE = json.load(io.open(_ruta_drive, encoding="utf-8"))


def drive_url(nombre, modulo=None):
    """Enlace a la carpeta de Drive del estudiante, o de uno de sus modulos."""
    reg = DRIVE.get(nombre)
    if not reg:
        return None
    ident = reg["id"] if modulo is None else reg.get("modulos", {}).get(str(modulo))
    return ("https://drive.google.com/drive/folders/" + ident) if ident else None


def ascii_seguro(t):
    """Quita tildes y enies para que las rutas funcionen en cualquier servidor."""
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.replace("ñ", "n").replace("Ñ", "N")


def slug(t):
    base = ascii_seguro(t)
    out = "".join(c if (c.isalnum() or c in " -") else "-" for c in base)
    return "-".join(out.split())


def e(t):
    return html.escape(str(t), quote=True)


def iniciales(nombre):
    partes = [p for p in ascii_seguro(nombre).split() if p]
    if len(partes) == 1:
        return partes[0][:2].upper()
    return (partes[0][0] + partes[-1][0]).upper()


def sp_url(carpeta_sp, sub=None):
    ruta = CURSO["sp_ruta_base"] + "/" + carpeta_sp
    if sub:
        ruta += "/" + sub
    from urllib.parse import quote
    return (CURSO["sp_sitio"] + "/_layouts/15/onedrive.aspx?id=" + quote(ruta, safe="")
            + "&view=0")


# ---------------------------------------------------------------- plantillas
def envoltura(titulo, prof, cuerpo, migas_html, encabezado_html, extra_head="", extra_body=""):
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(prof)}">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8E%93%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="{'../' * prof}assets/estilos.css">
{extra_head}
</head>
<body>
<header class="cabecera">
  <div class="envoltura-ancha">
    <div class="marca"><span class="punto"></span> {e(CURSO['institucion'])} &nbsp;·&nbsp; {e(CURSO['empresa'])} &nbsp;·&nbsp; {e(CURSO['grupo'])}</div>
    {migas_html}
    {encabezado_html}
  </div>
</header>
<main>
  <div class="envoltura-ancha">
{cuerpo}
  </div>
</main>
<footer class="pie-pagina">
  <div class="envoltura-ancha">
    <div>Curso {e(CURSO['titulo'])} &nbsp;·&nbsp; {e(CURSO['institucion'])} &nbsp;·&nbsp; {e(CURSO['empresa'])} {e(CURSO['grupo'])}</div>
    <div><a href="{e(CURSO['sp_carpeta'])}" target="_blank" rel="noopener">Carpeta oficial en SharePoint</a></div>
  </div>
</footer>
{extra_body}
</body>
</html>
"""


def migas(items, prof):
    trozos = []
    for i, (txt, href) in enumerate(items):
        if i:
            trozos.append('<span class="sep">/</span>')
        if href:
            trozos.append(f'<a href="{e(href)}">{e(txt)}</a>')
        else:
            trozos.append(f"<span>{e(txt)}</span>")
    return '<nav class="migas">' + "".join(trozos) + "</nav>"


# ------------------------------------------------------------------- portada
def pagina_portada(estudiantes):
    tarjetas = []
    for est in estudiantes:
        carpeta = est["carpeta"]
        tarjetas.append(f"""      <a class="tarjeta busca" data-nombre="{e(ascii_seguro(est['nombre']).lower())}" href="Estudiantes/{e(carpeta)}/index.html">
        <div class="fila-avatar">
          <div class="avatar">{e(iniciales(est['nombre']))}</div>
          <div style="min-width:0">
            <span class="nombre">{e(est['nombre'])}</span>
            <span class="detalle">Microsoft Copilot Chat</span>
          </div>
        </div>
        <div class="pie"><span>Módulos 1 a 5</span><span class="eti">Abrir carpeta</span></div>
      </a>""")

    filas_mod = "\n".join(
        f"""        <tr>
          <td><strong>Módulo {m['n']}</strong><br><span style="color:var(--tinta-3);font-size:.86rem">{e(m['actividad'])}</span></td>
          <td>{e(m['titulo'])}<br><span style="color:var(--tinta-3);font-size:.86rem">{e(m['resumen'])}</span></td>
          <td>{e(m['formato_txt'])}</td>
          <td>{e(m['modalidad'])}</td>
          <td><span class="eti">{e(m['peso'])}</span></td>
        </tr>""" for m in MODULOS)

    cuerpo = f"""    <div class="rejilla-2" style="margin-bottom:30px;align-items:start">
      <div class="caja">
        <h2 style="margin-top:0">Cómo funciona este portal</h2>
        <p class="apunte">Cada estudiante tiene su carpeta. Dentro hay una carpeta por módulo, y en cada una encontrarás tres cosas: el <strong>PDF oficial de la actividad</strong>, un <strong>tutorial paso a paso</strong> para resolverla rápido con Copilot aunque no tengas licencia de pago, y un <strong>cargador que revisa tu archivo</strong> antes de que lo entregues.</p>
        <div class="aviso bien"><strong>El cargador revisa por ti</strong><p>Cuenta las páginas del PDF, mide los píxeles de la infografía, cuenta las diapositivas de la presentación y las capturas del manual. Te dice qué falta antes de que el docente lo vea.</p></div>
      </div>
      <div class="caja">
        <h2 style="margin-top:0">Los cinco módulos</h2>
        <table class="datos">
          <thead><tr><th>Módulo</th><th>Actividad</th><th>Formato</th><th>Modalidad</th><th>Peso</th></tr></thead>
          <tbody>
{filas_mod}
          </tbody>
        </table>
      </div>
    </div>

    <h2 id="estudiantes">Estudiantes del grupo <span class="eti gris" id="contador">{len(estudiantes)}</span></h2>
    <p class="apunte">Busca tu nombre y entra a tu carpeta. Si tu nombre está mal escrito o no aparece, avísale al instructor.</p>
    <div class="buscador">
      <span class="lupa" aria-hidden="true">⌕</span>
      <label class="solo-lectores" for="q">Buscar estudiante</label>
      <input id="q" type="search" placeholder="Escribe tu nombre…" autocomplete="off">
    </div>
    <div class="rejilla" id="rejilla-est">
{chr(10).join(tarjetas)}
    </div>
    <p class="apunte oculto" id="sin-resultados" style="margin-top:16px">No hay ningún estudiante con ese nombre. Revisa cómo lo escribiste.</p>
"""
    script = """<script>
(function(){
  var q=document.getElementById('q'), tarjetas=[].slice.call(document.querySelectorAll('.busca')),
      cont=document.getElementById('contador'), vacio=document.getElementById('sin-resultados');
  function norm(t){return t.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();}
  q.addEventListener('input',function(){
    var t=norm(q.value.trim()), n=0;
    tarjetas.forEach(function(c){
      var ver=!t||c.dataset.nombre.indexOf(t)>=0;
      c.classList.toggle('oculto',!ver); if(ver)n++;
    });
    cont.textContent=n; vacio.classList.toggle('oculto',n>0);
  });
})();
</script>"""
    enc = f"""<h1>Portal de entregas del curso</h1>
    <p class="lema">Microsoft Copilot Chat. Tu carpeta, tus cinco módulos, el PDF de cada actividad, el tutorial para resolverla rápido y un cargador que revisa tu archivo antes de entregarlo.</p>"""
    return envoltura(
        f"Portal de entregas · {CURSO['empresa']} {CURSO['grupo']}",
        0,
        cuerpo,
        migas([("Portal", None)], 0),
        enc,
        extra_body=script,
    )


# --------------------------------------------------------- panel del estudiante
def pagina_estudiante(est):
    du = drive_url(est["nombre"])
    bloque_drive_est = (
        f'<a class="btn pequeno principal" href="{e(du)}" target="_blank" rel="noopener" '
        f'style="margin-right:8px">Abrir mi carpeta en Google Drive ↗</a>'
    ) if du else ""
    tarjetas = []
    for m in MODULOS:
        tarjetas.append(f"""      <a class="tarjeta" href="{e(m['carpeta'])}/index.html">
        <div class="mod">
          <div class="num">{m['n']}</div>
          <div class="cuerpo">
            <span class="nombre">{e(m['titulo'])}</span>
            <p class="desc">{e(m['resumen'])}</p>
          </div>
        </div>
        <div class="pie"><span>{e(m['modalidad'])}</span><span class="eti">{e(m['peso'])}</span></div>
      </a>""")

    cuerpo = f"""    <div class="aviso bien" style="margin-top:0">
      <strong>Dónde subes tus entregas</strong>
      <p>Tienes tu propia carpeta, con una subcarpeta por cada módulo. Sube ahí el archivo del módulo que corresponda. Este portal te prepara y revisa el archivo antes; la carpeta es donde el docente lo recoge y lo califica.</p>
      <p style="margin-top:9px">{bloque_drive_est}<a class="btn pequeno" href="{e(sp_url(est['carpetaSP']))}" target="_blank" rel="noopener">Abrir mi carpeta en SharePoint ↗</a></p>
    </div>

    <h2>Tus cinco módulos</h2>
    <p class="apunte">Entra a cada módulo para descargar el PDF de la actividad, abrir el tutorial paso a paso y preparar tu entrega.</p>
    <div class="rejilla">
{chr(10).join(tarjetas)}
    </div>

    <h2>Qué hay dentro de cada módulo</h2>
    <div class="rejilla-2">
      <div class="caja">
        <h3 style="margin-top:0">📄 El PDF oficial de la actividad</h3>
        <p class="apunte" style="margin-bottom:0">El enunciado tal como lo entrega la universidad: qué es, objetivo de aprendizaje, criterios de evaluación, estructura sugerida e instrucciones de entrega.</p>
      </div>
      <div class="caja">
        <h3 style="margin-top:0">📝 El tutorial paso a paso (.doc)</h3>
        <p class="apunte" style="margin-bottom:0">Cómo resolver la actividad rápido con Copilot, con los prompts ya escritos para copiar y pegar. Está pensado para quien <strong>no tiene licencia de pago</strong> de Microsoft 365 Copilot.</p>
      </div>
      <div class="caja">
        <h3 style="margin-top:0">⬆️ El cargador de archivos</h3>
        <p class="apunte" style="margin-bottom:0">Arrastra tu entrega y el portal la revisa: páginas, resolución, diapositivas y capturas. Te la renombra con el formato del curso y te la deja lista para subir.</p>
      </div>
    </div>
"""
    enc = f"""<h1>{e(est['nombre'])}</h1>
    <p class="lema">{e(est['email']) if est['email'] else 'Estudiante del grupo 2'} &nbsp;·&nbsp; 5 módulos del curso Microsoft Copilot Chat</p>"""
    return envoltura(
        f"{est['nombre']} · Entregas del curso",
        2,
        cuerpo,
        migas([("Portal", "../../index.html"), (est["nombre"], None)], 2),
        enc,
    )


# ------------------------------------------------------------ pagina de modulo
def pagina_modulo(est, m, tiene_tutorial):
    crit = "\n".join(f"          <li>{e(c)}</li>" for c in m["criterios"])
    entr = "\n".join(f"          <li>{e(x)}</li>" for x in m["entregables"])
    formatos = ", ".join("." + f for f in m["requisitos"]["formatos"])

    reglas = []
    r = m["requisitos"]
    if r.get("paginasMin"):
        unidad = "diapositivas" if m["n"] == 5 else "páginas"
        reglas.append(f"mínimo {r['paginasMin']} {unidad}")
    if r.get("paginasMax"):
        reglas.append(f"máximo sugerido {r['paginasMax']} páginas")
    if r.get("anchoMin"):
        reglas.append(f"mínimo {r['anchoMin']} px de ancho si entregas imagen")
    if r.get("imagenesMin"):
        reglas.append(f"mínimo {r['imagenesMin']} capturas o diagramas")
    reglas_txt = " · ".join(reglas) if reglas else "sin mínimo de extensión"

    du = drive_url(est["nombre"], m["n"])
    spu = sp_url(est["carpetaSP"], m["sp"])
    destino_txt = "Google Drive" if du else "SharePoint"
    destino_url = du or spu

    boton_drive_arriba = (
        f'<a class="btn sutil" href="{e(du)}" target="_blank" rel="noopener">'
        f'📂 Mi carpeta de este módulo en Google Drive ↗</a>\n            '
    ) if du else ""

    boton_drive_entrega = (
        f'<a class="btn principal" href="{e(du)}" target="_blank" rel="noopener">'
        f'☁️ Subirlo a Google Drive ↗</a>\n          '
    ) if du else ""

    tut_nombre = f"Tutorial Modulo {m['n']} - {slug(m['titulo'])}.doc"
    bloque_tut = (
        f"""        <a class="btn principal" href="{e(tut_nombre)}" download>📝 Abrir el tutorial paso a paso (.doc)</a>"""
        if tiene_tutorial else
        """        <span class="btn" style="opacity:.5">📝 Tutorial en preparación</span>"""
    )

    cfg = {
        "clave": f"{slug(est['nombre'])}::M{m['n']}",
        "estudiante": est["nombre"],
        "moduloNumero": m["n"],
        "moduloCorto": m["corto"],
        "requisitos": m["requisitos"],
        "endpoint": None,
    }

    cuerpo = f"""    <div class="rejilla-2" style="align-items:start">
      <div>
        <div class="caja">
          <h2 style="margin-top:0">Los tres archivos de este módulo</h2>
          <p class="apunte">Empieza por el tutorial. Trae los prompts ya escritos y está hecho para que puedas terminar sin licencia de pago de Copilot.</p>
          <div class="acciones" style="margin-top:4px">
{bloque_tut}
            <a class="btn" href="{e(m['pdf'])}" download>📄 Descargar el PDF de la actividad</a>
            {boton_drive_arriba}<a class="btn sutil" href="{e(spu)}" target="_blank" rel="noopener">📂 Mi carpeta de este módulo en SharePoint ↗</a>
          </div>
        </div>

        <h2>Prepara y revisa tu entrega</h2>
        <p class="apunte">Arrastra aquí tu archivo. Se revisa en tu propio navegador contra los requisitos oficiales de la actividad, sin enviarlo a ningún servidor. Después lo descargas ya renombrado y lo subes a tu carpeta de {e(destino_txt)} con el botón de abajo.</p>

        <div id="recuperados" class="aviso oculto"></div>

        <div class="zona" id="zona-carga" role="button" tabindex="0" aria-label="Seleccionar o arrastrar el archivo de la entrega">
          <div class="icono" aria-hidden="true">⬆️</div>
          <div class="titulo">Arrastra tu archivo aquí o haz clic para buscarlo</div>
          <p class="ayuda">Se acepta {e(formatos)} &nbsp;·&nbsp; {e(reglas_txt)}</p>
          <input type="file" id="entrada-archivo" multiple accept="{e(','.join('.' + f for f in m['requisitos']['formatos']))}">
        </div>

        <ul class="lista-archivos" id="lista-archivos"></ul>
        <div id="resumen-estado"></div>
        <div id="resumen-envio" class="aviso oculto"></div>

        <div class="acciones oculto" id="acciones-entrega">
          <button class="btn principal" type="button" id="btn-descargar">⬇️ Descargar con el nombre correcto</button>
          {boton_drive_entrega}<a class="btn sutil" href="{e(spu)}" target="_blank" rel="noopener">Subirlo a SharePoint ↗</a>
          <button class="btn" type="button" id="btn-enviar">Enviar al servidor del curso</button>
        </div>

        <div class="aviso ojo">
          <strong>El portal revisa el formato, no el contenido</strong>
          <p>Que el archivo pase la revisión significa que cumple los requisitos técnicos: formato, extensión y resolución. La nota la define el contenido según los criterios de evaluación de aquí al lado.</p>
        </div>
      </div>

      <aside>
        <div class="caja">
          <h3 style="margin-top:0">Ficha de la actividad</h3>
          <table class="datos">
            <tbody>
              <tr><th>Actividad</th><td>{e(m['actividad'])}</td></tr>
              <tr><th>Peso</th><td><span class="eti">{e(m['peso'])}</span> de la nota</td></tr>
              <tr><th>Formato</th><td>{e(m['formato_txt'])}</td></tr>
              <tr><th>Modalidad</th><td>{e(m['modalidad'])}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="caja" style="margin-top:14px">
          <h3 style="margin-top:0">Qué debes entregar</h3>
          <ul style="margin:0;padding-left:19px;font-size:.92rem;color:var(--tinta-2)">
{entr}
          </ul>
        </div>

        <div class="caja" style="margin-top:14px">
          <h3 style="margin-top:0">Con qué te califican</h3>
          <ul style="margin:0;padding-left:19px;font-size:.92rem;color:var(--tinta-2)">
{crit}
          </ul>
        </div>

        <div class="aviso alerta" style="margin-top:14px">
          <strong>Nunca pegues datos sensibles en la IA</strong>
          <p>Nada de cédulas, números de tarjeta, datos de clientes, nómina ni información confidencial de Falabella. Reemplázalos por «Cliente A» o «Proveedor 1» y usa rangos en vez de cifras exactas. Ley 1581 de 2012.</p>
        </div>
      </aside>
    </div>
"""
    enc = f"""<h1>Módulo {m['n']} · {e(m['titulo'])}</h1>
    <p class="lema">{e(m['resumen'])}</p>"""

    script = ("<script>window.PORTAL = " + json.dumps(cfg, ensure_ascii=False) +
              ";</script>\n<script src=\"../../../assets/cargador.js\" defer></script>")

    return envoltura(
        f"Módulo {m['n']} · {m['titulo']} · {est['nombre']}",
        3,
        cuerpo,
        migas([("Portal", "../../../index.html"), (est["nombre"], "../index.html"),
               (f"Módulo {m['n']}", None)], 3),
        enc,
        extra_body=script,
    )


# ------------------------------------------------------------------------ main
def main():
    estudiantes = json.load(io.open(os.path.join(RAIZ, "_assets", "estudiantes.json"), encoding="utf-8"))
    for est in estudiantes:
        est["carpeta"] = ascii_seguro(est["nombre"])

    os.makedirs(DIR_EST, exist_ok=True)
    creados = 0

    for est in estudiantes:
        base = os.path.join(DIR_EST, est["carpeta"])
        os.makedirs(base, exist_ok=True)
        io.open(os.path.join(base, "index.html"), "w", encoding="utf-8").write(pagina_estudiante(est))

        for m in MODULOS:
            d = os.path.join(base, m["carpeta"])
            os.makedirs(d, exist_ok=True)

            origen = os.path.join(DIR_PDF, m["pdf"])
            if os.path.exists(origen):
                shutil.copy2(origen, os.path.join(d, m["pdf"]))

            tut_src = os.path.join(DIR_TUT, "modulo-%d.doc" % m["n"])
            tut_dst = os.path.join(d, "Tutorial Modulo %d - %s.doc" % (m["n"], slug(m["titulo"])))
            tiene = os.path.exists(tut_src)
            if tiene:
                shutil.copy2(tut_src, tut_dst)

            io.open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(
                pagina_modulo(est, m, tiene))
            creados += 1

    io.open(os.path.join(RAIZ, "index.html"), "w", encoding="utf-8").write(
        pagina_portada(estudiantes))

    modo = "PUBLICA, sin enlaces de Drive" if PUBLICO else "privada, con enlaces de Drive"
    print("OK  %d estudiantes  ·  %d carpetas de modulo  ·  version %s"
          % (len(estudiantes), creados, modo))


if __name__ == "__main__":
    main()
