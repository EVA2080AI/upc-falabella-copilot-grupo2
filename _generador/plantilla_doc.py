# -*- coding: utf-8 -*-
"""Convierte el HTML de un tutorial en un archivo .doc que Word abre con formato."""

CABECERA = u"""<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<meta name="Originator" content="Microsoft Word 15">
<title>__TITULO__</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml><![endif]-->
<style>
@page {
  size: 21.59cm 27.94cm;
  margin: 2.2cm 2.0cm 2.2cm 2.0cm;
  mso-header-margin: 1.2cm;
  mso-footer-margin: 1.2cm;
  mso-paper-source: 0;
}
div.Section1 { page: Section1; }

body {
  font-family: "Aptos", "Calibri", "Segoe UI", sans-serif;
  font-size: 11.0pt;
  line-height: 1.42;
  color: #1B2A22;
  margin: 0;
}

/* ---------------- portada del tutorial ---------------- */
h1 {
  font-family: "Aptos Display", "Calibri Light", "Segoe UI Semibold", sans-serif;
  font-size: 25.0pt;
  line-height: 1.14;
  color: #0B7A43;
  font-weight: bold;
  margin: 0 0 6pt 0;
  letter-spacing: -0.3pt;
  border-bottom: 3.0pt solid #0B7A43;
  padding-bottom: 9pt;
}
p.sub {
  font-size: 13.0pt;
  color: #41544B;
  margin: 0 0 10pt 0;
  line-height: 1.34;
}
div.meta {
  font-size: 8.8pt;
  color: #FFFFFF;
  background: #0B7A43;
  padding: 7pt 11pt;
  margin: 0 0 17pt 0;
  letter-spacing: 0.5pt;
  text-transform: uppercase;
  font-weight: bold;
  mso-shading: #0B7A43;
}

h2 {
  font-family: "Aptos Display", "Calibri Light", "Segoe UI Semibold", sans-serif;
  font-size: 15.5pt;
  color: #0B7A43;
  font-weight: bold;
  margin: 21pt 0 7pt 0;
  padding-bottom: 4pt;
  border-bottom: 1.0pt solid #C9DED3;
  page-break-after: avoid;
}
h3 {
  font-size: 12.0pt;
  color: #14201A;
  font-weight: bold;
  margin: 15pt 0 5pt 0;
  page-break-after: avoid;
}
p { margin: 0 0 8pt 0; }
ul, ol { margin: 0 0 10pt 0; padding-left: 20pt; }
li { margin-bottom: 4pt; }
strong, b { color: #0B5B33; }

/* ---------------- pasos numerados ---------------- */
div.step {
  margin: 0 0 13pt 0;
  padding: 11pt 13pt 8pt 13pt;
  border: 0.75pt solid #DDE6E1;
  border-left: 3.5pt solid #0B7A43;
  background: #FBFDFC;
  mso-shading: #FBFDFC;
  page-break-inside: avoid;
}
div.step span.num {
  font-family: "Aptos Display", "Calibri", sans-serif;
  font-size: 15.0pt;
  font-weight: bold;
  color: #FFFFFF;
  background: #0B7A43;
  mso-shading: #0B7A43;
  padding: 2pt 9pt;
  margin-right: 8pt;
}
div.stepbody { margin-top: 7pt; }
p.time {
  font-size: 9.0pt;
  color: #0B7A43;
  font-weight: bold;
  font-style: italic;
  margin: 6pt 0 0 0;
}

/* ---------------- prompts para copiar ---------------- */
div.prompt {
  margin: 9pt 0 11pt 0;
  border: 0.75pt solid #B9CFC3;
  background: #F2F8F5;
  mso-shading: #F2F8F5;
  padding: 0;
  page-break-inside: avoid;
}
span.ptag {
  display: block;
  background: #0B7A43;
  mso-shading: #0B7A43;
  color: #FFFFFF;
  font-size: 8.0pt;
  font-weight: bold;
  letter-spacing: 0.9pt;
  padding: 4pt 10pt;
  text-transform: uppercase;
}
div.prompt pre {
  font-family: "Cascadia Mono", "Consolas", "Courier New", monospace;
  font-size: 9.2pt;
  line-height: 1.42;
  color: #14201A;
  margin: 0;
  padding: 9pt 11pt;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* ---------------- cajas de aviso ---------------- */
div.callout, div.warn, div.ok {
  margin: 10pt 0 12pt 0;
  padding: 9pt 12pt;
  border-left: 3.5pt solid #1D5FA8;
  background: #EAF1FA;
  mso-shading: #EAF1FA;
  font-size: 10.4pt;
  page-break-inside: avoid;
}
div.warn { border-left-color: #C62828; background: #FDECEC; mso-shading: #FDECEC; }
div.ok   { border-left-color: #0B7A43; background: #E7F6EE; mso-shading: #E7F6EE; }
div.callout p, div.warn p, div.ok p { margin: 0 0 5pt 0; }
div.callout p:last-child, div.warn p:last-child, div.ok p:last-child { margin-bottom: 0; }
div.ok ul, div.warn ul, div.callout ul { margin-bottom: 0; }

/* ---------------- tablas ---------------- */
table.t {
  border-collapse: collapse;
  width: 100%;
  margin: 9pt 0 13pt 0;
  font-size: 10.0pt;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
}
table.t th {
  background: #0B7A43;
  mso-shading: #0B7A43;
  color: #FFFFFF;
  font-weight: bold;
  text-align: left;
  padding: 6pt 8pt;
  border: 0.5pt solid #0B7A43;
  font-size: 9.4pt;
}
table.t td {
  padding: 6pt 8pt;
  border: 0.5pt solid #D5E3DB;
  vertical-align: top;
}
table.t tr:nth-child(even) td { background: #F6FAF8; mso-shading: #F6FAF8; }

span.kbd {
  font-family: "Cascadia Mono", "Consolas", monospace;
  font-size: 9.4pt;
  background: #EDF3F0;
  mso-shading: #EDF3F0;
  border: 0.5pt solid #C9DED3;
  padding: 1pt 4pt;
  color: #0B5B33;
  font-weight: bold;
}

div.pagebreak {
  page-break-before: always;
  mso-special-character: line-break;
  height: 0;
  font-size: 1pt;
}
</style>
</head>
<body lang="ES-CO">
<div class="Section1">
"""

PIE = u"""
<div class="callout" style="margin-top:20pt">
<p><b>Universidad Piloto de Colombia &nbsp;&middot;&nbsp; Falabella &nbsp;&middot;&nbsp; Grupo 2 &nbsp;&middot;&nbsp; Curso Microsoft Copilot Chat</b></p>
<p style="font-size:9.5pt">Sube tu entrega a tu carpeta personal en SharePoint, dentro de la carpeta de este m&oacute;dulo. En la p&aacute;gina <b>index.html</b> de esa misma carpeta tienes un cargador que revisa el archivo antes de que lo entregues.</p>
</div>
</div>
</body>
</html>
"""


def construir(titulo, cuerpo_html):
    return CABECERA.replace("__TITULO__", titulo) + cuerpo_html + PIE
