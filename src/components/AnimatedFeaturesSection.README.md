# AnimatedFeaturesSection Component

Componente de React con efecto de destello/shimmer/shine animado, copiado y adaptado desde el proyecto `v0-lelo-saas-landing`.

## 🎨 Efecto Visual

El componente incluye un **efecto de destello (shine)** que atraviesa las tarjetas cada 4 segundos, creando un brillo suave que se desliza de izquierda a derecha con una inclinación de -12 grados.

## 📦 Archivos Creados

1. **`AnimatedFeaturesSection.tsx`** - Componente principal con las tarjetas animadas
2. **`AnimatedFeaturesDemo.tsx`** - Ejemplo de uso con datos de Ad Insight Hub
3. **`index.css`** - Keyframes de la animación `@keyframes shine`

## 🚀 Uso Básico

```tsx
import { AnimatedFeaturesSection } from '@/components/AnimatedFeaturesSection';
import { BarChart3, Shield } from 'lucide-react';

const features = [
  {
    title: "Análisis Avanzado",
    value: "Tiempo Real",
    subtitle: "Obtén insights profundos sobre el rendimiento de tus campañas",
    icon: <BarChart3 className="w-8 h-8" />,
    span: "md:col-span-2" // Opcional: clase de Tailwind para grid span
  },
  {
    title: "Seguridad",
    value: "Nivel Bancario",
    subtitle: "Encriptación de extremo a extremo",
    icon: <Shield className="w-8 h-8" />
  }
];

<AnimatedFeaturesSection
  features={features}
  sectionTitle="Características Principales"
  sectionSubtitle="Todo lo que necesitas para crecer"
/>
```

## 🎯 Props

### `AnimatedFeaturesSection`

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `features` | `Feature[]` | **requerido** | Array de objetos con la información de cada tarjeta |
| `sectionTitle` | `string` | `"Características Principales"` | Título de la sección |
| `sectionSubtitle` | `string` | `"Todo lo que necesitas..."` | Subtítulo de la sección |

### `Feature` Object

```typescript
{
  title: string;           // Título de la tarjeta
  value: string | number;  // Valor principal (grande y destacado)
  subtitle?: string;       // Descripción opcional
  icon?: React.ReactNode;  // Ícono opcional (lucide-react)
  span?: string;           // Clase Tailwind para grid (ej: "md:col-span-2")
}
```

## ✨ Características

- ✅ **Efecto Shine**: Destello animado que atraviesa las tarjetas cada 4 segundos
- ✅ **Animaciones Framer Motion**: Entrada suave con fade-in y stagger
- ✅ **Textura de Ruido**: Overlay sutil para dar profundidad visual
- ✅ **Gradientes Dinámicos**: Fondos con gradientes púrpura/azul
- ✅ **Responsive**: Grid adaptable de 1 columna (móvil) a 3 columnas (desktop)
- ✅ **Personalizable**: Soporta span de grid para layouts flexibles
- ✅ **TypeScript**: Completamente tipado

## 🎨 Personalización del Efecto Shine

El efecto shine está definido en `src/index.css`:

```css
@keyframes shine {
  0% {
    transform: translateX(-100%) skewX(-12deg);
  }
  100% {
    transform: translateX(200%) skewX(-12deg);
  }
}
```

Para modificar la velocidad, edita la clase en el componente:
```tsx
animate-[shine_4s_ease-in-out_infinite]
//           ↑ Cambia este valor (ej: 2s, 6s)
```

## 🎭 Integración en MarketingPage

El componente ya está integrado en `src/pages/MarketingPage.tsx` usando el wrapper `AnimatedFeaturesDemo`.

```tsx
import { AnimatedFeaturesDemo } from '@/components/AnimatedFeaturesDemo';

// En el JSX:
<AnimatedFeaturesDemo />
```

## 🎨 Colores Personalizados

El componente usa los colores del theme de Ad Insight Hub:
- Gradientes: `from-purple-400 to-blue-400`
- Fondos: `from-slate-900 via-purple-900/20 to-slate-900`
- Bordes: `border-purple-500/20`

Para cambiar los colores, modifica las clases Tailwind en `AnimatedFeaturesSection.tsx`.

## 📝 Notas

- El componente requiere **Framer Motion** (`framer-motion`) que ya está instalado en el proyecto
- Los íconos son de **Lucide React** (`lucide-react`)
- La animación es performante y no afecta el rendimiento en dispositivos móviles
- El efecto shine tiene `opacity-80` para ser sutil y no distraer del contenido

## 🔗 Fuente Original

Copiado y adaptado desde: `v0-lelo-saas-landing/components/animated-features-section.tsx`

**Adaptaciones realizadas:**
- ✅ Cambio de esquema de colores de monocromo (blanco/negro) a purple/blue
- ✅ Renombrado de "LeLo" a "Ad Insight Hub"
- ✅ Ajuste de props para mayor flexibilidad
- ✅ Adaptación al theme de Tailwind del proyecto
- ✅ Optimización para el contexto de auditoría de campañas publicitarias
