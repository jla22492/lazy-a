# WORK ORDER 0001 — Initialize the Lazy A Engine

## Plan
- [x] Scaffold Next.js (App Router, TS, Tailwind, ESLint) at repo root
- [x] Install three, @react-three/fiber, @react-three/drei, gsap, leva, prettier
- [x] Create folder structure (components/{room,camera,ui,interactions}, three/{scene,lighting,materials,animation,hooks}, public/{models,textures,videos,audio}, WORK_ORDERS/)
- [x] Full-viewport R3F scene: perspective camera, ambient + directional light, neutral floor plane, neutral gray background — nothing else
- [x] CameraRig exposing sit() / lean() / stand() / turn() (empty bodies)
- [x] Verify: strict TS, npm run build passes, npm run dev renders canvas

## Review
- `npm run build` passes (strict TypeScript, ESLint clean, Prettier clean).
- Dev server verified in browser: full-viewport WebGL canvas (matches viewport exactly), floor plane + horizon against neutral gray, zero console errors.
- Scene constants centralized in `three/scene/constants.ts` — no magic numbers in components.
- CameraRig exposes only the four human verbs via a typed ref handle; bodies intentionally empty per work order.
- Deferred: everything in the OUT OF SCOPE list; Leva installed but not mounted (nothing to debug yet); GSAP installed but unused (no animation in scope).
- Note: source-of-truth docs live at repo root, not `docs/` as the work order states.
