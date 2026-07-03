export type Tone = "info" | "good" | "warn" | "bad";

export type DealType = "normal" | "cheap" | "expensive" | "none";

export type DealerTrait =
  | "loyal"
  | "greedy"
  | "violent"
  | "paranoid"
  | "connected"
  | "proud"
  | "unpredictable"
  | "conspiracy"
  | "sketchy";

export type IntelTopic = "market" | "dealer" | "police" | "turf" | "opportunity";

export interface LocationConfig {
  id: string;
  name: string;
  policePresence: number;
  minDrug: number;
  maxDrug: number;
}

export interface DrugConfig {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  cheap: boolean;
  expensive: boolean;
  cheapMessage: string;
}

export interface GunConfig {
  id: string;
  name: string;
  price: number;
  space: number;
  damage: number;
}

export interface CopConfig {
  id: string;
  name: string;
  deputyName: string;
  deputiesName: string;
  armor: number;
  deputyArmor: number;
  attackPenalty: number;
  defendPenalty: number;
  minDeputies: number;
  maxDeputies: number;
  gunId: string;
  copGun: number;
  deputyGun: number;
}

export type DealerApproachOfferId = "ultrasound";

export interface DealerApproachOffer {
  id: DealerApproachOfferId;
  chance: number;
  priceMin: number;
  priceMax: number;
  relationshipGain: number;
  prompt: string;
  acceptMessage: string;
  declineMessage: string;
  poorMessage: string;
}

export interface DealerConfig {
  id: string;
  name: string;
  locationId: string;
  drugIds: string[];
  traits: DealerTrait[];
  greed: number;
  violence: number;
  loyalty: number;
  paranoia: number;
  connected: number;
  toughness: number;
  refuseBelow: number;
  weaponGunId: string;
  guardCount: number;
  approachOffer?: DealerApproachOffer;
  dialogueLines?: string[];
}

export interface HoboConfig {
  id: string;
  name: string;
  locationId: string;
  dialogStyle?: "hoser" | "rhyme";
  toughness: number;
  trustThreshold: number;
  fearThreshold: number;
  intelQuality: number;
  priceMin: number;
  priceMax: number;
  favoriteDrugIds: string[];
}

export interface GameConfig {
  version: string;
  startDate: string;
  numTurns: number;
  startCash: number;
  startDebt: number;
  startBank: number;
  startHealth: number;
  startHelpers: number;
  baseSpace: number;
  helperSpace: number;
  debtInterest: number;
  bankInterest: number;
  playerArmor: number;
  helperArmor: number;
  fightTimeoutSeconds: number;
  llmDialogue: {
    enabled: boolean;
    endpoint: string;
    healthCheckTimeoutMs: number;
    maxTokens: number;
    model: string;
    temperature: number;
    timeoutMs: number;
  };
  currency: {
    symbol: string;
    prefix: boolean;
  };
  names: {
    helperSingular: string;
    helperPlural: string;
    gunSingular: string;
    gunPlural: string;
    drugSingular: string;
    drugPlural: string;
    loanShark: string;
    bank: string;
    gunShop: string;
    roughPub: string;
  };
  prices: {
    spy: number;
    tipoff: number;
    helperMin: number;
    helperMax: number;
  };
  drugsMeta: {
    expensiveMessageA: string;
    expensiveMessageB: string;
    cheapDivide: number;
    expensiveMultiply: number;
  };
  serviceLocations: {
    loanShark: string;
    bank: string;
    gunShop: string;
    roughPub: string;
  };
  locations: LocationConfig[];
  drugs: DrugConfig[];
  guns: GunConfig[];
  cops: CopConfig[];
  dealers: DealerConfig[];
  hobos: HoboConfig[];
  subwaySayings: string[];
  playing: string[];
  stoppedTo: string[];
}

export interface DrugInventory {
  carried: number;
  totalValue: number;
}

export interface GunInventory {
  carried: number;
}

export interface PlayerState {
  name: string;
  turn: number;
  date: string;
  locationId: string;
  cash: number;
  debt: number;
  bank: number;
  health: number;
  space: number;
  helpers: number;
  reputation: number;
  defeatedCopTier: number;
  drugs: Record<string, DrugInventory>;
  guns: Record<string, GunInventory>;
}

export interface MarketQuote {
  drugId: string;
  price: number;
  bidPrice?: number;
  deal: DealType;
}

export type DealerStock = Record<string, Record<string, number>>;

export interface PriceHistoryEntry {
  turn: number;
  date: string;
  locationId: string;
  price: number;
  deal: DealType;
}

export interface EventLogEntry {
  id: number;
  turn: number;
  date: string;
  tone: Tone;
  text: string;
}

export interface IntelReport {
  id: number;
  turn: number;
  date: string;
  sourceId: string;
  sourceName: string;
  locationId: string;
  topic: IntelTopic;
  text: string;
  accurate: boolean;
}

export type PendingPrompt =
  | {
      type: "bargain-helper";
      price: number;
      text: string;
    }
  | {
      type: "bargain-gun";
      gunId: string;
      price: number;
      text: string;
    }
  | {
      type: "wild-weed";
      text: string;
    }
  | {
      type: "cops";
      copId: string;
      deputies: number;
      text: string;
    }
  | {
      type: "doctor";
      price: number;
      text: string;
    }
  | {
      type: "dealer-offer";
      offerId: DealerApproachOfferId;
      dealerId: string;
      price: number;
      relationshipGain: number;
      text: string;
      acceptMessage: string;
      declineMessage: string;
      poorMessage: string;
    };

export interface GameState {
  rngState: number;
  logIndex: number;
  market: MarketQuote[];
  priceHistory: Record<string, PriceHistoryEntry[]>;
  dealerStock: DealerStock;
  dealerRelationships: Record<string, number>;
  hoboRelationships: Record<string, number>;
  locationInfluence: Record<string, number>;
  intelReports: IntelReport[];
  player: PlayerState;
  pendingPrompt: PendingPrompt | null;
  currentHelperPrice: number | null;
  gameOver: boolean;
  finalScore: number | null;
  lastCommand: string;
  eventLog: EventLogEntry[];
}

export type GameCommand =
  | { type: "approachDealer"; dealerId: string }
  | { type: "buyDrug"; drugId: string; amount: number; dealerId?: string }
  | { type: "sellDrug"; drugId: string; amount: number; dealerId?: string }
  | { type: "dropDrug"; drugId: string; amount: number }
  | { type: "giftDrug"; dealerId: string; drugId: string; amount: number }
  | { type: "robDealer"; dealerId: string }
  | { type: "buyHoboIntel"; hoboId: string }
  | { type: "giftHoboDrug"; hoboId: string; drugId: string; amount: number }
  | { type: "threatenHobo"; hoboId: string }
  | { type: "stay" }
  | { type: "travel"; locationId: string }
  | { type: "deposit"; amount: number }
  | { type: "withdraw"; amount: number }
  | { type: "payLoan"; amount: number }
  | { type: "buyGun"; gunId: string; amount: number }
  | { type: "sellGun"; gunId: string; amount: number }
  | { type: "hireHelper"; amount: number }
  | { type: "answerPrompt"; answer: "yes" | "no" | "run" | "fight" };
