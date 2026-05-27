"""
Normalización y validación de ciudades colombianas.

Tres funciones principales:
  1. normalize_city(raw)   → nombre canónico ("BOGOTA D.C." → "Bogotá")
  2. is_ambiguous(city)    → True si el nombre existe en 2+ departamentos
  3. normalize_city_col(series) → aplica normalize_city a toda una columna
"""
import unicodedata
import re

# ── Paso 1: limpiar texto crudo ───────────────────────────────────────────────

def _clean(raw: str) -> str:
    """Minúsculas, sin tildes, sin puntos/comas extra, espacios normalizados."""
    s = raw.strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")   # quitar diacríticos
    s = re.sub(r"[.\-_]", " ", s)          # puntos/guiones → espacio
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── Paso 2: tabla de canonización ────────────────────────────────────────────
# Formato: "forma_limpia_sin_tildes": "Nombre Canónico con tildes correcto"
# Agregar aquí cualquier variante que llegue en los Excel.

CITY_CANON: dict[str, str] = {
    # ── Bogotá ────────────────────────────────────────────────────────────────
    "bogota":               "Bogotá",
    "bogota d c":           "Bogotá",
    "bogota dc":            "Bogotá",
    "bogota d.c":           "Bogotá",
    "bogota d.c.":          "Bogotá",
    "bogota d c ":          "Bogotá",
    "santafe de bogota":    "Bogotá",
    "santa fe de bogota":   "Bogotá",
    "bog":                  "Bogotá",

    # ── Medellín ──────────────────────────────────────────────────────────────
    "medellin":             "Medellín",
    "medallo":              "Medellín",
    "med":                  "Medellín",

    # ── Cali ──────────────────────────────────────────────────────────────────
    "cali":                 "Cali",
    "santiago de cali":     "Cali",

    # ── Barranquilla ──────────────────────────────────────────────────────────
    "barranquilla":         "Barranquilla",
    "bquilla":              "Barranquilla",
    "bquilla atl":          "Barranquilla",
    "barranquilla atl":     "Barranquilla",

    # ── Cartagena ─────────────────────────────────────────────────────────────
    "cartagena":            "Cartagena",
    "cartagena de indias":  "Cartagena",
    "ctg":                  "Cartagena",

    # ── Bucaramanga ───────────────────────────────────────────────────────────
    "bucaramanga":          "Bucaramanga",
    "buca":                 "Bucaramanga",

    # ── Cúcuta ────────────────────────────────────────────────────────────────
    "cucuta":               "Cúcuta",
    "san jose de cucuta":   "Cúcuta",
    "cucuta nts":           "Cúcuta",

    # ── Pereira ───────────────────────────────────────────────────────────────
    "pereira":              "Pereira",
    "pereira ris":          "Pereira",

    # ── Manizales ─────────────────────────────────────────────────────────────
    "manizales":            "Manizales",
    "manizales cal":        "Manizales",

    # ── Ibagué ────────────────────────────────────────────────────────────────
    "ibague":               "Ibagué",
    "ibague tol":           "Ibagué",

    # ── Villavicencio ─────────────────────────────────────────────────────────
    "villavicencio":        "Villavicencio",
    "villavo":              "Villavicencio",
    "vlle":                 "Villavicencio",

    # ── Neiva ─────────────────────────────────────────────────────────────────
    "neiva":                "Neiva",
    "neiva hui":            "Neiva",

    # ── Pasto ─────────────────────────────────────────────────────────────────
    "pasto":                "Pasto",
    "san juan de pasto":    "Pasto",

    # ── Armenia ───────────────────────────────────────────────────────────────
    "armenia":              "Armenia",
    "armenia qui":          "Armenia",

    # ── Montería ──────────────────────────────────────────────────────────────
    "monteria":             "Montería",
    "monteria cor":         "Montería",

    # ── Valledupar ────────────────────────────────────────────────────────────
    "valledupar":           "Valledupar",
    "valledupar ces":       "Valledupar",

    # ── Santa Marta ───────────────────────────────────────────────────────────
    "santa marta":          "Santa Marta",
    "santa marta mag":      "Santa Marta",

    # ── Sincelejo ─────────────────────────────────────────────────────────────
    "sincelejo":            "Sincelejo",

    # ── Riohacha ──────────────────────────────────────────────────────────────
    "riohacha":             "Riohacha",

    # ── Quibdó ────────────────────────────────────────────────────────────────
    "quibdo":               "Quibdó",

    # ── Florencia ─────────────────────────────────────────────────────────────
    "florencia":            "Florencia",
    "florencia caq":        "Florencia",

    # ── Arauca ────────────────────────────────────────────────────────────────
    "arauca":               "Arauca",

    # ── Yopal ─────────────────────────────────────────────────────────────────
    "yopal":                "Yopal",

    # ── Mocoa ─────────────────────────────────────────────────────────────────
    "mocoa":                "Mocoa",

    # ── Mitú ──────────────────────────────────────────────────────────────────
    "mitu":                 "Mitú",

    # ── San Andrés ────────────────────────────────────────────────────────────
    "san andres":           "San Andrés",
    "san andres isla":      "San Andrés",

    # ── Municipios frecuentes en courier ─────────────────────────────────────
    "itagui":               "Itagüí",
    "envigado":             "Envigado",
    "bello":                "Bello",
    "sabaneta":             "Sabaneta",
    "la estrella":          "La Estrella",
    "caldas":               "Caldas",
    "copacabana":           "Copacabana",
    "girardota":            "Girardota",
    "barbosa":              "Barbosa",
    "guarne":               "Guarne",
    "rionegro":             "Rionegro",
    "marinilla":            "Marinilla",

    "soacha":               "Soacha",
    "chia":                 "Chía",
    "zipaquira":            "Zipaquirá",
    "facatativa":           "Facatativá",
    "mosquera":             "Mosquera",
    "madrid":               "Madrid",
    "funza":                "Funza",
    "cajica":               "Cajicá",
    "tocancipa":            "Tocancipá",
    "la calera":            "La Calera",
    "cota":                 "Cota",
    "bojaca":               "Bojacá",

    "palmira":              "Palmira",
    "buenaventura":         "Buenaventura",
    "buga":                 "Buga",
    "guadalajara de buga":  "Buga",
    "tulua":                "Tuluá",
    "cartago":              "Cartago",
    "yumbo":                "Yumbo",
    "jamundi":              "Jamundí",

    "soledad":              "Soledad",
    "malambo":              "Malambo",
    "puerto colombia":      "Puerto Colombia",

    "floridablanca":        "Floridablanca",
    "giron":                "Girón",
    "piedecuesta":          "Piedecuesta",
    "lebrija":              "Lebrija",

    "los patios":           "Los Patios",
    "villa del rosario":    "Villa del Rosario",
    "villa rosario":        "Villa del Rosario",

    "dosquebradas":         "Dosquebradas",
    "santa rosa de cabal":  "Santa Rosa de Cabal",
    "la virginia":          "La Virginia",

    "pitalito":             "Pitalito",
    "garzon":               "Garzón",
    "la plata":             "La Plata",

    "apartado":             "Apartadó",
    "apartado ant":         "Apartadó",
    "chigorodo":            "Chigorodó",
    "turbo":                "Turbo",
    "carepa":               "Carepa",

    "la dorada":            "La Dorada",
    "honda":                "Honda",

    "tunja":                "Tunja",
    "duitama":              "Duitama",
    "sogamoso":             "Sogamoso",

    "aeropuerto medellin":  "Aeropuerto Medellín",
    "aeropuerto bogota":    "Aeropuerto Bogotá",
    "aeropuerto cali":      "Aeropuerto Cali",

    "villa de leyva":       "Villa de Leyva",
    "paicol":               "Paicol",
}


