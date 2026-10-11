# Editing the research map in Inkscape

Open `research-map-editable.svg` in Inkscape. It is a vector editing copy of the
current map with all fields visible, exported on a 1200 × 852 canvas.

1. Select the **Field regions** layer and click the shape you want to change.
   The biophysics path has the ID `region-biophysics`.
2. Press **N** (the Node tool). Drag nodes, curve handles, or a curve segment
   to reshape the boundary. Use the Selector tool to move the whole shape.
3. Keep the canvas dimensions and object IDs. Save the edited SVG and send it
   back, or commit it to this folder, so its geometry can be transferred to the
   interactive map.

The field titles follow separate paths. Moving a filled region does not move its
title automatically. The title objects are in the **Labels** layer; their curve
paths are in the SVG definitions, with IDs such as
`research-map-boundary-biophysics`.

Inkscape's node-editing guide:
https://inkscape-manuals.readthedocs.io/en/1.1/editing-paths.html

## How the website uses these shapes

The website currently generates its SVG in `assets/research-map.js`. Saving this
editing copy does not automatically change the website. The map's colours remain
controlled by `assets/research-map.css`; this SVG contains a snapshot of the
colours in the fully revealed view.

For each large field, three pieces of the JavaScript work together:

- `region('biophysics', 'M … C … Z', …)` defines the filled boundary. The hover
  and click area is derived from the same path.
- `boundaryLabel('biophysics', 'Biophysics', 'M … C …')` places its curved title.
- `fields.biophysics.core` gives a preferred point for deciding which field is
  under the pointer when regions overlap.

The `topics` list determines which topics are highlighted when exploring a field.
Biophysics highlights microswimmers; active matter and soft matter appear as its
containing regions, without being assigned wholesale to biophysics.

For a manual transfer, the JavaScript uses a 700 × 852 base coordinate system:
multiply the exported SVG's x coordinates by **700 / 1200**, keeping y unchanged.
The current path helpers accept absolute `M`, `C`, and `Z` commands. Inkscape may
save relative commands or transforms, which must be normalized before copying a
path into the JavaScript. Sending the edited SVG back avoids that manual step.
