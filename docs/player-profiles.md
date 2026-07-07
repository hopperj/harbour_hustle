# Player Profiles

Harbour Hustle starts by asking for a dealer name. That name is normalized by trimming extra spaces and matching case-insensitively, then used as the local profile key.

Entering a new dealer name starts a fresh run. Entering the same dealer name later resumes the saved run for that profile.

Profiles are stored in the browser's local storage for the current app origin. A profile created at `http://127.0.0.1:5173/` is separate from one created on another browser, device, host, or port.

The first named profile can adopt the older single-slot browser save, if one exists. After that migration, new saves use the dealer-name profile format.

The status bar shows the active dealer name under the Harbour Hustle title. On startup, entering an existing dealer name resumes that profile. The New Game button opens a new-run dealer-name prompt; submitting a name there starts a fresh run and overwrites that profile's saved game, even when the name matches the current profile.
