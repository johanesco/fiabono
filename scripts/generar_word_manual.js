const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  ImageRun
} = require('docx');

const DIR_MD = path.join(__dirname, '..', 'docs', 'manual-usuario');
const DIR_WORD = path.join(DIR_MD, 'word');

if (!fs.existsSync(DIR_WORD)) {
  fs.mkdirSync(DIR_WORD, { recursive: true });
}

// Paleta de Colores Oficial Fiabono
const COLORES = {
  NAVY: "0F172A",
  SLATE_DARK: "1E293B",
  SLATE_TEXT: "334155",
  SLATE_MUTED: "64748B",
  EMERALD: "047857",
  EMERALD_BG: "F0FDF4",
  EMERALD_LIGHT: "10B981",
  AMBER: "B45309",
  AMBER_BG: "FFFBEB",
  AMBER_BORDER: "F59E0B",
  ROSE: "BE123C",
  ROSE_BG: "FFF1F2",
  GRAY_BG: "F8FAFC",
  CODE_BG: "F1F5F9",
  BORDER_LIGHT: "E2E8F0"
};

/**
 * Parsea formato en línea: **negrita**, *cursiva*, `código`, $$fórmula$$
 */
function parseInline(text, defaultStyle = {}) {
  const runs = [];
  if (!text) return [new TextRun({ text: "", ...defaultStyle })];

  // Tokenizer con regex para bold, inline code, italic, math
  // Grupos: 1: bold (**...**), 2: code (`...`), 3: italic (*...*), 4: math ($...$)
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(\$([^$]+)\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({
        text: text.slice(lastIndex, match.index),
        font: defaultStyle.font || "Calibri",
        size: defaultStyle.size || 21, // 10.5 pt
        color: defaultStyle.color || COLORES.SLATE_TEXT,
        ...defaultStyle
      }));
    }

    if (match[1]) {
      // Bold
      runs.push(new TextRun({
        text: match[2],
        bold: true,
        font: defaultStyle.font || "Calibri",
        size: defaultStyle.size || 21,
        color: defaultStyle.color || COLORES.SLATE_DARK,
        ...defaultStyle
      }));
    } else if (match[3]) {
      // Inline Code
      runs.push(new TextRun({
        text: match[4],
        font: "Consolas",
        size: defaultStyle.size ? defaultStyle.size - 2 : 19,
        color: COLORES.EMERALD,
        shading: { fill: COLORES.CODE_BG, type: ShadingType.CLEAR }
      }));
    } else if (match[5]) {
      // Italic
      runs.push(new TextRun({
        text: match[6],
        italics: true,
        font: defaultStyle.font || "Calibri",
        size: defaultStyle.size || 21,
        color: defaultStyle.color || COLORES.SLATE_TEXT,
        ...defaultStyle
      }));
    } else if (match[7]) {
      // Math
      runs.push(new TextRun({
        text: match[8].replace(/\\text\{([^}]+)\}/g, '$1'),
        italics: true,
        font: "Calibri",
        size: defaultStyle.size || 21,
        color: COLORES.NAVY,
        bold: true
      }));
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({
      text: text.slice(lastIndex),
      font: defaultStyle.font || "Calibri",
      size: defaultStyle.size || 21,
      color: defaultStyle.color || COLORES.SLATE_TEXT,
      ...defaultStyle
    }));
  }

  return runs;
}

/**
 * Convierte un archivo Markdown en elementos docx
 */
