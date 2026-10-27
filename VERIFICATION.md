# Verification of 0.1.0

- Clean `npm ci --ignore-scripts=false`: passed with Node 24 and the lockfile.
- `npm test`: 4 tests passed, 0 failures.
- `npm run smoke`: passed using actual Electron 45.1.0 on headless Linux. Checked five simultaneous H.264/AAC video lanes, PNG loading, PDF page pixel colors and seeking, Cue/Take isolation, pause/resume, single-lane audio muting, stretch mode, two actual output windows sharing the virtual display, simulated monitor removal, global blackout, and session persistence after relaunch. No renderer page errors.
- `npm audit --omit=dev --audit-level=high`: no production dependency vulnerabilities reported at setup time.
- Windows x64 unpacked build: completed; embedded application source, CSS and logo matched the tested source byte for byte.
- Native NSIS installer compilation completed successfully, without compiler warnings. It is compiled directly on Linux using electron-builder's checksum-verified NSIS 3 toolset and `build/installer.nsi`. The standard electron-builder installer route on this Linux host failed because Wine could not load ntdll; the Windows CI configuration uses the standard native Windows route.

Not verified here: installation/uninstallation on Windows, physical sound output, five physical displays, mixed-DPI physical display placement, five streams at 4K, or LibreOffice conversion. Headless software rendering and a simulated unplug do not establish hardware performance or Windows installation readiness. The installer is unsigned.
