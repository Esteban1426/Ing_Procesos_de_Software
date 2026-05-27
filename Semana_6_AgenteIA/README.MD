# 🚚 Agente IA Courier para Telegram

Bot inteligente para procesamiento y análisis de archivos Excel de despachos courier usando:

* 🤖 IA local con Ollama
* 📦 Telegram Bot
* 📊 Procesamiento avanzado de Excel
* ☁️ Integración con Supabase
* 🧠 Agente conversacional con herramientas IA

El proyecto permite automatizar operaciones logísticas, clasificación de despachos, búsquedas inteligentes y gestión de información directamente desde Telegram.

---

# ✨ Características principales

## 📥 Procesamiento automático de Excel

El bot recibe archivos `.xlsx` desde Telegram y automáticamente:

* Detecta columnas aunque tengan nombres distintos
* Normaliza nombres de ciudades
* Clasifica Bogotá y otras ciudades
* Detecta patrones numéricos
* Genera múltiples pestañas organizadas
* Marca ciudades ambiguas en amarillo
* Genera reportes listos para operación

---

## 🤖 Agente IA conversacional

Integración con Ollama para consultas en lenguaje natural.

Ejemplos:

```txt
Busca la guía 2849
```

```txt
Muéstrame los clientes con APX
```

```txt
¿Cuáles son las ciudades con más despachos?
```

```txt
Registra estas guías como revaluo
```

```txt
Sube el último Excel procesado a Supabase
```

---

## ☁️ Integración con Supabase

El sistema permite:

* CRUD completo sobre tablas
* Almacenamiento de Excels en Storage
* Descarga automática de archivos
* Gestión de revaluos y retenciones
* Historial de archivos procesados

---

# 🧠 Arquitectura del proyecto

```txt
Semana_6_AgenteIA/
│
├── bot.py                  # Bot principal de Telegram
├── ai_tools.py             # Herramientas IA y lógica del agente
├── excel_engine.py         # Procesamiento de Excel
├── city_normalize.py       # Normalización de ciudades
├── database.py             # Base de datos SQLite
├── config.py               # Configuración central
├── supabase_client.py      # Cliente Supabase
├── supabase_storage.py     # Gestión de Storage
├── requirements.txt
│
├── data/
│   ├── excels/
│   ├── processed/
│   └── bot.db
│
├── logs/
│   └── bot.log
│
└── .env
```

---

# ⚙️ Tecnologías utilizadas

## Backend

* Python 3.12+
* AsyncIO
* SQLite

## Telegram

* Aiogram 3

## IA Local

* Ollama
* Qwen

## Excel

* Pandas
* OpenPyXL

## Cloud

* Supabase
* Supabase Storage

---

# 📦 Instalación

## 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/Semana_6_AgenteIA.git
cd Semana_6_AgenteIA
```

---

## 2. Crear entorno virtual

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### Linux / Mac

```bash
python3 -m venv venv
source venv/bin/activate
```

---

## 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

---

# 🤖 Instalar Ollama

Descargar desde:

[https://ollama.com](https://ollama.com)

Luego instalar el modelo:

```bash
ollama pull qwen3:4b
```

También puedes usar:

* qwen3:8b
* llama3
* mistral
* deepseek

---

# 🔑 Configuración

Crear archivo `.env`

```env
# Telegram
BOT_TOKEN=TU_TOKEN
AUTHORIZED_USERS=123456789

# Ollama
OLLAMA_MODEL=qwen3:4b

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=TU_SERVICE_ROLE

# Storage
STORAGE_BUCKET=Excels
STORAGE_FOLDER_ORIGINALES=originales
STORAGE_FOLDER_PROCESADOS=procesados