function convertirMarkdownADocx(contenidoMd, rutaBase) {
  const lineas = contenidoMd.split(/\r?\n/);
  const elementos = [];

  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];
    const lineaTrim = linea.trim();

    // 1. Línea vacía
    if (!lineaTrim) {
      i++;
      continue;
    }

    // 2. Encabezados (#, ##, ###, ####)
    if (lineaTrim.startsWith('# ') && !lineaTrim.startsWith('## ')) {
      const texto = lineaTrim.replace(/^#\s+/, '');
      elementos.push(new Paragraph({
        children: parseInline(texto, { bold: true, color: COLORES.NAVY, size: 36 }), // 18pt
        spacing: { before: 240, after: 140 },
        heading: HeadingLevel.HEADING_1
      }));
      i++;
      continue;
    }

    if (lineaTrim.startsWith('## ')) {
      const texto = lineaTrim.replace(/^##\s+/, '');
      elementos.push(new Paragraph({
        children: parseInline(texto, { bold: true, color: COLORES.EMERALD, size: 28 }), // 14pt
        spacing: { before: 320, after: 100 },
        heading: HeadingLevel.HEADING_2
      }));
      i++;
      continue;
    }

    if (lineaTrim.startsWith('### ')) {
      const texto = lineaTrim.replace(/^###\s+/, '');
      elementos.push(new Paragraph({
        children: parseInline(texto, { bold: true, color: COLORES.SLATE_DARK, size: 24 }), // 12pt
        spacing: { before: 240, after: 80 },
        heading: HeadingLevel.HEADING_3
      }));
      i++;
      continue;
    }

    if (lineaTrim.startsWith('#### ')) {
      const texto = lineaTrim.replace(/^####\s+/, '');
      elementos.push(new Paragraph({
        children: parseInline(texto, { bold: true, color: COLORES.SLATE_MUTED, size: 22 }),
        spacing: { before: 180, after: 60 }
      }));
      i++;
      continue;
    }

    // 3. Separador horizontal (---)
    if (lineaTrim === '---' || lineaTrim === '***') {
      elementos.push(new Paragraph({
        text: "",
        spacing: { before: 100, after: 100 },
        border: {
          bottom: { color: COLORES.BORDER_LIGHT, size: 6, space: 1, style: BorderStyle.SINGLE }
        }
      }));
      i++;
      continue;
    }

    // 4. Bloques de Alerta o Metadatos (> ...)
    if (lineaTrim.startsWith('>')) {
      const lineasBloque = [];
      while (i < lineas.length && lineas[i].trim().startsWith('>')) {
        lineasBloque.push(lineas[i].trim().replace(/^>\s*/, ''));
        i++;
      }

      const contenidoTotal = lineasBloque.join('\n');
      const esTip = contenidoTotal.includes('[!TIP]');
      const esWarning = contenidoTotal.includes('[!WARNING]') || contenidoTotal.includes('[!CAUTION]');
      const esImportant = contenidoTotal.includes('[!IMPORTANT]') || contenidoTotal.includes('[!NOTE]');

      let colorBorde = COLORES.EMERALD_LIGHT;
      let colorFondo = COLORES.EMERALD_BG;
      let tituloAlerta = null;

      if (esWarning) {
        colorBorde = COLORES.ROSE;
        colorFondo = COLORES.ROSE_BG;
        tituloAlerta = "ADVERTENCIA IMPORTANTE";
      } else if (esTip) {
        colorBorde = COLORES.EMERALD_LIGHT;
        colorFondo = COLORES.EMERALD_BG;
        tituloAlerta = "CONSEJO PRÁCTICO";
      } else if (esImportant) {
        colorBorde = COLORES.AMBER_BORDER;
        colorFondo = COLORES.AMBER_BG;
        tituloAlerta = "INFORMACIÓN CLAVE";
      }

      const parrafosCallout = [];
      if (tituloAlerta) {
        parrafosCallout.push(new Paragraph({
          children: [new TextRun({ text: `📌 ${tituloAlerta}`, bold: true, color: colorBorde, size: 20 })],
          spacing: { after: 60 }
        }));
      }

      lineasBloque.forEach(lbl => {
        const lblLimpia = lbl.replace(/^\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
        if (lblLimpia.trim()) {
          parrafosCallout.push(new Paragraph({
            children: parseInline(lblLimpia, { size: 20, color: COLORES.SLATE_DARK }),
            spacing: { before: 30, after: 30 }
          }));
        }
      });

      const tablaCallout = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: parrafosCallout,
                shading: { fill: colorFondo, type: ShadingType.CLEAR },
                borders: {
                  left: { style: BorderStyle.SINGLE, size: 28, color: colorBorde },
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE }
                },
                margins: { top: 120, bottom: 120, left: 160, right: 160 }
              })
            ]
          })
        ]
      });

      elementos.push(tablaCallout);
      elementos.push(new Paragraph({ text: "", spacing: { after: 120 } }));
      continue;
    }

    // 5. Bloques de Código / Diagramas (``` ...)
    if (lineaTrim.startsWith('```')) {
      i++;
      const lineasCodigo = [];
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) {
        lineasCodigo.push(lineas[i]);
        i++;
      }
      i++; // saltar el cierre ```

      const parrafosCodigo = lineasCodigo.map(lc => new Paragraph({
        children: [new TextRun({ text: lc, font: "Consolas", size: 17, color: COLORES.NAVY })],
        spacing: { before: 15, after: 15 }
      }));

      const tablaCodigo = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: parrafosCodigo.length > 0 ? parrafosCodigo : [new Paragraph("")],
                shading: { fill: COLORES.CODE_BG, type: ShadingType.CLEAR },
                borders: {
                  left: { style: BorderStyle.SINGLE, size: 8, color: COLORES.BORDER_LIGHT },
                  top: { style: BorderStyle.SINGLE, size: 8, color: COLORES.BORDER_LIGHT },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORES.BORDER_LIGHT },
                  right: { style: BorderStyle.SINGLE, size: 8, color: COLORES.BORDER_LIGHT }
                },
                margins: { top: 100, bottom: 100, left: 140, right: 140 }
              })
            ]
          })
        ]
      });

      elementos.push(tablaCodigo);
      elementos.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      continue;
    }

    // 6. Tablas Markdown (| col 1 | col 2 | ...)
    if (lineaTrim.startsWith('|') && lineaTrim.endsWith('|')) {
      const lineasTabla = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|') && lineas[i].trim().endsWith('|')) {
        lineasTabla.push(lineas[i].trim());
        i++;
      }

      if (lineasTabla.length >= 2) {
        const parseFila = (f) => f.slice(1, -1).split('|').map(c => c.trim());
        const encabezados = parseFila(lineasTabla[0]);
        // Ignorar fila separadora (linea 1 que contiene ---)
        const filasDatos = lineasTabla.slice(1).filter(l => !l.includes('---')).map(parseFila);

        const filasDocx = [];

        // Fila Encabezado
        filasDocx.push(new TableRow({
          tableHeader: true,
          children: encabezados.map(h => new TableCell({
            children: [new Paragraph({
              children: parseInline(h, { bold: true, color: "FFFFFF", size: 19 }),
              alignment: AlignmentType.LEFT
            })],
            shading: { fill: COLORES.NAVY, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: COLORES.NAVY },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORES.EMERALD_LIGHT },
              left: { style: BorderStyle.SINGLE, size: 4, color: COLORES.SLATE_DARK },
              right: { style: BorderStyle.SINGLE, size: 4, color: COLORES.SLATE_DARK }
            },
            margins: { top: 120, bottom: 120, left: 120, right: 120 }
          }))
        }));

        // Filas de Datos
        filasDatos.forEach((fd, idxFila) => {
          const fondo = idxFila % 2 === 0 ? "FFFFFF" : COLORES.GRAY_BG;
          filasDocx.push(new TableRow({
            children: fd.map((celda, cIdx) => new TableCell({
              children: [new Paragraph({
                children: parseInline(celda, { size: 19, color: COLORES.SLATE_TEXT }),
                alignment: AlignmentType.LEFT
              })],
              shading: { fill: fondo, type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: COLORES.BORDER_LIGHT },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORES.BORDER_LIGHT },
                left: { style: BorderStyle.SINGLE, size: 4, color: COLORES.BORDER_LIGHT },
                right: { style: BorderStyle.SINGLE, size: 4, color: COLORES.BORDER_LIGHT }
              },
              margins: { top: 100, bottom: 100, left: 120, right: 120 }
            }))
          }));
        });

        elementos.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: filasDocx
        }));
        elementos.push(new Paragraph({ text: "", spacing: { after: 120 } }));
        continue;
      }
    }

    // 7. Imágenes Markdown: ![caption](ruta)
    const matchImg = lineaTrim.match(/!\[(.*?)\]\((.*?)\)/);
    if (matchImg) {
      const caption = matchImg[1];
      const relPath = matchImg[2];
      const absPath = path.isAbsolute(relPath) ? relPath : path.resolve(rutaBase, relPath);

      if (fs.existsSync(absPath)) {
        try {
          const imgBuffer = fs.readFileSync(absPath);
          elementos.push(new Paragraph({
            children: [
              new ImageRun({
                data: imgBuffer,
                transformation: {
                  width: 520,
                  height: 300
                }
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 60 }
          }));
          if (caption) {
            elementos.push(new Paragraph({
              children: [new TextRun({ text: `📷 ${caption}`, italics: true, size: 18, color: COLORES.SLATE_MUTED })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 140 }
            }));
          }
          i++;
          continue;
        } catch (e) {
          console.warn(`No se pudo incrustar imagen ${absPath}:`, e.message);
        }
      }
    }

    // 8. Viñetas (* ..., - ...)
    if (lineaTrim.startsWith('* ') || lineaTrim.startsWith('- ')) {
      const texto = lineaTrim.replace(/^[\*\-]\s+/, '');
      elementos.push(new Paragraph({
        children: [
          new TextRun({ text: "•  ", bold: true, color: COLORES.EMERALD, size: 21 }),
          ...parseInline(texto, { size: 21, color: COLORES.SLATE_TEXT })
        ],
        indent: { left: 360 },
        spacing: { before: 40, after: 50 }
      }));
      i++;
      continue;
    }

    // 9. Listas Numeradas (1. ..., 2. ...)
    const matchNum = lineaTrim.match(/^(\d+)\.\s+(.*)/);
    if (matchNum) {
      const num = matchNum[1];
      const texto = matchNum[2];
      elementos.push(new Paragraph({
        children: [
          new TextRun({ text: `${num}.  `, bold: true, color: COLORES.NAVY, size: 21 }),
          ...parseInline(texto, { size: 21, color: COLORES.SLATE_TEXT })
        ],
        indent: { left: 360 },
        spacing: { before: 40, after: 50 }
      }));
      i++;
      continue;
    }

    // 10. Párrafo Normal
    elementos.push(new Paragraph({
      children: parseInline(lineaTrim, { size: 21, color: COLORES.SLATE_TEXT }),
      spacing: { before: 50, after: 70 },
      lineSpacing: 276 // 1.15
    }));
    i++;
  }

  return elementos;
}

