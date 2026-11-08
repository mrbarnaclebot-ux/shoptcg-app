# components

Shared UI used by more than one route.

- `ui/`: shadcn primitives (button, card, input, label).
- `toast-root.tsx`: the one Sileo `<Toaster />`, reduced-motion `MotionConfig`, offline toasts, the assertive alert region. Toast copy lives in `src/lib/toast.ts`.
- `rip-moment.tsx`: Direction C celebration (store created, first item, sale confirmed).
- `slab-head.tsx`: Direction B section header (rule, label, ruler ticks).
- `stepper.tsx`, `continuous-tabs.tsx`, `labeled-progress-indicator.tsx`: adapted Watermelon UI components (MIT); each file header lists what changed from upstream.
- `card-thumb.tsx`, `segmented.tsx`, `wordmark.tsx`: small app pieces.
