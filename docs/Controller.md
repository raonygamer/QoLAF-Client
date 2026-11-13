# Controller support

Open Settings → Input → Controller. Controller input is off until enabled. Settings are saved on this device, independently of the game's server settings.

## Default bindings

| Control (standard Gamepad layout) | Action |
| --- | --- |
| Left stick X | Turn left/right |
| Left stick Y | Forward/stop |
| Right trigger | Fire |
| Left trigger | Harden shield |
| Bottom face button (A / Cross) | Boost; respawn after death with a fresh press |
| Left face button (X / Square) | Damage boost |
| Right face button (B / Circle) | Shield convert |
| Top face button (Y / Triangle) | Land |
| Shoulder buttons | Previous/next available weapon |
| D-pad up/right/down/left | Weapons 1/2/3/4 |
| Left stick click | Weapon 5 |
| View / Share | Map |
| Menu / Options | Settings |

Each game action can be rebound or cleared. Select a binding, release the intended control, then press a button or move an axis. Capture times out after ten seconds. Axis bindings retain direction. Deadzone removes drift; response curve adjusts stick sensitivity; the lower release threshold provides hysteresis around the press threshold.

Inputs enter the existing game command pipeline. Boost remains timed, and ship rotation speed is not modified or repeatedly uploaded to the server.

## Menus and hints

Use D-pad/left stick to move focus and the bottom face button to activate. Right face button selects a visible Back/Close/Cancel control. Shoulder buttons activate visible previous/next page controls. Right stick moves a pointer; right trigger holds/drags it for sliders, scrollbars, and other touch controls. Keyboard and mouse remain usable.

Hints follow controller activity and configurable icon style (Auto, Xbox, PlayStation, Generic). Gameplay hints replace the existing weapon and ability key legends with configured controller buttons; keyboard/mouse input restores the original legends. Menu hints stay with the settings panel. Virtual controllers may conceal the physical controller model; select the desired icon style manually in that case.

## DualSense

In a WebHID-capable browser, click Connect in the Controller page and choose the DualSense. The last authorized device is remembered and reopened on startup/reconnection when the browser still grants access; revoked permissions require Connect again. The browser requires a real user gesture for its permission picker; use a mouse/touch click for this initial step. Firefox can use standard Gamepad input but has no native WebHID path for these advanced effects.

Adaptive triggers, system light color, and population lights are independently optional. Projectile feedback follows synchronized shot events and observed volley cadence, including discrete pulses for slow weapons. Continuous beams use a frequency effect based on their current reload interval. Trigger intensity also considers projectile speed. Population indicators cap at five lights. Vibration follows damage and boost, with an intensity setting. Non-HID gamepads use the browser's dual-rumble actuator when available.

The Steam/itch patch needs `src/ControllerHID.cjs` and the accompanying updated `src/main.js` from the prepared QoLAF-Steam folder. The module source is tracked in `scripts/steam/ControllerHID.cjs`. It prompts for a supported Sony controller and retains denial for unrelated permissions.

USB and Bluetooth reports have separate framing; Bluetooth includes CRC32. Output is coalesced, unchanged reports are skipped, and motors/triggers are reset before closing the HID connection. Focus loss, disconnect and plugin cleanup release feedback. No native-HID helper is installed for Firefox.

## Verification status

Automated tests cover input merging, boost edges, disconnect/focus behavior, deadzones/hysteresis, binding capture, carousel selection, menu navigation, identity fallback, feedback profiles, output report encoding, and HID cleanup. A USB DualSense (Sony 054c:0ce6) was opened through WebHID in an isolated Electron 41 test. The production writer sent a short low-strength trigger/LED report, reset the outputs, and closed with no errors. Bluetooth framing is covered by encoding tests, not a physical Bluetooth run.

The controller settings page was also constructed and rendered against the live game's native Haxe classes and GUI atlases. A simulated controller confirmation activated a real native settings button through Starling's touch dispatcher; the binding list was rendered after scrolling. This uses an isolated, unauthenticated UI fixture, not a live combat session. Physical trigger feel and combat tuning remain user-testable limitations.

The Controller page shows detection/focus status, and changes are recorded in `/log`. Invisible Lime IME helpers do not block controller input; visible text fields and chat still do.

PlayStation prompts use Xelu's CC0 PS5 assets from https://thoseawesomeguys.com/prompts/ (license included under src/assets/controller). D-pad directions, stick clicks, shoulders and triggers use glyphs rather than text substitutes.

An authorized DualSense now also supplies direct WebHID input, preferred in Automatic mode over the browser Gamepad snapshot. USB and both Bluetooth layouts are decoded; reports older than 250ms are released rather than replayed. Firefox retains the standard Gamepad path. Logs include analog values and thresholds.

Incoming damage rumble scales with damage during the last second relative to total HP/shields, with a short fade after damage stops. The configured vibration slider remains the maximum. Local SmartGun/Blaster shot timing (including Acid Blaster) is observed as well as synchronized projectiles.