/**
 * Genera el documento Word (.docx) formal
 */
async function generarDocxCapitulo(archivoMd, nombreSalidaDocx) {
  const rutaCompletaMd = path.join(DIR_MD, archivoMd);
  if (!fs.existsSync(rutaCompletaMd)) {
    console.error(`Archivo no encontrado: ${rutaCompletaMd}`);
    return;
  }

  const contenido = fs.readFileSync(rutaCompletaMd, 'utf8');
  const hijosDocx = convertirMarkdownADocx(contenido, DIR_MD);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 21,
            color: COLORES.SLATE_TEXT
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 pulgada
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "FIABONO POS  •  MANUAL OFICIAL DEL COMERCIANTE", size: 16, color: COLORES.SLATE_MUTED, bold: true })
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 }
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Fiabono Cloud System  —  Página ", size: 16, color: COLORES.SLATE_MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORES.SLATE_MUTED, bold: true }),
                  new TextRun({ text: " de ", size: 16, color: COLORES.SLATE_MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORES.SLATE_MUTED, bold: true })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children: hijosDocx
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const rutaDocx = path.join(DIR_WORD, nombreSalidaDocx);

  try {
    fs.writeFileSync(rutaDocx, buffer);
    console.log(`[OK] Generado: ${nombreSalidaDocx} (${Math.round(buffer.length / 1024)} KB)`);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const rutaAlt = path.join(DIR_WORD, nombreSalidaDocx.replace('.docx', '_Actualizado.docx'));
      fs.writeFileSync(rutaAlt, buffer);
      console.warn(`[AVISO] Archivo bloqueado por Word. Guardado como: ${path.basename(rutaAlt)}`);
    } else {
      throw err;
    }
  }
}

