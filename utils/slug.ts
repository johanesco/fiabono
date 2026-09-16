// utils/slug.ts
// Generador de slug representativo y limpio para el negocio y sus colaboradores

/**
 * Normaliza y extrae un slug corto, memorable y representativo para el negocio.
 * Remueve tildes, caracteres especiales y palabras comunes no distintivas (stop words)
 * como "Variedades", "Almacén", "Tienda", etc.
 *
 * Ejemplos:
 *  - "Variedades Las Camellas" -> "lascamellas"
 *  - "Almacén Ofe" -> "almacenofe"
 *  - "Supermercado El Éxito" -> "elexito"
 */
export function generarSlugNegocio(nombre: string): string {
  if (!nombre || typeof nombre !== 'string') return "negocio";

  // Normalizar acentos y pasar a minúsculas
  let limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // Remover palabras genéricas iniciales de comercios si van seguidas de más palabras
  const prefijosGenericos = [
    /^variedades\s+/,
    /^almacen\s+/,
    /^almacenes\s+/,
    /^tienda\s+/,
    /^distribuidora\s+/,
    /^comercializadora\s+/,
    /^supermercado\s+/,
    /^minimarket\s+/,
    /^papeleria\s+/,
    /^drogueria\s+/,
    /^farmacia\s+/,
    /^ferreteria\s+/,
    /^boutique\s+/,
    /^miscelanea\s+/,
    /^cigarreria\s+/,
    /^licorera\s+/
  ];

  for (const prefijo of prefijosGenericos) {
    if (prefijo.test(limpio)) {
      const candidato = limpio.replace(prefijo, '').trim();
      if (candidato.length >= 2) {
        limpio = candidato;
        break;
      }
    }
  }

  // Eliminar espacios y símbolos dejando solo caracteres alfanuméricos
  limpio = limpio.replace(/[^a-z0-9]/g, "");

  // Si quedó demasiado corto o vacío por símbolos extremos, usar el nombre directo saneado
  if (limpio.length < 2) {
    const alternativo = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    limpio = alternativo || "negocio";
  }

  // Limitar longitud máxima a 20 caracteres para que los usuarios sean cómodos de tipear
  return limpio.slice(0, 20);
}

/**
 * Limpia el nombre de usuario que ingresa el administrador para el colaborador.
 * Remueve espacios, guiones y caracteres no válidos.
 *
 * Ejemplo: "Carlos Andrés" -> "carlosandres"
 */
export function limpiarUsuarioColaborador(usuario: string): string {
  if (!usuario || typeof usuario !== 'string') return "";
  return usuario
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
