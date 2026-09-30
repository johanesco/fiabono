export interface RubroNegocio {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string;
  categorias: string[];
}

export const RUBROS_NEGOCIOS: RubroNegocio[] = [
  {
    id: "moda_ropa",
    nombre: "Moda y Ropa",
    descripcion: "Boutiques, confección, tiendas de ropa",
    icono: "👗",
    color: "from-pink-500/10 to-rose-500/10 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-400",
    categorias: [
      "Ropa Dama",
      "Ropa Hombre",
      "Blusas y Camisas",
      "Pantalones y Jeans",
      "Vestidos y Conjuntos",
      "Ropa Interior y Pijamas",
      "Accesorios y Complementos",
      "Varios"
    ]
  },
  {
    id: "calzado_marroquineria",
    nombre: "Calzado y Marroquinería",
    descripcion: "Zapatos, tenis, bolsos, correas",
    icono: "👟",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    categorias: [
      "Calzado Dama",
      "Calzado Caballero",
      "Calzado Infantil",
      "Bolsos y Morrales",
      "Cuidado y Accesorios",
      "Varios"
    ]
  },
  {
    id: "jugueteria_pinateria",
    nombre: "Juguetería y Piñatería",
    descripcion: "Juguetes, piñatas, fiestas y bebés",
    icono: "🧸",
    color: "from-teal-500/10 to-emerald-500/10 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400",
    categorias: [
      "Juguetería",
      "Juegos de Mesa",
      "Bebés y Primera Infancia",
      "Artículos de Fiesta y Piñatas",
      "Peluches y Figuras",
      "Varios"
    ]
  },
  {
    id: "tecnologia_celulares",
    nombre: "Tecnología y Celulares",
    descripcion: "Smartphones, accesorios, servicio técnico",
    icono: "📱",
    color: "from-blue-500/10 to-cyan-500/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400",
    categorias: [
      "Celulares y Tablets",
      "Cargadores y Cables",
      "Estuches y Vidrios",
      "Audífonos y Audio",
      "Servicio Técnico / Reparación",
      "Varios"
    ]
  },
  {
    id: "belleza_peluqueria",
    nombre: "Belleza y Peluquería",
    descripcion: "Cosméticos, barbería, cuidado personal",
    icono: "💄",
    color: "from-purple-500/10 to-violet-500/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400",
    categorias: [
      "Cuidado Capilar",
      "Maquillaje",
      "Cuidado Facial y Corporal",
      "Perfumería",
      "Servicios y Tratamientos",
      "Varios"
    ]
  },
  {
    id: "joyeria_relojes",
    nombre: "Joyería y Bisutería",
    descripcion: "Cadenas, anillos, aretes, relojes",
    icono: "💍",
    color: "from-yellow-500/10 to-amber-500/10 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400",
    categorias: [
      "Cadenas y Collares",
      "Anillos y Argollas",
      "Aretes y Topos",
      "Pulseras y Manillas",
      "Relojes y Accesorios",
      "Varios"
    ]
  },
  {
    id: "tienda_minimarket",
    nombre: "Tienda y Minimarket",
    descripcion: "Abarrotes, bebidas, pasabocas, aseo",
    icono: "🛒",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400",
    categorias: [
      "Bebidas y Lácteos",
      "Snacks y Dulcería",
      "Abarrotes y Despensa",
      "Aseo y Limpieza",
      "Panadería y Pasabocas",
      "Varios"
    ]
  },
  {
    id: "papeleria_variedades",
    nombre: "Papelería y Variedades",
    descripcion: "Útiles, piñatería, regalos, cacharrería",
    icono: "📚",
    color: "from-indigo-500/10 to-blue-500/10 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400",
    categorias: [
      "Útiles Escolares y Oficina",
      "Juguetería",
      "Regalos y Empaques",
      "Impresiones y Servicios",
      "Hogar y Cacharrería",
      "Varios"
    ]
  },
  {
    id: "servicios_general",
    nombre: "Servicios y General",
    descripcion: "Mano de obra, talleres, comercio mixto",
    icono: "🛠️",
    color: "from-slate-500/10 to-slate-600/10 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
    categorias: [
      "Servicios / Mano de Obra",
      "Repuestos e Insumos",
      "Mantenimiento",
      "General",
      "Varios"
    ]
  }
];

export const CATEGORIAS_POR_DEFECTO_GENERAL = [
  "General",
  "Varios",
  "Servicios"
];