// Mapa de Archivos Markdown a Archivos Word
const MAPA_ARCHIVOS = [
  { md: "00_BIENVENIDA_Y_MAPA_DEL_SISTEMA.md", docx: "00_Capitulo_Bienvenida_y_Mapa_del_Sistema.docx" },
  { md: "01_CONFIGURACION_NEGOCIO_LOGO_MEDIOS_PAGO.md", docx: "01_Capitulo_Configuracion_Negocio_Logo_Medios_Pago.docx" },
  { md: "02_CAJA_DIARIA_APERTURA_Y_ARQUEO.md", docx: "02_Capitulo_Caja_Diaria_Apertura_y_Arqueo.docx" },
  { md: "03_INVENTARIO_MAESTRO_PRODUCTOS_Y_ETIQUETAS.md", docx: "03_Capitulo_Inventario_Maestro_Productos_y_Etiquetas.docx" },
  { md: "04_VENTA_RAPIDA_POS_CONTADO.md", docx: "04_Capitulo_Venta_Rapida_POS_Contado.docx" },
  { md: "05_MODULO_CREDITO_Y_FIADOS.md", docx: "05_Capitulo_Modulo_Credito_y_Fiados.docx" },
  { md: "06_MODULO_ABONOS_Y_RECAUDOS.md", docx: "06_Capitulo_Modulo_Abonos_y_Recaudos.docx" },
  { md: "07_PLAN_SEPARE_INTEGRAL.md", docx: "07_Capitulo_Plan_Separe_Integral.docx" },
  { md: "08_DIRECTORIO_CLIENTES_Y_COBRANZA_WHATSAPP.md", docx: "08_Capitulo_Directorio_Clientes_y_Cobranza_WhatsApp.docx" },
  { md: "09_HISTORIAL_Y_AUDITORIA_MOVIMIENTOS.md", docx: "09_Capitulo_Historial_y_Auditoria_Movimientos.docx" },
  { md: "10_REPORTES_Y_METRICAS_FINANCIERAS.md", docx: "10_Capitulo_Reportes_y_Metricas_Financieras.docx" },
  { md: "11_COLABORADORES_Y_SEGURIDAD.md", docx: "11_Capitulo_Colaboradores_y_Seguridad.docx" },
  { md: "12_SUSCRIPCIONES_PLANES_Y_DIAN.md", docx: "12_Capitulo_Suscripciones_Planes_y_DIAN.docx" },
  { md: "13_PREGUNTAS_FRECUENTES_Y_SOLUCION_PROBLEMAS.md", docx: "13_Capitulo_Preguntas_Frecuentes_y_Solucion_Problemas.docx" },
  { md: "INDICE_GENERAL.md", docx: "00_Indice_General_Manual_Usuario.docx" }
];

async function main() {
  console.log("Iniciando generación de documentos Word (.docx) para cada capítulo...");
  for (const item of MAPA_ARCHIVOS) {
    await generarDocxCapitulo(item.md, item.docx);
  }
  console.log("¡Todos los capítulos han sido convertidos exitosamente a Word!");
}

main().catch(err => {
  console.error("Error general generando Word:", err);
  process.exit(1);
});
