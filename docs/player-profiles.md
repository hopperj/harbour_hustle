# Player Profiles

Harbour Hustle starts by asking for a dealer name. That name is normalized by trimming extra spaces and matching case-insensitively, then used as the local profile key.

Entering a new dealer name starts a fresh run. Entering the same dealer name later resumes the saved run for that profile.

Profiles are stored in the browser's local storage for the current app origin. A profile created at `http://127.0.0.1:5173/` is separate from one created on another browser, device, host, or port.

The first named profile can adopt the older single-slot browser save, if one exists. After that migration, new saves use the dealer-name profile format.

The status bar shows the active dealer name under the Harbour Hustle title. The New Game button opens the dealer-name prompt instead of immediately replacing the active run, so the player can switch profiles or create a new one without accidentally wiping progress.
