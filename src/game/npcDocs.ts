import agentSmith from "../../docs/npcs/agent-smith.md?raw";
import benchwiseEddie from "../../docs/npcs/benchwise-eddie.md?raw";
import boardwalkBenny from "../../docs/npcs/boardwalk-benny.md?raw";
import boardwalkSal from "../../docs/npcs/boardwalk-sal.md?raw";
import brooklynRose from "../../docs/npcs/brooklyn-rose.md?raw";
import chebuctoCam from "../../docs/npcs/chebucto-cam.md?raw";
import ferryDockFrank from "../../docs/npcs/ferry-dock-frank.md?raw";
import ferryJo from "../../docs/npcs/ferry-jo.md?raw";
import johnathan from "../../docs/npcs/johnathan.md?raw";
import jWood from "../../docs/npcs/j-wood.md?raw";
import mamaDee from "../../docs/npcs/mama-dee.md?raw";
import needleNick from "../../docs/npcs/needle-nick.md?raw";
import officerBob from "../../docs/npcs/officer-bob.md?raw";
import officerHardass from "../../docs/npcs/officer-hardass.md?raw";
import professorX from "../../docs/npcs/professor-x.md?raw";
import queensVic from "../../docs/npcs/queens-vic.md?raw";
import railYardRay from "../../docs/npcs/rail-yard-ray.md?raw";
import rico from "../../docs/npcs/rico.md?raw";
import scratchyLou from "../../docs/npcs/scratchy-lou.md?raw";
import shadyRich from "../../docs/npcs/shady-rich.md?raw";
import shanobi from "../../docs/npcs/shanobi.md?raw";
import stoopAnnie from "../../docs/npcs/stoop-annie.md?raw";
import subwaySue from "../../docs/npcs/subway-sue.md?raw";
import sweetAidan from "../../docs/npcs/sweet-aidan.md?raw";
import tinCanMarty from "../../docs/npcs/tin-can-marty.md?raw";

const NPC_DOCS: Record<string, string> = {
  "benchwise-eddie": benchwiseEddie,
  "big-paulie": shadyRich,
  "boardwalk-benny": boardwalkBenny,
  "boardwalk-sal": boardwalkSal,
  "brooklyn-rose": brooklynRose,
  "chebucto-cam": chebuctoCam,
  "ferry-dock-frank": ferryDockFrank,
  "ferry-jo": ferryJo,
  johnathan,
  "j-wood": jWood,
  "mama-dee": mamaDee,
  "needle-nick": needleNick,
  "professor-x": professorX,
  "queens-vic": queensVic,
  "rail-yard-ray": railYardRay,
  "rico": rico,
  "scratchy-lou": scratchyLou,
  "shanobi": shanobi,
  "stoop-annie": stoopAnnie,
  "subway-sue": subwaySue,
  "sweet-aidan": sweetAidan,
  "tin-can-marty": tinCanMarty,
  bob: officerBob,
  hardass: officerHardass,
  smith: agentSmith,
};

export function npcDocumentForId(npcId: string | null | undefined): string | null {
  if (!npcId) {
    return null;
  }

  return NPC_DOCS[npcId] ?? null;
}
