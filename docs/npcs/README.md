# NPC Context Index

These files are structured context documents for LLM-generated NPC dialog. The web app server reads the matching NPC file and feeds it into Ollama whenever it asks `llama3.1:8b` for a spoken line. Browsers call the same-origin `/api/llm/*` endpoints and do not contact Ollama directly.

Each NPC file uses the same headings so runtime retrieval can feed a consistent context shape to the model. The `Role In The Game` section is especially important because it tells the model whether the character is selling drugs, acting as a hobo/street intel contact, or confronting the player as police.

Each file should also keep a `Hoser Saying Reference` and `Example Dialog` section. These give the runtime prompt concrete slang, rhythm, and sample lines for that NPC without hardcoding the exact generated output.

Runtime prompts also include persistent NPC memory. The game records direct chat, trades, gifts, threats, robberies, side offers, and intel handoffs, then summarizes that prior history with relative timing in later prompts. NPC files should leave room for characters to react to that history without contradicting the mechanical scene.

Generated lines are constrained by shared prompt rails in `src/game/llmDialogue.ts`: stay as the active NPC, return one spoken line, do not invent prices/stock/injuries/locations/relationships/police state/intel/outcomes, and keep adult profanity as Halifax street texture without slurs or sexual threats.

## Dealers

- [Mama Dee](mama-dee.md)
- [Needle Nick](needle-nick.md)
- [Rico](rico.md)
- [Professor X](professor-x.md)
- [Johnathan](johnathan.md)
- [Shady Rich](shady-rich.md)
- [Sweet Aidan](sweet-aidan.md)
- [Boardwalk Sal](boardwalk-sal.md)
- [Bedford Rose](brooklyn-rose.md)
- [Sackville Vic](queens-vic.md)
- [Ferry Jo](ferry-jo.md)
- [J-Wood](j-wood.md)

## Street Intel Contacts

- [Tin Can Marty](tin-can-marty.md)
- [Scratchy Lou](scratchy-lou.md)
- [Benchwise Eddie](benchwise-eddie.md)
- [Barrington Sue](subway-sue.md)
- [Shanobi](shanobi.md)
- [Boardwalk Benny](boardwalk-benny.md)
- [Stoop Annie](stoop-annie.md)
- [Rail Yard Ray](rail-yard-ray.md)
- [Ferry Dock Frank](ferry-dock-frank.md)
- [Chebucto Cam](chebucto-cam.md)

## Doctors

- [Dr. Lorraine MacIsaac](dr-macisaac.md)
- [Nurse Gordie](nurse-gordie.md)
- [Doc Crowell](doc-crowell.md)
- [Dr. Celeste Vein](dr-celeste-vein.md)

## Police

- [Officer Hardass](officer-hardass.md)
- [Officer Bob](officer-bob.md)
- [Agent Smith](agent-smith.md)
