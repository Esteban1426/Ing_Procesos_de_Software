# Calendario Millonarios F.C.

Calendario web en **React + TypeScript (TSX)** con diseño inspirado en Millonarios F.C. (colores y escudo). Incluye vista de próximos partidos, eventos/reuniones y login de administrador para gestionar el contenido.

## Funcionalidades

- **Vistas del calendario**: mes, semana y día.
- **Eventos**: reuniones y eventos personalizados (solo el admin puede crear, editar y eliminar).
- **Partidos**: próximos partidos de Millonarios mostrados automáticamente (solo lectura).
- **Login**: botón "Iniciar sesión" en la esquina superior derecha. Credenciales de administrador:
  - Usuario: `Administrador`
  - Contraseña: `1426Esteban` (puedes cambiarlas en `src/context/AuthContext.tsx` antes de desplegar).
- **Diseño**: colores oficiales del club (#0C54A0, blanco) y escudo en cabecera y login.

## Estructura del proyecto

```
ProyectoClaudeCode/
├── public/           # crest.svg, favicon
├── src/
│   ├── components/   # Header, Calendar, EventModal, LoginModal, UpcomingMatches
│   ├── context/      # AuthContext, EventsContext
│   ├── data/         # millonariosMatches.ts (partidos de ejemplo)
│   ├── utils/        # dateUtils
│   ├── App.tsx, main.tsx, index.css
│   └── types.ts
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vercel.json
```

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

## Despliegue en GitHub y Vercel

1. Crea un repositorio en GitHub y sube el proyecto.
2. En [Vercel](https://vercel.com), importa el repositorio.
3. Framework: **Vite**. Build: `npm run build`. Output: `dist`.
4. Despliega. La URL quedará accesible para cualquiera.

Los eventos personalizados se guardan en `localStorage` del navegador (no hay backend). Los partidos se leen del archivo `src/data/millonariosMatches.ts`; puedes actualizarlo manualmente o conectar en el futuro una API de partidos.

## Cambiar contraseña de admin

Edita en `src/context/AuthContext.tsx` las constantes `ADMIN_USER` y `ADMIN_PASSWORD` y vuelve a desplegar.
