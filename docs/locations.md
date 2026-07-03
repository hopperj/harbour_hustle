# HRM Location Map

Harbour Hustle uses an HRM-only travel map. Location ids are stable config keys; display names are what the player sees in the UI and in generated text.

## Locations

| Display name | Config id | Police | Stock range | Market role |
|---|---:|---:|---:|---|
| Downtown Halifax | `downtown-halifax` | 75 | 4-10 | High-police money hub with bank and loan shark access. |
| North End Halifax | `north-end-halifax` | 35 | 6-12 | Early active market with Mama Dee, Needle Nick, and Tin Can Marty. |
| West End Halifax | `west-end-halifax` | 12 | 6-10 | Low-police balanced market with J-Wood and Chebucto Cam. |
| Dartmouth | `dartmouth` | 45 | 6-12 | Mid-risk cross-harbour market with proud local dealers. |
| Bedford | `bedford` | 30 | 5-10 | Lower-heat connected market. |
| Sackville | `sackville` | 22 | 7-12 | Lower-police, higher-stock service stop with the weapon shop. |
| Spryfield | `spryfield` | 28 | 7-12 | Lower-police, higher-stock market with pub access. |
| Halifax Public Gardens | `halifax-public-gardens` | 50 | 5-11 | Mid-police psychedelic market. |
| Eastern Passage | `eastern-passage` | 18 | 6-12 | Low-police waterfront market. |

## Services

| Service | Location |
|---|---|
| Bank | Downtown Halifax |
| Loan shark | Downtown Halifax |
| Sackville Salvage & Sporting Goods | Sackville |
| Pub | Spryfield |

## NPC Placement

| Location | Dealers | Street intel contacts |
|---|---|---|
| Downtown Halifax | Shady Rich | Barrington Sue |
| North End Halifax | Mama Dee, Needle Nick | Tin Can Marty |
| West End Halifax | J-Wood | Chebucto Cam |
| Dartmouth | Boardwalk Sal | Boardwalk Benny |
| Bedford | Bedford Rose | Stoop Annie |
| Sackville | Sackville Vic | Rail Yard Ray |
| Spryfield | Rico | Scratchy Lou |
| Halifax Public Gardens | Professor X | Benchwise Eddie |
| Eastern Passage | Ferry Jo | Ferry Dock Frank |

## Save Migration

Older saves may contain pre-HRM location ids or old location names in event log text. The engine normalizes those ids and saved text during hydration so existing local saves continue in the HRM map.
