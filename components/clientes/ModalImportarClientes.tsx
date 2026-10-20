"use client";
import React, { useState, useRef, useEffect } from "react";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { auth } from "@/firebase";
import { API_DB } from "@/servicios/db";
import { Cliente } from "@/types";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  HelpCircle,
  FileCheck,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Trash2,
  Check
} from "lucide-react";

interface ModalImportarClientesProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaPrincipalId?: string;
  clientesExistentes: Cliente[];
  categoriasExistentes?: string[];
  esPlanGratis: boolean;
  limitePlan: number;
  onSuccess: () => void;
}

interface FilaClienteParseada {
  filaOriginal: number;
  nombre: string;
  apodo?: string;
  celular: string;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion: string;
  saldoInicial: number;
  etiquetas: string[];
  notas: string;
  esDuplicado: boolean;
  clienteDuplicadoId?: string;
  motivoDuplicado?: string;
  valido: boolean;
  error?: string;
}

export default function ModalImportarClientes({
  isOpen,
  onClose,
  cuentaPrincipalId,
  clientesExistentes,
  categoriasExistentes = [],
  esPlanGratis,
  limitePlan,
  onSuccess
}: ModalImportarClientesProps) {
  const [paso, setPaso] = useState<'subir' | 'previsualizar' | 'procesando' | 'completado'>('subir');
  const [arrastrando, setArrastrando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [filasAnalizadas, setFilasAnalizadas] = useState<FilaClienteParseada[]>([]);
  const [accionDuplicados, setAccionDuplicados] = useState<'omitir' | 'actualizar'>('omitir');
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [resumenFinal, setResumenFinal] = useState<{ creados: number; actualizados: number; errores: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const resetearTodo = () => {
    setPaso('subir');
    setNombreArchivo("");
    setFilasAnalizadas([]);
    setAccionDuplicados('omitir');
    setProgreso({ actual: 0, total: 0 });
    setResultadoFinal(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const setResultadoFinal = (val: { creados: number; actualizados: number; errores: number } | null) => {
    setResumenFinal(val);
  };

  useEffect(() => {
    if (isOpen) {
      resetearTodo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. DESCARGAR PLANTILLA OFICIAL ESTILIZADA (.XLSX)
  const descargarPlantilla = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Fiabono POS';
      wb.created = new Date();

      // 1. Hoja Principal de Clientes (Hoja 0 para que abra en primer plano)
      const ws = wb.addWorksheet('Plantilla Clientes', {
        properties: { tabColor: { argb: 'FF059669' } },
        views: [{ state: 'frozen', ySplit: 4 }]
      });

      // 2. Hoja de Categorías (Hoja secundaria para alimentar la lista desplegable en Excel)
      const listaFinalCats = (categoriasExistentes && categoriasExistentes.length > 0)
        ? Array.from(new Set(categoriasExistentes.map(c => c.trim()).filter(Boolean)))
        : ['Mayorista', 'Frecuente', 'Vecino', 'Familia', 'VIP', 'Institucional', 'Nuevo'];

      const wsCats = wb.addWorksheet('Categorías Disponibles', {
        properties: { tabColor: { argb: 'FF8B5CF6' } }
      });

      const catHeader = wsCats.addRow(['CATEGORÍAS DE TU NEGOCIO']);
      catHeader.height = 25;
      const catHeaderCell = wsCats.getCell('A1');
      catHeaderCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      catHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
      catHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };

      listaFinalCats.forEach((cat) => {
        const r = wsCats.addRow([cat]);
        r.height = 20;
        const cell = r.getCell(1);
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      wsCats.getColumn(1).width = 30;

      // Banner superior con instrucciones en Hoja Clientes
      ws.mergeCells('A1:I1');
      const banner = ws.getCell('A1');
      banner.value = 'PLANTILLA OFICIAL DE IMPORTACIÓN DE CLIENTES • FIABONO';
      banner.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      banner.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 30;

      ws.mergeCells('A2:I2');
      const sub = ws.getCell('A2');
      sub.value = 'Instrucciones: Llena los datos desde la fila 5. Nombre Completo es obligatorio. En Categorías puedes seleccionar del menú desplegable o escribir una nueva.';
      sub.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF475569' } };
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      sub.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 20;

      ws.getRow(3).height = 8;

      // Encabezados
      const headers = [
        'Nombre Completo *',
        'Apodo / Alias',
        'Celular (WhatsApp)',
        'Tipo Documento',
        'Número Documento',
        'Dirección',
        'Categorías',
        'Saldo Pendiente ($)',
        'Notas / Referencia'
      ];

      const headerRow = ws.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'medium', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FF047857' } },
          right: { style: 'thin', color: { argb: 'FF047857' } }
        };
      });

      // Filas de ejemplo realistas
      const ejemplos = [
        ['Carlos Arturo Gómez', 'Cachaco', '3101234567', 'CC', '1020304050', 'Carrera 5 # 12-30', listaFinalCats[0] || 'Mayorista', 0, 'Dueño de la tienda de la esquina'],
        ['María Elena Rodríguez', 'Doña Mary', '3159876543', 'CC', '52987654', 'Calle 10 # 4-20', listaFinalCats[1] || 'Vecino', 45000, 'Paga los 15 y 30'],
        ['Restaurante El Sabor', 'El Sabor', '3005558899', 'NIT', '901234567', 'Avenida 3 # 45-10', listaFinalCats[2] || 'VIP', 0, 'Atención Don Fabio']
      ];

      ejemplos.forEach((fila) => {
        const row = ws.addRow(fila);
        row.height = 22;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNumber === 8) {
            cell.numFmt = '"$"#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (colNumber === 3 || colNumber === 4 || colNumber === 5) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });

      // Configurar validación de datos (desplegables interactivos en Excel)
      const totalCats = listaFinalCats.length;
      for (let r = 5; r <= 300; r++) {
        // Desplegable Tipo Doc (Columna D)
        ws.getCell(`D${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"CC,NIT,CE,PP,TI"'],
          showErrorMessage: false
        };

        // Desplegable Categorías (Columna G) vinculado a la hoja de Categorías Disponibles
        ws.getCell(`G${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'Categorías Disponibles'!$A$2:$A$${totalCats + 1}`],
          showErrorMessage: false, // Permite al usuario escribir libremente una categoría nueva
          showInputMessage: true,
          promptTitle: 'Categoría',
          prompt: 'Selecciona una categoría existente o escribe una nueva (puedes separar varias por coma).'
        };
      }

      ws.columns = [
        { width: 26 }, // Nombre
        { width: 18 }, // Apodo / Alias
        { width: 18 }, // Celular
        { width: 14 }, // Tipo Doc
        { width: 18 }, // Número Doc
        { width: 24 }, // Dirección
        { width: 24 }, // Categorías
        { width: 18 }, // Saldo
        { width: 28 }  // Notas
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Importar_Clientes_Fiabono.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Plantilla descargada. Ábrela y llénala con tus clientes ✨");
    } catch (e) {
      console.error("Error al descargar plantilla:", e);
      toast.error("No se pudo generar la plantilla de Excel.");
    }
  };

  // 2. PARSEAR ARCHIVO SUBIDO (.XLSX, .XLS, .CSV)
  const procesarArchivo = (file: File) => {
    if (!file) return;
    setNombreArchivo(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const normalizar = (txt: string) => 
          (txt || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        // Buscar prioritariamente la hoja de clientes (evitar leer la hoja secundaria de categorías disponibles)
        const sheetName = wb.SheetNames.find(n => {
          const norm = normalizar(n);
          return norm.includes('cliente') || norm.includes('plantilla') || norm.includes('directorio');
        }) || (wb.SheetNames.find(n => !normalizar(n).includes('categoria')) || wb.SheetNames[0]);

        const ws = wb.Sheets[sheetName];
        if (!ws) {
          toast.error("El archivo no contiene ninguna hoja válida de clientes.");
          return;
        }

        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        if (data.length <= 1) {
          toast.error("El archivo está vacío o no tiene filas para importar.");
          return;
        }

        // Detectar fila de cabecera buscando una fila con múltiples celdas que correspondan a encabezados reales
        let headerRowIndex = 0;
        let cabeceraEncontrada = false;

        for (let i = 0; i < Math.min(10, data.length); i++) {
          const fila = data[i] || [];
          const celdasNormalizadas = fila.map(c => normalizar(String(c || '')));
          const filaStr = celdasNormalizadas.join(' ');
          
          // Ignorar filas de título, banner o instrucciones descriptivas
          if (filaStr.includes('plantilla oficial') || filaStr.includes('instrucciones:') || filaStr.includes('llena los datos')) {
            continue;
          }

          // Verificar si esta fila contiene encabezados esperados en celdas separadas
          const tieneNombre = celdasNormalizadas.some(c => c.includes('nombre') || c.includes('cliente'));
          const tieneCel = celdasNormalizadas.some(c => c.includes('celular') || c.includes('telefono') || c.includes('whatsapp') || c.includes('tel') || c.includes('movil'));
          const tieneDoc = celdasNormalizadas.some(c => c.includes('documento') || c.includes('cedula') || c.includes('tipo doc') || c.includes('cc') || c.includes('nit'));
          const tieneDir = celdasNormalizadas.some(c => c.includes('direccion') || c.includes('ubicacion'));
          const tieneCat = celdasNormalizadas.some(c => c.includes('categoria') || c.includes('etiqueta'));
          const tieneSaldo = celdasNormalizadas.some(c => c.includes('saldo') || c.includes('deuda'));
          const tieneApodo = celdasNormalizadas.some(c => c.includes('apodo') || c.includes('alias'));

          const matches = [tieneNombre, tieneCel, tieneDoc, tieneDir, tieneCat, tieneSaldo, tieneApodo].filter(Boolean).length;

          // Una fila de encabezado real debe tener 'nombre' y al menos 1 columna adicional válida en la misma fila (o 3 matches)
          if ((tieneNombre && matches >= 2) || matches >= 3) {
            headerRowIndex = i;
            cabeceraEncontrada = true;
            break;
          }
        }

        // Si no se encontró por múltiples matches, buscar la primera fila que contenga 'nombre' y no sea banner
        if (!cabeceraEncontrada) {
          for (let i = 0; i < Math.min(5, data.length); i++) {
            const fila = data[i] || [];
            const celdasNormalizadas = fila.map(c => normalizar(String(c || '')));
            const filaStr = celdasNormalizadas.join(' ');
            if (filaStr.includes('plantilla') || filaStr.includes('instrucciones')) continue;
            if (celdasNormalizadas.some(c => c.includes('nombre') || c.includes('cliente'))) {
              headerRowIndex = i;
              cabeceraEncontrada = true;
              break;
            }
          }
        }

        // Mapear columnas según encabezados normalizados garantizando índices únicos (sin solapamientos)
        const headersDetected = (data[headerRowIndex] || []).map(h => normalizar(String(h || '')));
        const getColIdx = (palabrasClave: string[], excludeIdxs: number[] = []) => {
          return headersDetected.findIndex((h, idx) => 
            !excludeIdxs.includes(idx) && palabrasClave.some(p => h.includes(normalizar(p)))
          );
        };

        const idxNombre = getColIdx(['nombre completo', 'nombre', 'cliente']);
        const idxApodo = getColIdx(['apodo', 'alias', 'sobrenombre'], [idxNombre]);
        const idxCelular = getColIdx(['celular', 'telefono', 'tel', 'whatsapp', 'movil'], [idxNombre, idxApodo]);
        const idxTipoDoc = getColIdx(['tipo doc', 'tipo de doc', 'tipo'], [idxNombre, idxApodo, idxCelular]);
        const idxNumDoc = getColIdx(['numero doc', 'num doc', 'cedula', 'documento', 'cc', 'nit'], [idxNombre, idxApodo, idxCelular, idxTipoDoc]);
        const idxDireccion = getColIdx(['direccion', 'ubicacion', 'barrio'], [idxNombre, idxApodo, idxCelular, idxTipoDoc, idxNumDoc]);
        const idxCategorias = getColIdx(['categoria', 'etiqueta', 'tag'], [idxNombre, idxApodo, idxCelular, idxTipoDoc, idxNumDoc, idxDireccion]);
        const idxSaldo = getColIdx(['saldo', 'deuda', 'debe', 'pendiente'], [idxNombre, idxApodo, idxCelular, idxTipoDoc, idxNumDoc, idxDireccion, idxCategorias]);
        const idxNotas = getColIdx(['nota', 'referencia', 'observacion'], [idxNombre, idxApodo, idxCelular, idxTipoDoc, idxNumDoc, idxDireccion, idxCategorias, idxSaldo]);

        const parsearNumero = (val: any): number => {
          if (typeof val === 'number') return Math.max(0, Math.round(val));
          if (!val) return 0;
          const digitos = String(val).replace(/[^\d]/g, '');
          const n = Number(digitos);
          return Number.isFinite(n) ? Math.max(0, n) : 0;
        };

        const filasParseadas: FilaClienteParseada[] = [];

        // Fila de inicio: si se detectó cabecera, empezar en la siguiente; si no, desde la fila 0
        const startRow = cabeceraEncontrada ? headerRowIndex + 1 : 0;

        const docsVistosEnArchivo = new Set<string>();

        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          // Nombre
          const nombreRaw = String(idxNombre >= 0 ? row[idxNombre] : row[0] || '').trim();
          const nombreNorm = normalizar(nombreRaw);

          // Saltar filas vacías, de encabezados rezagados o de instrucciones
          if (!nombreRaw) continue;
          if (
            nombreNorm.includes('nombre completo') || 
            nombreNorm.includes('instrucciones:') || 
            nombreNorm.includes('plantilla oficial') ||
            nombreNorm.includes('llena los datos')
          ) {
            continue;
          }

          // Extracción segura por índice de columna detectado
          const apodoRaw = idxApodo >= 0 ? String(row[idxApodo] || '').trim() : '';
          const celularRaw = idxCelular >= 0 ? String(row[idxCelular] || '').trim() : '';
          const tipoDocRaw = idxTipoDoc >= 0 ? String(row[idxTipoDoc] || 'CC').trim().toUpperCase() : 'CC';
          const numDocRaw = idxNumDoc >= 0 ? String(row[idxNumDoc] || '').trim().replace(/[^\w-]/g, '') : '';
          const direccionRaw = idxDireccion >= 0 ? String(row[idxDireccion] || '').trim() : '';
          const categoriasRaw = idxCategorias >= 0 ? String(row[idxCategorias] || '').trim() : '';
          const saldoRaw = idxSaldo >= 0 ? row[idxSaldo] : 0;
          const notasRaw = idxNotas >= 0 ? String(row[idxNotas] || '').trim() : '';

          // Categorías: se separan ÚNICAMENTE por coma o punto y coma (para no romper direcciones con guión)
          const tags = categoriasRaw
            ? categoriasRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean)
            : [];

          // DETECCIÓN INTELIGENTE DE DUPLICADOS EN LA BASE ACTUAL
          const docLimpio = numDocRaw.toLowerCase();
          const celLimpio = celularRaw.replace(/[^\d]/g, '');
          const nomNorm = normalizar(nombreRaw);

          let esDuplicado = false;
          let clienteDuplicadoId: string | undefined = undefined;
          let motivoDuplicado: string | undefined = undefined;

          // 1. Verificar si ya existe en la base de datos de Fiabono (recopilando campos específicos duplicados)
          const camposDuplicados: string[] = [];
          const duplicadoEncontrado = clientesExistentes.find(c => {
            let coincide = false;
            const docCoincide = docLimpio && c.numeroDocumento && c.numeroDocumento.toLowerCase().trim() === docLimpio;
            const celCoincide = celLimpio && celLimpio.length >= 7 && c.celular && c.celular.replace(/[^\d]/g, '') === celLimpio;
            const nomCoincide = nomNorm && normalizar(c.nombre) === nomNorm;

            if (docCoincide) {
              camposDuplicados.push(`Cédula/Doc (${c.numeroDocumento})`);
              coincide = true;
            }
            if (celCoincide) {
              camposDuplicados.push(`Celular (${c.celular})`);
              coincide = true;
            }
            if (nomCoincide) {
              camposDuplicados.push(`Nombre idéntico`);
              coincide = true;
            }
            return coincide;
          });

          if (duplicadoEncontrado) {
            esDuplicado = true;
            clienteDuplicadoId = duplicadoEncontrado.id;
            motivoDuplicado = `Coincide con "${duplicadoEncontrado.nombre}": ${camposDuplicados.join(', ')}`;
          } else if (docLimpio && docsVistosEnArchivo.has(docLimpio)) {
            // 2. Verificar si viene duplicado dentro del mismo archivo
            esDuplicado = true;
            motivoDuplicado = `Cédula/Doc (${numDocRaw}) repetida en este archivo`;
          }

          if (docLimpio) {
            docsVistosEnArchivo.add(docLimpio);
          }

          filasParseadas.push({
            filaOriginal: i + 1,
            nombre: nombreRaw,
            apodo: apodoRaw,
            celular: celularRaw,
            tipoDocumento: ['CC', 'NIT', 'CE', 'PP', 'TI'].includes(tipoDocRaw) ? tipoDocRaw : 'CC',
            numeroDocumento: numDocRaw,
            direccion: direccionRaw,
            saldoInicial: parsearNumero(saldoRaw),
            etiquetas: tags,
            notas: notasRaw,
            esDuplicado,
            clienteDuplicadoId,
            motivoDuplicado,
            valido: true
          });
        }

        if (filasParseadas.length === 0) {
          toast.error("No se encontraron registros de clientes válidos en el archivo.");
          return;
        }

        setFilasAnalizadas(filasParseadas);
        setPaso('previsualizar');
      } catch (err) {
        console.error("Error al procesar archivo:", err);
        toast.error("El archivo no pudo ser leído. Verifica que sea un Excel o CSV válido.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // Métricas del análisis
  const filasValidas = filasAnalizadas.filter(f => f.valido);
  const filasNuevas = filasValidas.filter(f => !f.esDuplicado);
  const filasDuplicadas = filasValidas.filter(f => f.esDuplicado);
  const filasInvalidas = filasAnalizadas.filter(f => !f.valido);

  const totalAInsertar = accionDuplicados === 'omitir' ? filasNuevas.length : filasValidas.length;
  const cuposRestantes = Math.max(0, limitePlan - clientesExistentes.length);
  const superaLimitePlan = esPlanGratis && filasNuevas.length > cuposRestantes;

  // 3. EJECUTAR IMPORTACIÓN MASIVA
  const handleEjecutarImportacion = async () => {
    if (!cuentaPrincipalId) {
      toast.error("Sesión no válida.");
      return;
    }

    if (superaLimitePlan) {
      toast.error(`Tu Plan Gratuito solo permite ${cuposRestantes} cliente(s) más. Pasa a Plan Comercio o PRO para clientes ilimitados.`, { duration: 6000 });
      return;
    }

    setPaso('procesando');
    const filasAProcesar = accionDuplicados === 'omitir' ? filasNuevas : filasValidas;
    setProgreso({ actual: 0, total: filasAProcesar.length });

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      toast.error("No hay sesión activa.");
      setPaso('previsualizar');
      return;
    }

    let creados = 0;
    let actualizados = 0;
    let errores = 0;

    for (let i = 0; i < filasAProcesar.length; i++) {
      const fila = filasAProcesar[i];
      setProgreso({ actual: i + 1, total: filasAProcesar.length });

      try {
        if (fila.esDuplicado && fila.clienteDuplicadoId && accionDuplicados === 'actualizar') {
          // Actualizar cliente existente
          const clienteExistente = clientesExistentes.find(c => c.id === fila.clienteDuplicadoId);
          const tagsActuales = Array.isArray(clienteExistente?.etiquetas) ? [...clienteExistente.etiquetas] : [];
          // Unir etiquetas sin duplicar
          fila.etiquetas.forEach(t => {
            if (!tagsActuales.some(existing => existing.toLowerCase() === t.toLowerCase())) {
              tagsActuales.push(t);
            }
          });

          const respActualizar = await fetch('/api/clientes/actualizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              id: fila.clienteDuplicadoId,
              tipoDocumento: fila.tipoDocumento || clienteExistente?.tipoDocumento || 'CC',
              numeroDocumento: fila.numeroDocumento || clienteExistente?.numeroDocumento || '',
              apodo: fila.apodo || clienteExistente?.apodo || '',
              celular: fila.celular || clienteExistente?.celular || '',
              direccion: fila.direccion || clienteExistente?.direccion || '',
              notas: fila.notas ? `${clienteExistente?.notas ? clienteExistente.notas + ' • ' : ''}${fila.notas}` : clienteExistente?.notas || '',
              etiquetas: tagsActuales
            })
          });

          if (!respActualizar.ok) {
            errores++;
          } else {
            actualizados++;
          }
        } else {
          // Crear cliente nuevo a través del endpoint seguro
          const resp = await fetch('/api/clientes/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              nombre: fila.nombre,
              apodo: fila.apodo || '',
              tipoDocumento: fila.tipoDocumento,
              numeroDocumento: fila.numeroDocumento,
              saldoInicial: fila.saldoInicial,
              celular: fila.celular,
              direccion: fila.direccion,
              notas: fila.notas,
              etiquetas: fila.etiquetas
            })
          });

          if (!resp.ok) {
            errores++;
          } else {
            creados++;
          }
        }
      } catch (err) {
        console.error("Error importando fila:", fila.nombre, err);
        errores++;
      }
    }

    setResultadoFinal({ creados, actualizados, errores });
    setPaso('completado');

    if (creados > 0 || actualizados > 0) {
      toast.success(
        `Importación completada: ${creados} nuevo(s)${actualizados > 0 ? `, ${actualizados} actualizado(s)` : ''} ✨`,
        { duration: 5000 }
      );
      onSuccess();
    } else {
      toast.error("No se pudo importar ningún cliente.");
    }
  };

  const handleCerrarModal = () => {
    resetearTodo();
    onClose();
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && paso !== 'procesando') handleCerrarModal(); }}
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-xl w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Importar Clientes
              </h3>
              <p className="text-xs text-slate-400">Carga masiva desde archivo Excel (.xlsx) o CSV</p>
            </div>
          </div>
          {paso !== 'procesando' && (
            <button
              type="button"
              onClick={handleCerrarModal}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* PASO 1: SUBIR ARCHIVO */}
        {paso === 'subir' && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            
            {/* Botón de Descarga de Plantilla Oficial */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="text-emerald-600 shrink-0" size={24} />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Descargar Plantilla Oficial (.xlsx)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Incluye desplegables con tus categorías de Fiabono y ejemplos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={descargarPlantilla}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer shrink-0"
              >
                <Download size={14} />
                <span>Descargar</span>
              </button>
            </div>

            {/* Zona de Arrastrar y Soltar */}
            <div
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                const file = e.dataTransfer.files?.[0];
                if (file) procesarArchivo(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                arrastrando
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[0.99]'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) procesarArchivo(file);
                }}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <Upload size={28} />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  Arrastra tu archivo aquí o haz clic para seleccionarlo
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Formatos soportados: Excel (.xlsx, .xls) o CSV (.csv)
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Límite recomendado: hasta 500 clientes por carga
              </span>
            </div>

            {/* Guía rápida */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-500 dark:text-slate-400">
              <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircle size={14} className="text-blue-500" /> Consejos para una importación perfecta:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                <li>La columna <strong>Nombre Completo</strong> es la única obligatoria.</li>
                <li>Si tienes clientes con saldo pendiente heredado, ingrésalo en la columna <strong>Saldo Pendiente</strong>.</li>
                <li>Los celulares y números de cédula permiten detectar clientes que ya tengas registrados.</li>
              </ul>
            </div>
          </div>
        )}

        {/* PASO 2: PREVISUALIZACIÓN Y DIAGNÓSTICO */}
        {paso === 'previsualizar' && (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">

            {/* Ficha del archivo actual con opción de Eliminar / Cambiar */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="text-emerald-600 shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {nombreArchivo}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {filasValidas.length} registros listos para importar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetearTodo}
                className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                title="Descartar este archivo y subir otro"
              >
                <Trash2 size={13} />
                <span>Cambiar archivo</span>
              </button>
            </div>

            {/* Métricas de diagnóstico */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-0.5">
                  Nuevos
                </span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {filasNuevas.length}
                </p>
                <span className="text-[9px] text-emerald-600/70">Listos para crear</span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                  Duplicados
                </span>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {filasDuplicadas.length}
                </p>
                <span className="text-[9px] text-amber-600/70">Ya registrados</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                  Ignorados
                </span>
                <p className="text-xl font-black text-slate-600 dark:text-slate-300">
                  {filasInvalidas.length}
                </p>
                <span className="text-[9px] text-slate-400">Sin nombre</span>
              </div>
            </div>

            {/* Aviso de Plan Gratuito si aplica */}
            {superaLimitePlan && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-bold">Límite de Plan Gratuito excedido</p>
                  <p className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-0.5 leading-relaxed">
                    Tu plan permite máximo {limitePlan} clientes y actualmente tienes {clientesExistentes.length} registrados (te quedan {cuposRestantes} cupos). Para importar {filasNuevas.length} clientes necesitas pasar al Plan Comercio o PRO.
                  </p>
                </div>
              </div>
            )}

            {/* Selector de Conflicto de Duplicados */}
            {filasDuplicadas.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  ¿Qué hacer con los {filasDuplicadas.length} clientes ya existentes?
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAccionDuplicados('omitir')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition cursor-pointer ${
                      accionDuplicados === 'omitir'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>🛡️ Omitir duplicados</span>
                    <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                      Conserva los datos actuales intactos.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccionDuplicados('actualizar')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition cursor-pointer ${
                      accionDuplicados === 'actualizar'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>🔄 Actualizar datos</span>
                    <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                      Actualiza teléfono, dirección y categorías.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Muestra de primeros registros a importar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Registros a procesar:
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {filasValidas.length > 15 ? `Mostrando 15 de ${filasValidas.length}` : `${filasValidas.length} total`}
                </span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {filasValidas.slice(0, 15).map((f, i) => (
                  <div 
                    key={i} 
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      f.esDuplicado 
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/60' 
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 dark:text-white truncate">
                        {f.nombre} {f.apodo && <span className="font-semibold text-amber-600 dark:text-amber-400">({f.apodo})</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {f.celular ? `📱 ${f.celular}` : 'Sin teléfono'} • {f.numeroDocumento ? `${f.tipoDocumento} ${f.numeroDocumento}` : 'Sin doc'} {f.direccion ? `• 📍 ${f.direccion}` : ''} {f.etiquetas.length > 0 ? `• [${f.etiquetas.join(', ')}]` : ''}
                      </p>
                      {f.esDuplicado && f.motivoDuplicado && (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 truncate" title={f.motivoDuplicado}>
                          ⚠️ {f.motivoDuplicado}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end justify-center">
                      {f.esDuplicado ? (
                        <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                          Duplicado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                          Nuevo
                        </span>
                      )}
                      {f.saldoInicial > 0 && (
                        <span className="block text-[10px] font-black text-slate-700 dark:text-slate-300 mt-1">
                          ${f.saldoInicial.toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* PASO 3: PROCESANDO IMPORTACIÓN */}
        {paso === 'procesando' && (
          <div className="py-12 px-4 text-center space-y-4">
            <RefreshCw className="animate-spin text-blue-600 mx-auto" size={36} />
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Importando clientes a tu cuenta...
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Guardando registros y aplicando validaciones contables.
              </p>
            </div>
            
            {/* Barra de progreso */}
            <div className="max-w-xs mx-auto space-y-1">
              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-200" 
                  style={{ width: `${(progreso.actual / Math.max(1, progreso.total)) * 100}%` }}
                />
              </div>
              <p className="text-[11px] font-bold text-slate-500 text-right">
                {progreso.actual} de {progreso.total} procesados
              </p>
            </div>
          </div>
        )}

        {/* PASO 4: RESULTADO FINAL / COMPLETADO */}
        {paso === 'completado' && (
          <div className="py-8 px-4 text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                ¡Importación completada con éxito!
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Los clientes ya se encuentran disponibles en tu directorio y cartera.
              </p>
            </div>

            {resumenFinal && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center max-w-sm mx-auto">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Nuevos</span>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{resumenFinal.creados}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Actualizados</span>
                  <p className="text-xl font-black text-blue-700 dark:text-blue-300">{resumenFinal.actualizados}</p>
                </div>
                {resumenFinal.errores > 0 && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Con error</span>
                    <p className="text-xl font-black text-rose-700 dark:text-rose-300">{resumenFinal.errores}</p>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleCerrarModal}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Finalizar y Ver Directorio</span>
              <Check size={16} />
            </button>
          </div>
        )}

        {/* Botones de acción inferiores en previsualización */}
        {paso === 'previsualizar' && (
          <div className="pt-2 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCerrarModal}
              className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={resetearTodo}
              className="px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              title="Descartar este archivo"
            >
              <Trash2 size={14} />
              <span>Descartar</span>
            </button>
            <button
              type="button"
              onClick={handleEjecutarImportacion}
              disabled={totalAInsertar === 0 || superaLimitePlan}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Confirmar ({totalAInsertar})</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
