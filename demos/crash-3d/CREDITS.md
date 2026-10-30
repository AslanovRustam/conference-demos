# Credits

## Sound

All sound is synthesized in the browser with the Web Audio API (`src/audio/`): the engine roar and rumble, the
riser, the countdown beeps, the cash-out, parachute and explosion effects and the ambient music pad. No recorded or
third-party audio files are used.

## Brand

The Clickable logo and the Clickable Black font come from the shared brand kit (`shared/brand/`) and belong to
Clickable. Montserrat is licensed under the SIL Open Font License 1.1.

## Imagery

Prepared by `scripts/prepare-textures.mjs` (resized; the ocean mask is derived from the day map). All NASA imagery is
in the public domain.

| File | Source |
|---|---|
| `public/textures/earth/8k/day.jpg`, `specular.jpg` | NASA Visible Earth, Blue Marble Next Generation with topography and bathymetry (December 2004): https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg |
| `public/textures/earth/8k/night.jpg` | NASA Earth Observatory, Black Marble 2016: https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg |
| `public/textures/earth/8k/clouds.jpg` | NASA Visible Earth, Blue Marble cloud composite: https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif |
| `public/textures/moon/moon-4k.jpg` | NASA Scientific Visualization Studio, CGI Moon Kit (LRO colour mosaic): https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif |

## Original work

The app icon (`public/icon.svg` and the PWA icons generated from it), the rocket, the launch pad, the orbital station
and every effect (clouds, plume, explosion, nebulae, warp, aurora, meteors) are made for this demo, procedurally or in
code. No third-party models or textures beyond the NASA imagery above.