# ── Paso 3: ciudades con nombre ambiguo (existen en 2+ departamentos) ─────────
# Guardados ya sin tildes y en minúsculas para comparación directa

AMBIGUOUS_CITIES: set[str] = {
    # Nombre canónico sin tildes en minúsculas
    "villanueva",       # Guajira y Casanare
    "san jose",         # Muchos departamentos
    "san juan",         # Varios
    "la union",         # Valle del Cauca y Nariño
    "el carmen",        # Chocó, Norte de Santander, Bolívar, Antioquia
    "el carmen de bolivar",
    "santa rosa",       # Cabal (Risaralda), de Osos (Antioquia), de Viterbo (Caldas)
    "san carlos",       # Antioquia y Córdoba
    "san marcos",       # Sucre y otros
    "albania",          # Guajira, Santander y Caquetá
    "el retiro",        # Antioquia y otros
    "concordia",        # Antioquia y Magdalena
    "el penol",         # Antioquia y Nariño
    "san gil",          # Santander (único pero confundible con San Gil de otros)
    "palmira",          # Valle (principal) pero hay Palmira en otros
    "la mesa",          # Cundinamarca y otros municipios pequeños
    "san pedro",        # Antioquia, Urabá, Valle, Sucre
    "san antonio",      # Tolima, Tequendama, otros
    "la paz",           # Cesar y Santander
    "el banco",         # Magdalena (único pero ambiguo geográficamente)
    "la gloria",        # Cesar y Caldas
    "san martin",       # Meta y Cesar
    "magangue",         # Bolívar (único pero confundido con Magangué)
    "el copey",         # Cesar
    "san onofre",       # Sucre
    "puerto rico",      # Caquetá y Meta
    "la montanita",     # Caquetá
    "puerto asis",      # Putumayo (único pero confundible)
    "santa barbara",    # Antioquia, Nariño, Santander
    "san bernardo",     # Cundinamarca y Nariño
    "la victoria",      # Valle y otros
    "el dovio",         # Valle
    "bolivar",          # Cauca, Antioquia, Santander, Valle
    "san francisco",    # Antioquia y Putumayo
    "el litoral",       # Varios
    "san rafael",       # Antioquia y otros
    "san roque",        # Antioquia y otros
    "campamento",       # Antioquia
    "guadalupe",        # Santander, Antioquia, Huila
    "el aguila",        # Valle
    "ansermanuevo",     # Valle
    "la celia",         # Risaralda
    "belen",            # Boyacá, Nariño, Antioquia
    "belen de umbria",  # Risaralda
}


# ── API pública ───────────────────────────────────────────────────────────────

def normalize_city(raw: str) -> str:
    """
    Convierte cualquier variante de ciudad al nombre canónico.
    Si no está en la tabla, devuelve el texto con Title Case limpio.
    """
    if not raw or not raw.strip():
        return raw
    key = _clean(raw)
    if key in CITY_CANON:
        return CITY_CANON[key]
    # Capitalización inteligente como fallback
    return " ".join(w.capitalize() for w in raw.strip().split())


def is_ambiguous(city_canonical: str) -> bool:
    """
    Dado un nombre canónico (ej: "Villanueva"), indica si es ambiguo.
    """
    key = _clean(city_canonical)
    return key in AMBIGUOUS_CITIES


def normalize_city_series(series: "pd.Series") -> "pd.Series":
    """Aplica normalize_city a toda una columna Ciudad."""
    return series.map(normalize_city)
