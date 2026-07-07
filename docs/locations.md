# HRM Location Map

Harbour Hustle uses an HRM-only travel map. Location ids are stable config keys; display names are what the player sees in the UI and in generated text.

## Locations

| Display name | Config id | Police | Stock range | Market role |
|---|---:|---:|---:|---|
| Downtown Halifax | `downtown-halifax` | 75 | 4-10 | High-police money hub with bank and loan shark access. |
| North End Halifax | `north-end-halifax` | 35 | 6-12 | Early active market with Mama Dee, Needle Nick, and Tin Can Marty. |
| West End Halifax | `west-end-halifax` | 12 | 6-10 | Low-police balanced market with J-Wood and Chebucto Cam. |
| Westmount | `westmount` | 42 | 4-8 | Posh, lower-volume market with classy cocaine and hallucinogen stock. |
| Dartmouth | `dartmouth` | 45 | 6-12 | Mid-risk cross-harbour market with proud local dealers. |
| Bedford | `bedford` | 30 | 5-10 | Lower-heat connected market. |
| Sackville | `sackville` | 22 | 7-12 | Lower-police, higher-stock service stop with a full salvage merchant. |
| Spryfield | `spryfield` | 28 | 7-12 | Lower-police, higher-stock market with pub access. |
| Halifax Public Gardens | `halifax-public-gardens` | 50 | 5-11 | Mid-police psychedelic market. |
| Eastern Passage | `eastern-passage` | 18 | 6-12 | Low-police waterfront market. |

## Services

| Service | Location |
|---|---|
| Bank | Downtown Halifax |
| Loan shark | Downtown Halifax |
| Pub | Spryfield |
| Doctor: Dr. Lorraine MacIsaac | Downtown Halifax |
| Doctor: Nurse Gordie | Dartmouth |
| Doctor: Doc Crowell | Spryfield |
| Doctor: Dr. Celeste Vein | Westmount |

Doctors are location-bound NPC services. They do not appear as automatic post-combat prompts; injured players must visit a doctor's location and pay the displayed heal price.

## Merchants

Merchants sell a configured subset of weapons/items at daily market prices. Any merchant will buy any carried weapon, even if that merchant does not sell it.

| Merchant | Location | Sells |
|---|---|---|
| Sackville Salvage & Sporting Goods | Sackville | Full improvised weapon list. |
| North End Junk Counter | North End Halifax | Glass Coke-a-Cola Bottle, Rusty Fillet Knife, Sharpened Hockey Stick. |
| Spryfield Swap Table | Spryfield | Tire Iron, Sock Full of Loonies, Zamboni-Part Mace. |
| Dartmouth Sporting Shelf | Dartmouth | Rusty Fillet Knife, Sharpened Hockey Stick, Bow and Arrow. |
| Dockside Barter Crate | Eastern Passage | Glass Coke-a-Cola Bottle, Tire Iron, Rusty Fillet Knife. |

## NPC Placement

| Location | Dealers | Street intel contacts | Doctors |
|---|---|---|---|
| Downtown Halifax | Shady Rich, Sweet Aidan | Barrington Sue, Shanobi | Dr. Lorraine MacIsaac |
| North End Halifax | Mama Dee, Needle Nick | Tin Can Marty | -- |
| West End Halifax | J-Wood | Chebucto Cam | -- |
| Westmount | Johnathan | -- | Dr. Celeste Vein |
| Dartmouth | Boardwalk Sal | Boardwalk Benny | Nurse Gordie |
| Bedford | Bedford Rose | Stoop Annie | -- |
| Sackville | Sackville Vic | Rail Yard Ray | -- |
| Spryfield | Rico | Scratchy Lou | Doc Crowell |
| Halifax Public Gardens | Professor X | Benchwise Eddie | -- |
| Eastern Passage | Ferry Jo | Ferry Dock Frank | -- |

## Save Migration

Older saves may contain pre-HRM location ids or old location names in event log text. The engine normalizes those ids and saved text during hydration so existing local saves continue in the HRM map.
