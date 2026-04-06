# Receptionist VRM Avatar — Model & Animations (Detailed)

This document explains how the receptionist VRM avatar is loaded, positioned, and animated in the Three.js stage, and how/why animation retargeting is handled the way it is.

## Where the code lives

Core runtime files:

- `src/features/receptionist/avatar/VrmAvatarStage.tsx`
  - Creates the Three.js scene/camera/renderer.
  - Loads the `.vrm` file.
  - Applies base transform fixes (facing direction + grounding).
  - Runs the per-frame update loop (blink, micro head motion, lip sync, VRM update, animation mixer update).

- `src/features/receptionist/avatar/VrmAssistantAnimationSystem.ts`
  - Loads external animation assets from `public/animations/`.
  - Retargets them to the VRM’s skeleton.
  - Sanitizes tracks (removes root motion / problematic tracks).
  - Plays stateful idle/thinking/talking actions via `THREE.AnimationMixer`.

Assets:

- `public/animations/idle.fbx`
- `public/animations/Thinking.fbx`
- `public/animations/talkingloop.glb`

These are served by Next.js as:

- `/animations/idle.fbx`
- `/animations/Thinking.fbx`
- `/animations/talkingloop.glb`

## VRM bones: “raw” vs “normalized” (critical)

`@pixiv/three-vrm` exposes a humanoid component with two representations of the rig:

- **Raw bones** (`humanoid.getRawBoneNode(...)`)
  - These are the actual `THREE.Bone` nodes that the skinned meshes are bound to.
  - If you animate these bones, the mesh visibly deforms.

- **Normalized bones** (`humanoid.getNormalizedBoneNode(...)`)
  - These are **not** `THREE.Bone` nodes; they are plain `THREE.Object3D` nodes created by three-vrm.
  - They exist to provide a consistent, normalized humanoid coordinate system across models.

Three-vrm has a flag:

- `humanoid.autoUpdateHumanBones`
  - When `true`, `vrm.update(delta)` copies the pose from normalized bones to raw bones every frame.
  - When `false`, `vrm.update(delta)` does **not** overwrite raw bones.

### Why animations previously looked “not playing”

If an animation system writes to raw bones **but** `humanoid.autoUpdateHumanBones` is `true`, the next `vrm.update(delta)` can overwrite those bone transforms. The result is:

- The mixer updates happen, but you don’t see motion, because the rendered skeleton is being reset.

### Current approach

For external FBX/GLB animation playback, the stage uses:

- **Animate raw bones**
- Set `humanoid.autoUpdateHumanBones = false`

This makes animation playback visible and prevents `vrm.update()` from fighting the mixer.

## Model load + base transform pipeline

When the VRM finishes loading in `VrmAvatarStage.tsx`, we perform a strict base setup:

1. **Disable spring bones** (secondary physics) to avoid jiggle/instability.
2. **Disable humanoid auto-update**:
   - `humanoid.autoUpdateHumanBones = false`
3. **Reset model transform**:
   - `vrm.scene.scale = (1,1,1)`
   - `vrm.scene.position = (0,0,0)`
   - `vrm.scene.rotation = (0, π, 0)` (face forward consistently)
4. **Ground the model using a bounding box**:
   - Compute `Box3` over `vrm.scene`
   - Shift `vrm.scene.position.y -= box.min.y`
   - This puts the lowest point of the mesh at Y=0 (prevents “sinking”).

Important note: grounding is applied once after load (not continuously per-frame).

## Debug base transform overrides

The avatar is attached to a stable parent group (`avatarGroup`).

- The VRM’s _own_ `vrm.scene` transform is treated as a base canonical transform.
- Optional debug offsets (position/rotation/scale) are applied to `avatarGroup` so they do not conflict with animation mixing.

Persistence:

- `localStorage["receptionistAvatarTransformEnabled"]`
- `localStorage["receptionistAvatarTransform"]`