# Configuración
MAX_FILE_MB=20
MAX_CONCURRENT_JOBS=3
HISTORY_TURNS=10
```

---

# ▶️ Ejecutar el bot

```bash
python bot.py
```

Si todo está correcto verás algo similar:

```txt
Bot iniciado correctamente
Modelo activo: qwen3:4b
```

---

# 📊 Funcionalidades del Excel

## Detección flexible de columnas

El sistema detecta automáticamente aliases como:

| Nombre canónico     | Alias soportados            |
| ------------------- | --------------------------- |
| Guia#               | guía, tracking, número guía |
| Ciudad              | destino, municipio          |
| Nombre Destinatario | cliente, receptor           |
| Peso-2              | peso, kg, weight            |

---

## Normalización de ciudades

Convierte variantes como:

```txt
Bogotá
BOGOTA
Bogota D.C.
Santafé de Bogotá
```

En un formato estándar.

---

## Clasificación automática

Genera hojas:

* Original
* Bogotá
* Ciudades y Municipios
* Hojas por patrón detectado

---

# 🤖 Herramientas IA disponibles

## Búsquedas

* Buscar guías
* Buscar clientes
* Filtrar ciudades
* Top ciudades
* Estadísticas de peso
* Estadísticas por patrón

---

## Supabase CRUD

* Insertar registros
* Consultar tablas
* Editar registros
* Eliminar registros

---

## Storage

* Subir Excel
* Descargar archivos
* Eliminar archivos
* Listar contenido

---

# 📱 Comandos del bot

| Comando      | Descripción          |
| ------------ | -------------------- |
| /start       | Iniciar bot          |
| /ayuda       | Mostrar ayuda        |
| /resumen     | Resumen del Excel    |
| /patrones    | Ver patrones         |
| /historial   | Últimos archivos     |
| /modelo      | Modelo activo        |
| /limpiar     | Limpiar conversación |
| /supabase    | Test conexión        |
| /storage     | Test bucket          |
| /revaluos    | Ver revaluos         |
| /retenciones | Ver retenciones      |

---

# 🗄️ Base de datos local

El proyecto usa SQLite para:

* Historial de archivos
* Acciones del usuario
* Conversaciones
* Registro operativo

Archivo:

```txt
data/bot.db
```

---

# ☁️ Supabase recomendado

## Buckets sugeridos

```txt
Excels/
├── originales/
└── procesados/
```

---

## Tablas sugeridas

### revaluos

```sql
create table revaluos (
  id bigint generated always as identity primary key,
  guia text,
  cliente text,
  ciudad text,
  revaluo text,
  created_at timestamp default now()
);
```

### retenciones

```sql
create table retenciones (
  id bigint generated always as identity primary key,
  guia text,
  cliente text,
  ciudad text,
  motivo text,
  created_at timestamp default now()
);
```

---



# 📝 .gitignore recomendado

```gitignore
venv/
.venv/
__pycache__/
*.pyc
.env
logs/
data/excels/
data/processed/
*.db
```

---

# 🚀 Futuras mejoras

Ideas para evolucionar el proyecto:

* Dashboard web
* OCR de guías
* Reconocimiento de PDFs
* Multiusuario
* Panel administrativo
* API REST
* Docker
* Integración WhatsApp
* Automatización masiva
* Entrenamiento de modelos propios

---

# 🧪 Ejemplos de uso

## Buscar cliente

```txt
Busca todos los clientes con APX
```

## Buscar guía

```txt
Busca la guía 7713090537
```

## Top ciudades

```txt
¿Cuáles son las ciudades con más despachos?
```

## Registrar revaluo

```txt
La guía 7713090537 tiene revaluo
```

---

# 📸 Flujo general

```txt
Telegram → Bot → Excel → IA → Supabase → Respuesta
```

---

# 📌 Requisitos mínimos

## Recomendado

* Ryzen 5 o superior
* 16GB RAM mínimo
* SSD
* Ollama instalado

## Modelos recomendados

| Modelo   | Recomendación      |
| -------- | ------------------ |
| qwen3:4b | Liviano y rápido   |
| qwen3:8b | Mejor razonamiento |
| llama3   | General            |
| deepseek | Programación       |

---

# 👨‍💻 Autor

Proyecto desarrollado como sistema inteligente de automatización courier usando IA local.

---

# 📄 Licencia

Uso educativo y privado.
