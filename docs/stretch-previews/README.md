# Stretch previews

Rendered with Playwright from the dev-only `#/preview/<exerciseId>` route (right side working).
For every stretch and both bodies: start of enter, mid-hold and end of exit, from the front,
side and three-quarter views.

- `female/<id>.sheet.jpg`, `male/<id>.sheet.jpg`: 3×3 contact sheet per stretch
  (rows: start of enter, mid-hold, end of exit; columns: front, side, three-quarter)
- `female/<id>--<clip>-<view>.jpg`: the individual frames
- `overview-female.jpg`, `overview-male.jpg`: every stretch at mid-hold, three-quarter view

The wall is a one-sided plane, so from the front and three-quarter views (camera behind the
wall plane) it is not drawn and the hands appear to rest on air.
