# NPC Context Index

These files are structured context documents for LLM-generated NPC dialog. The web app bundles these markdown files and feeds the matching NPC file into Ollama whenever it asks `llama3.1:8b` for a spoken line.

Each NPC file uses the same headings so runtime retrieval can feed a consistent context shape to the model. The `Role In The Game` section is especially important because it tells the model whether the character is selling drugs, acting as a hobo/street intel contact, or confronting the player as police.

Each file should also keep a `Hoser Saying Reference` and `Example Dialog` section. These give the runtime prompt concrete slang, rhythm, and sample lines for that NPC without hardcoding the exact generated output.

## Dealers

- [Mama Dee](mama-dee.md)
- [Needle Nick](needle-nick.md)
- [Rico](rico.md)
- [Professor X](professor-x.md)
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

## Police

- [Officer Hardass](officer-hardass.md)
- [Officer Bob](officer-bob.md)
- [Agent Smith](agent-smith.md)
