# Agent Color Schemes

Agent units use palette‑based colors so teams can swap themes or add new ones without changing gameplay.

## Switching Palettes

- Choose the active palette in settings or config.
- Restart the app if needed; new agents spawn using the active palette and existing UI surfaces read from the same source.

## Built-in Palettes

### `default` – VibeCraft Default

- coral `#ff6b6b`
- sky `#4dabf7`
- amber `#ffd93d`
- mint `#51cf66`
- grape `#845ef7`
- apricot `#ffa94d`
- teal `#1ce6b9`
- rose `#ff8787`

### `wc3PlayerColors` – WC3 Player Colors

- red `#ff0303`
- blue `#0042ff`
- teal `#1ce6b9`
- purple `#540081`
- yellow `#fffc00`
- orange `#fe8a0e`
- green `#20c000`
- pink `#e55bb0`
- gray `#959697`
- light blue `#7ebff1`
- dark green `#106246`
- brown `#4a2a04`
- maroon `#9b0000`
- navy `#0000c3`
- turquoise `#00eaff`
- violet `#be00fe`
- wheat `#ebcd87`
- peach `#f8a48b`
- mint `#bfff80`
- lavender `#dcb9eb`
- coal `#282828`
- snow `#ebf0ff`
- emerald `#00781e`
- peanut `#a46f33`

## Adding a New Palette

1. Define a new palette with a unique key, label, and ordered list of `{ name, hex }` pairs.
2. Set the active palette to that key.
3. Keep hex values in `#rrggbb` format so rendering stays consistent.
