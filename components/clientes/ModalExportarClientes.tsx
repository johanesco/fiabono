"use client";
import React, { useState } from "react";
import ExcelJS from "exceljs";
import toast from "react-hot-toast";
import { Cliente } from "@/types";
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  X, 
  Check, 
  Filter, 
  Users,
  ShieldCheck,
  Calendar
} from "lucide-react";

interface ClienteConMetricas extends Cliente {
  deuda: number;
  totalComprado: number;
  totalAbonado: number;
  diasSinAbonar: number;
  semaforo: 'al_dia' | 'observacion' | 'riesgo';
  etiquetaSemaforo: string;
}

interface ModalExportarClientesProps {
  isOpen: boolean;
  onClose: () => void;
  todosLosClientes: ClienteConMetricas[];
  clientesFiltrados: ClienteConMetricas[];
  filtroActivoNombre: string;
  nombreNegocio: string;
}

export default function ModalExportarClientes({
  isOpen,
  onClose,
  todosLosClientes,
  clientesFiltrados,
  filtroActivoNombre,
  nombreNegocio
}: ModalExportarClientesProps) {
  const [alcance, setAlcance] = useState<'todos' | 'filtrados'>('filtrados');
  const [formato, setFormato] = useState<'xlsx' | 'csv'>('xlsx');
  const [procesando, setProcesando] = useState(false);

  if (!isOpen) return null;

  const listaAExportar = alcance === 'filtrados' ? clientesFiltrados : todosLosClientes;

  // 1. Descargar archivo en el navegador
  const descargarBlob = (blob: Blob, nombreArchivo: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Generación de Excel Corporativo (.xlsx) con ExcelJS
  const generarExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Fiabono POS';
    wb.created = new Date();

    const ws = wb.addWorksheet('Directorio de Clientes', {
      properties: { tabColor: { argb: 'FF059669' } },
      views: [{ state: 'frozen', ySplit: 5 }]
    });

    // Encabezado corporativo (Filas 1 a 3)
    ws.mergeCells('A1:M1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${nombreNegocio.toUpperCase()} • DIRECTORIO Y CARTERA DE CLIENTES`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:M2');
    const subCell = ws.getCell('A2');
    const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    subCell.value = `Reporte generado el ${fechaHoy} | Alcance: ${alcance === 'filtrados' ? filtroActivoNombre : 'Todos los clientes registrados'} (${listaAExportar.length} registros)`;
    subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 20;

    // Fila 4: Espacio en blanco
    ws.getRow(3).height = 8;
    ws.getRow(4).height = 8;

    // Fila 5: Cabecera de columnas
    const headers = [
      'Nombre del Cliente',
      'Apodo / Alias',
      'Tipo Doc.',
      'Cédula / Documento',
      'Teléfono / Celular',
      'Dirección',
      'Saldo Pendiente ($)',
      'Total Comprado ($)',
      'Total Abonado ($)',
      'Estado Cartera',
      'Días sin abonar',
      'Categorías / Etiquetas',
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

    // Filas de datos
    listaAExportar.forEach((c, idx) => {
      const deuda = Math.round(c.deuda || c.deudaTotal || 0);
      const comprado = Math.round(c.totalComprado || 0);
      const abonado = Math.round(c.totalAbonado || 0);
      const categoriasStr = (c.etiquetas || []).join(', ');
      const estadoStr = deuda > 0 ? (c.semaforo === 'riesgo' ? 'En Riesgo (+30d)' : (c.semaforo === 'observacion' ? 'En Observación' : 'Con Deuda Reciente')) : (deuda < 0 ? 'Saldo a Favor' : 'Al Día');

      const row = ws.addRow([
        c.nombre || '',
        c.apodo || '',
        c.tipoDocumento || 'CC',
        c.numeroDocumento || '',
        c.celular || '',
        c.direccion || '',
        deuda,
        comprado,
        abonado,
        estadoStr,
        c.deuda > 0 ? c.diasSinAbonar || 0 : 0,
        categoriasStr,
        c.notas || ''
      ]);

      row.height = 22;
      const isZebra = idx % 2 === 1;
      const bgArgb = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Formatos específicos por columna
        if (colNumber === 7 || colNumber === 8 || colNumber === 9) {
          // Columnas monetarias
          cell.numFmt = '"$"#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 7 && deuda > 0) {
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFE11D48' } };
          }
        } else if (colNumber === 3 || colNumber === 4 || colNumber === 5 || colNumber === 11) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 10) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (deuda > 0 && c.semaforo === 'riesgo') {
            cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFE11D48' } };
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Auto-ajuste de anchos de columna
    ws.columns = [
      { width: 26 }, // Nombre
      { width: 18 }, // Apodo / Alias
      { width: 10 }, // Tipo Doc
      { width: 18 }, // Documento
      { width: 16 }, // Celular
      { width: 24 }, // Dirección
      { width: 18 }, // Saldo
      { width: 18 }, // Comprado
      { width: 18 }, // Abonado
      { width: 18 }, // Estado
      { width: 14 }, // Días sin abono
      { width: 22 }, // Categorías
      { width: 26 }  // Notas
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const fechaSlug = new Date().toISOString().split('T')[0];
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    descargarBlob(blob, `Clientes_Fiabono_${fechaSlug}.xlsx`);
  };

  // 3. Generación de CSV (.csv) universal con UTF-8 BOM
  const generarCSV = () => {
    const encabezados = [
      'Nombre Completo',
      'Apodo / Alias',
      'Tipo Documento',
      'Numero Documento',
      'Celular',
      'Direccion',
      'Saldo Pendiente',
      'Total Comprado',
      'Total Abonado',
      'Estado Cartera',
      'Dias Sin Abonar',
      'Categorias',
      'Notas'
    ];

    const escaparCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lineas = [encabezados.map(escaparCSV).join(';')];

    listaAExportar.forEach((c) => {
      const deuda = Math.round(c.deuda || c.deudaTotal || 0);
      const comprado = Math.round(c.totalComprado || 0);
      const abonado = Math.round(c.totalAbonado || 0);
      const categoriasStr = (c.etiquetas || []).join(', ');
      const estadoStr = deuda > 0 ? (c.semaforo === 'riesgo' ? 'En Riesgo' : (c.semaforo === 'observacion' ? 'En Observacion' : 'Con Deuda')) : (deuda < 0 ? 'Saldo a Favor' : 'Al Dia');

      const fila = [
        c.nombre || '',
        c.apodo || '',
        c.tipoDocumento || 'CC',
        c.numeroDocumento || '',
        c.celular || '',
        c.direccion || '',
        deuda,
        comprado,
        abonado,
        estadoStr,
        c.deuda > 0 ? c.diasSinAbonar || 0 : 0,
        categoriasStr,
        c.notas || ''
      ];

      lineas.push(fila.map(escaparCSV).join(';'));
    });

    // UTF-8 BOM (\uFEFF) para que Excel reconozca acentos y ñ automáticamente
    const contenido = '\uFEFF' + lineas.join('\r\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const fechaSlug = new Date().toISOString().split('T')[0];
    descargarBlob(blob, `Clientes_Fiabono_${fechaSlug}.csv`);
  };

  const handleEjecutarExportacion = async () => {
    if (listaAExportar.length === 0) {
      toast.error("No hay clientes para exportar con la selección actual.");
      return;
    }

    setProcesando(true);
    const toastId = toast.loading("Generando archivo de exportación...");
    try {
      if (formato === 'xlsx') {
        await generarExcel();
      } else {
        generarCSV();
      }
      toast.success("Descarga iniciada exitosamente ✨", { id: toastId });
      onClose();
    } catch (err) {
      console.error("Error al exportar clientes:", err);
      toast.error("Ocurrió un error al generar el archivo.", { id: toastId });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Exportar Clientes
              </h3>
              <p className="text-xs text-slate-400">Descarga tu directorio y estado de cartera</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alcance de la exportación */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
            1. ¿Qué clientes deseas exportar?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAlcance('filtrados')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                alcance === 'filtrados'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="truncate flex items-center gap-1 text-slate-800 dark:text-white">
                  <Filter size={12} className="text-emerald-500 shrink-0" /> Vista Actual
                </span>
                {alcance === 'filtrados' && <Check size={14} className="text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {filtroActivoNombre}
              </p>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {clientesFiltrados.length} clientes
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAlcance('todos')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                alcance === 'todos'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className="truncate flex items-center gap-1 text-slate-800 dark:text-white">
                  <Users size={12} className="text-emerald-500 shrink-0" /> Todo el Directorio
                </span>
                {alcance === 'todos' && <Check size={14} className="text-emerald-600" />}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Base completa de datos
              </p>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {todosLosClientes.length} clientes
              </span>
            </button>
          </div>
        </div>

        {/* Formato de descarga */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
            2. Formato de archivo
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormato('xlsx')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-3 ${
                formato === 'xlsx'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white">Excel (.xlsx)</p>
                <p className="text-[10px] text-slate-400">Estilizado y fórmulas</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormato('csv')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-3 ${
                formato === 'csv'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white">CSV (.csv)</p>
                <p className="text-[10px] text-slate-400">Texto universal</p>
              </div>
            </button>
          </div>
        </div>

        {/* Resumen de columnas */}
        <div className="p-3 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Información incluida en el archivo:</span>
          </div>
          <p className="leading-relaxed">
            Nombre, Cédula/NIT, Celular WhatsApp, Dirección, Saldo de Deuda, Compras históricas, Categorías y Notas.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEjecutarExportacion}
            disabled={procesando || listaAExportar.length === 0}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {procesando ? (
              "Descargando..."
            ) : (
              <>
                <Download size={15} /> Descargar {formato.toUpperCase()}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