Live refresh is triggered via:

- Custom event: `receptionist:avatar-transform`
- `storage` event

## Animation system overview

### States

The assistant animation state machine has 3 states:

- `idle`
- `thinking`
- `talking`

The stage selects the state using `mode` (`idle`/`processing`/`speaking`) and an optional override event.

### Loading external clips

`VrmAssistantAnimationSystem.ts` loads one clip per state:

- idle → `idle.fbx`
- thinking → `Thinking.fbx`
- talking → `talkingloop.glb`

### Retargeting

External animations often use a different skeleton naming/hierarchy (e.g. Mixamo). We retarget using:

- `three/addons/utils/SkeletonUtils.retargetClip(...)`

A simple name-normalization strategy builds a target→source bone map:

- removes common prefixes like `mixamorig`, `j_bip`, `bip001`
- normalizes left/right tokens
- collapses separators

### Preventing the “1-second snap”

`SkeletonUtils.retargetClip(...)` **mutates the target skeleton during conversion** (it samples the animation frame-by-frame and writes poses onto the target).

If you retarget onto the live avatar skeleton, you can get a visible snap when the async clip load/retarget finishes.

Fix:

- Retarget onto a **detached cloned VRM scene** (not rendered)
- Use the resulting retargeted clip (bone-name-based tracks) to animate the live skeleton

This keeps conversion side-effects off the visible avatar.

### Track sanitization (root motion + stability)

After retargeting, clips are sanitized to reduce common VRM-stage failures:

- Remove **all** `.position` tracks (prevents root motion / drifting / sinking)
- Remove **all** `.scale` tracks
- Remove root `.` rotation/quaternion tracks (non-bone bindings)
- Remove **hips rotation/quaternion** tracks (common source of facing flips in Mixamo-style clips)

Sanitization happens in `sanitizeAssistantClip(...)`.

## Update loop ordering (per frame)

The stage updates in this order:

1. Apply debug transform to `avatarGroup`
2. Blink (expressions)
3. Choose desired animation state + cross-fade if needed
4. Subtract previous micro offsets from head/neck
5. `animSystem.update(delta)` → `mixer.update(delta)`
6. Re-apply micro head/neck offsets
7. Update look-at target drift
8. Lip sync updates (expressions)
9. `vrm.update(delta)`

### Why the code subtracts + re-adds micro offsets

The micro offsets are additive “polish” rotation offsets. Subtracting them before the mixer update ensures the mixer writes a clean base pose, then we add micro motion on top.

## Troubleshooting checklist

If the avatar still breaks or doesn’t move:

1. **Confirm animation assets are reachable**
   - In browser devtools Network tab, verify `/animations/idle.fbx` returns 200.

2. **Check console errors**
   - The frame loop now logs: `[receptionist-avatar] frame update failed` if something throws.

3. **Verify VRM humanoid mode**
   - Ensure `humanoid.autoUpdateHumanBones` is `false` (raw-bone animation mode).

4. **Confirm bones binding exists**
   - The mixer uses `.bones[Name]` bindings; the mixer root must have a `.bones` array.

5. **Temporarily remove sanitization to isolate the issue**
   - If removing sanitization makes motion visible but unstable, re-enable and narrow the filter.

## Adding / swapping animations

- Put files in `public/animations/`
- Ensure the filenames match what the loader expects:
  - `idle.fbx`
  - `Thinking.fbx`
  - `talkingloop.glb`

If you add a new format:

- FBX: handled by `FBXLoader`
- GLB/GLTF: handled by `GLTFLoader`

## Known limitations

- Removing hips rotation will reduce whole-body turning in some clips.
- SkeletonUtils retargeting is heuristic-based; very different rigs may still require manual mapping.

---

If you want, I can also add a small optional dev-only log block to print which tracks remain after sanitization (names + counts). That usually makes it obvious which specific track is breaking the pose.
