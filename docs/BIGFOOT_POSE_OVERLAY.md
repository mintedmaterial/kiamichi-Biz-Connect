# Bigfoot pose/overlay package

The KBC social pipeline uses a deterministic mascot overlay instead of asking an image model to redraw Bigfoot inside every business image.

## Asset contract

Publish six transparent PNGs to the `IMAGES` R2 bucket at:

```text
mascots/bigfoot/v1/poses/wave.png
mascots/bigfoot/v1/poses/point.png
mascots/bigfoot/v1/poses/thumbs-up.png
mascots/bigfoot/v1/poses/thinking.png
mascots/bigfoot/v1/poses/celebrate.png
mascots/bigfoot/v1/poses/walk.png
```

Each asset should be a full-body, warm-brown, friendly Bigfoot Jr. with consistent proportions and a transparent background. Do not bake speech bubbles, business names, logos, or generated text into the PNGs.

## Runtime

`src/bigfoot-pose-overlay.ts` provides:

- Stable pose selection from `postType`, `businessId`, and an optional seed.
- Stable speech/thought/no-bubble selection.
- R2 URL/key resolution with versioning.
- Escaped SVG rendering for exact business copy.
- Provenance metadata for each generated social asset.

The renderer intentionally does not use `Math.random()` and does not route copy through image generation.

## QA gate

Before publishing a pose pack:

1. Confirm all six PNGs have alpha transparency.
2. Confirm the face, fur palette, eye style, muzzle, and proportions match across poses.
3. Confirm no text, logos, signage, or bubbles are present in the PNGs.
4. Render each pose over a representative business image.
5. Verify speech/thought copy is exact and legible in the SVG composition.
6. Record asset hashes and version in the deployment manifest.
