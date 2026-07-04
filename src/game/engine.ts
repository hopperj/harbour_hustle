import { addDays, formatDate, formatMoney } from "./format";
import { normalizeSeed, randomInt, randomPrice } from "./rng";
import type {
  CopConfig,
  DealerConfig,
  DealerStock,
  DrugConfig,
  GameCommand,
  GameConfig,
  GameState,
  GunConfig,
  HoboConfig,
  IntelReport,
  IntelTopic,
  LocationConfig,
  MarketQuote,
  MerchantConfig,
  MerchantMarket,
  MerchantQuote,
  NpcMemoryKind,
  PendingPrompt,
  PriceHistoryEntry,
  PlayerState,
  Tone,
} from "./types";

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function getLocation(config: GameConfig, id: string): LocationConfig {
  return config.locations.find((location) => location.id === id) ?? config.locations[0];
}

const LEGACY_LOCATION_IDS: Record<string, string> = {
  bronx: "north-end-halifax",
  ghetto: "spryfield",
  "central-park": "halifax-public-gardens",
  manhattan: "downtown-halifax",
  "coney-island": "dartmouth",
  brooklyn: "bedford",
  queens: "sackville",
  "staten-island": "eastern-passage",
};

const LEGACY_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ["Bronx", "North End Halifax"],
  ["Ghetto", "Spryfield"],
  ["Central Park", "Halifax Public Gardens"],
  ["Manhattan", "Downtown Halifax"],
  ["Coney Island", "Dartmouth"],
  ["Brooklyn", "Bedford"],
  ["Queens", "Sackville"],
  ["Staten Island", "Eastern Passage"],
  ["Subway Sue", "Barrington Sue"],
  ["Brooklyn Rose", "Bedford Rose"],
  ["Queens Vic", "Sackville Vic"],
];

function normalizeLocationId(config: GameConfig, locationId: string | undefined): string {
  if (locationId && config.locations.some((location) => location.id === locationId)) {
    return locationId;
  }

  const migrated = locationId ? LEGACY_LOCATION_IDS[locationId] : undefined;
  if (migrated && config.locations.some((location) => location.id === migrated)) {
    return migrated;
  }

  return config.locations[0].id;
}

function migrateLegacyText(text: string): string {
  return LEGACY_TEXT_REPLACEMENTS.reduce(
    (current, [from, to]) => current.replaceAll(from, to).replaceAll(from.toUpperCase(), to.toUpperCase()),
    text,
  );
}

function getDrug(config: GameConfig, id: string): DrugConfig {
  const drug = config.drugs.find((item) => item.id === id);
  if (!drug) {
    throw new Error(`Unknown drug: ${id}`);
  }
  return drug;
}

function getGun(config: GameConfig, id: string): GunConfig {
  const gun = config.guns.find((item) => item.id === id);
  if (!gun) {
    throw new Error(`Unknown weapon: ${id}`);
  }
  return gun;
}

function getMerchant(config: GameConfig, id: string): MerchantConfig {
  const merchant = config.merchants.find((item) => item.id === id);
  if (!merchant) {
    throw new Error(`Unknown merchant: ${id}`);
  }
  return merchant;
}

function getCop(config: GameConfig, id: string): CopConfig {
  return config.cops.find((item) => item.id === id) ?? config.cops[0];
}

function getDealer(config: GameConfig, id: string): DealerConfig {
  const dealer = config.dealers.find((item) => item.id === id);
  if (!dealer) {
    throw new Error(`Unknown dealer: ${id}`);
  }
  return dealer;
}

function dealerDisplayName(config: GameConfig, dealer: DealerConfig): string {
  return `${dealer.name} (${getLocation(config, dealer.locationId).name})`;
}

function getHobo(config: GameConfig, id: string): HoboConfig {
  const hobo = config.hobos.find((item) => item.id === id);
  if (!hobo) {
    throw new Error(`Unknown hobo: ${id}`);
  }
  return hobo;
}

function dealersForLocation(config: GameConfig, locationId: string): DealerConfig[] {
  return config.dealers.filter((dealer) => dealer.locationId === locationId);
}

function hobosForLocation(config: GameConfig, locationId: string): HoboConfig[] {
  return config.hobos.filter((hobo) => hobo.locationId === locationId);
}

export function merchantsForLocation(config: GameConfig, locationId: string): MerchantConfig[] {
  return config.merchants.filter((merchant) => merchant.locationId === locationId);
}

function marketQuote(state: GameState, drugId: string): MarketQuote {
  return quoteFromMarket(state.market, drugId);
}

export function merchantQuote(state: GameState, merchantId: string, gunId: string): MerchantQuote | null {
  return state.merchantMarket?.[merchantId]?.[gunId] ?? null;
}

function marketBidPrice(config: GameConfig, state: GameState, drug: DrugConfig): number {
  const quote = marketQuote(state, drug.id);
  return quote.bidPrice ?? (quote.price > 0 ? quote.price : Math.floor((drug.minPrice + drug.maxPrice) / 2));
}

function dealerStockAmount(state: GameState, dealerId: string, drugId: string): number {
  return Math.max(0, state.dealerStock?.[dealerId]?.[drugId] ?? 0);
}

function setDealerStockAmount(state: GameState, dealerId: string, drugId: string, amount: number): void {
  state.dealerStock[dealerId] ??= {};
  state.dealerStock[dealerId][drugId] = Math.max(0, amount);
}

function adjustDealerStockAmount(state: GameState, dealerId: string, drugId: string, delta: number): void {
  setDealerStockAmount(state, dealerId, drugId, dealerStockAmount(state, dealerId, drugId) + delta);
}

function dealerForTrade(config: GameConfig, state: GameState, dealerId: string | undefined, drugId: string): DealerConfig | null {
  if (dealerId) {
    return getDealer(config, dealerId);
  }

  return dealersForLocation(config, state.player.locationId).find((dealer) => dealer.drugIds.includes(drugId)) ?? null;
}

function dealerCanTrade(config: GameConfig, state: GameState, dealer: DealerConfig, drugId: string): boolean {
  return dealer.locationId === state.player.locationId &&
    dealer.drugIds.includes(drugId) &&
    dealerRelationship(state, dealer.id) >= dealerRefusalThreshold(dealer, state);
}

function merchantForTrade(config: GameConfig, state: GameState, merchantId: string | undefined): MerchantConfig | null {
  if (merchantId) {
    const merchant = getMerchant(config, merchantId);
    return merchant.locationId === state.player.locationId ? merchant : null;
  }

  return merchantsForLocation(config, state.player.locationId)[0] ?? null;
}

function quoteFromMarket(market: MarketQuote[], drugId: string): MarketQuote {
  return market.find((quote) => quote.drugId === drugId) ?? {
    drugId,
    price: 0,
    bidPrice: 0,
    deal: "none",
  };
}

function totalGuns(player: PlayerState): number {
  return Object.values(player.guns).reduce((sum, item) => sum + item.carried, 0);
}

export function totalCapacity(config: GameConfig, player: PlayerState): number {
  return config.baseSpace + player.helpers * config.helperSpace;
}

export function netWorth(player: PlayerState): number {
  return player.cash + player.bank - player.debt;
}

function pushLog(state: GameState, tone: Tone, text: string): void {
  state.logIndex += 1;
  state.eventLog.unshift({
    id: state.logIndex,
    turn: state.player.turn,
    date: state.player.date,
    tone,
    text,
  });
  state.eventLog = state.eventLog.slice(0, 80);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function textRoll(state: GameState, text: string, salt: number): number {
  let hash = normalizeSeed(state.rngState ^ Math.imul(state.logIndex + salt + 1, 2654435761));
  for (let index = 0; index < text.length; index += 1) {
    hash = normalizeSeed(Math.imul(hash ^ text.charCodeAt(index), 2246822519));
  }
  return hash % 100;
}

function withEh(state: GameState, text: string, chance = 62): string {
  if (/\b(eh|my guy)\b/i.test(text) || textRoll(state, text, 17) >= chance) {
    return text;
  }

  const tag = textRoll(state, text, 19) < 34 ? "my guy" : "eh";
  if (text.endsWith("?")) {
    return `${text.slice(0, -1)}, ${tag}?`;
  }
  if (text.endsWith("!")) {
    return `${text.slice(0, -1)}, ${tag}!`;
  }
  if (text.endsWith(".")) {
    return `${text.slice(0, -1)}, ${tag}.`;
  }
  return `${text}, ${tag}`;
}

function withPoliceSorry(state: GameState, text: string, chance = 86): string {
  if (/sorry/i.test(text) || textRoll(state, text, 29) >= chance) {
    return text;
  }
  return `Sorry, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function withManySorries(text: string): string {
  const withoutLeadingSorry = text.replace(/^(sorry,?\s*)+/i, "");
  return `Sorry, sorry, sorry, ${withoutLeadingSorry.charAt(0).toLowerCase()}${withoutLeadingSorry.slice(1)}`;
}

function withSwearing(state: GameState, text: string, chance = 35, strong = false): string {
  if (/\b(bullshit|damn|fuck|fucked|fucking|hell|shit)\b/i.test(text) || textRoll(state, text, strong ? 47 : 43) >= chance) {
    return text;
  }

  if (strong) {
    const fragments = ["this is bullshit, ", "for fuck's sake, ", "this is fucked, ", "fuck, shit, sorry, "];
    const fragment = fragments[textRoll(state, text, 53) % fragments.length];
    if (/^Sorry, sorry, sorry, /i.test(text)) {
      return text.replace(/^Sorry, sorry, sorry, /i, `Sorry, sorry, sorry, ${fragment}`);
    }
    return `${fragment.charAt(0).toUpperCase()}${fragment.slice(1)}${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }

  const words = ["damn", "shit", "hell", "fuckin'", "fuuuuckin' eh"];
  const word = words[textRoll(state, text, 59) % words.length];
  if (/[?!.]$/.test(text)) {
    return `${text.slice(0, -1)}, ${word}${text.slice(-1)}`;
  }
  return `${text}, ${word}`;
}

function withViolentSorry(state: GameState, text: string, chance = 100): string {
  return withSwearing(state, withManySorries(text), chance, true);
}

function renderDealerOfferText(
  config: GameConfig,
  state: GameState,
  dealer: DealerConfig,
  template: string,
  price: number,
  relationshipGain = 0,
): string {
  return template
    .replaceAll("%DEALER%", dealer.name)
    .replaceAll("%LOCATION%", getLocation(config, state.player.locationId).name)
    .replaceAll("%PRICE%", formatMoney(config, price))
    .replaceAll("%RELATIONSHIP%", String(relationshipGain));
}

function makeDealerRelationships(config: GameConfig): Record<string, number> {
  return Object.fromEntries(config.dealers.map((dealer) => [dealer.id, 0]));
}

function makeDealerStock(config: GameConfig): DealerStock {
  return Object.fromEntries(
    config.dealers.map((dealer) => [
      dealer.id,
      Object.fromEntries(dealer.drugIds.map((drugId) => [drugId, 0])),
    ]),
  );
}

function makeDealerRobberyTurns(config: GameConfig): Record<string, number> {
  return Object.fromEntries(config.dealers.map((dealer) => [dealer.id, 0]));
}

function makeMerchantMarket(config: GameConfig): MerchantMarket {
  return Object.fromEntries(
    config.merchants.map((merchant) => [
      merchant.id,
      Object.fromEntries(
        config.guns.map((gun) => [
          gun.id,
          {
            gunId: gun.id,
            price: gun.price,
            bidPrice: Math.max(1, Math.floor((gun.price * merchant.bid) / 100)),
            deal: "normal",
          },
        ]),
      ),
    ]),
  );
}

function makeHoboRelationships(config: GameConfig): Record<string, number> {
  return Object.fromEntries(config.hobos.map((hobo) => [hobo.id, 0]));
}

function makeLocationInfluence(config: GameConfig): Record<string, number> {
  return Object.fromEntries(config.locations.map((location) => [location.id, 0]));
}

function normalizeSavedLocationIds(config: GameConfig, state: GameState): void {
  state.player.locationId = normalizeLocationId(config, state.player.locationId);

  if (state.locationInfluence) {
    const migratedInfluence = makeLocationInfluence(config);
    for (const [locationId, influence] of Object.entries(state.locationInfluence)) {
      const nextLocationId = normalizeLocationId(config, locationId);
      migratedInfluence[nextLocationId] = clamp((migratedInfluence[nextLocationId] ?? 0) + influence, -100, 100);
    }
    state.locationInfluence = migratedInfluence;
  }

  if (state.intelReports) {
    state.intelReports = state.intelReports.map((report) => {
      const sourceName = migrateLegacyText(report.sourceName);
      const hobo = config.hobos.find((item) => item.id === report.sourceId) ?? { name: sourceName };

      return {
        ...report,
        locationId: normalizeLocationId(config, report.locationId),
        sourceName,
        text: formatIntelSummary(hobo, migrateLegacyText(report.text)),
      };
    });
  }

  if (state.priceHistory) {
    for (const entries of Object.values(state.priceHistory)) {
      for (const entry of entries) {
        entry.locationId = normalizeLocationId(config, entry.locationId);
      }
    }
  }

  if (state.eventLog) {
    state.eventLog = state.eventLog.map((entry) => ({
      ...entry,
      text: migrateLegacyText(entry.text),
    }));
  }

  if (state.npcMemory) {
    state.npcMemory = state.npcMemory.map((entry) => ({
      ...entry,
      text: migrateLegacyText(entry.text),
    }));
  }
}

function ensureStreetState(config: GameConfig, state: GameState): void {
  state.dealerRelationships ??= makeDealerRelationships(config);
  for (const dealer of config.dealers) {
    state.dealerRelationships[dealer.id] ??= 0;
  }

  state.dealerStock ??= makeDealerStock(config);
  for (const dealer of config.dealers) {
    state.dealerStock[dealer.id] ??= {};
    for (const drugId of dealer.drugIds) {
      state.dealerStock[dealer.id][drugId] ??= 0;
    }
  }

  state.dealerRobberyTurns ??= makeDealerRobberyTurns(config);
  for (const dealer of config.dealers) {
    state.dealerRobberyTurns[dealer.id] ??= 0;
  }

  state.merchantMarket ??= makeMerchantMarket(config);
  for (const merchant of config.merchants) {
    state.merchantMarket[merchant.id] ??= {};
    for (const gun of config.guns) {
      state.merchantMarket[merchant.id][gun.id] ??= {
        gunId: gun.id,
        price: gun.price,
        bidPrice: Math.max(1, Math.floor((gun.price * merchant.bid) / 100)),
        deal: "normal",
      };
    }
  }

  state.hoboRelationships ??= makeHoboRelationships(config);
  for (const hobo of config.hobos) {
    state.hoboRelationships[hobo.id] ??= 0;
  }

  state.locationInfluence ??= makeLocationInfluence(config);
  for (const location of config.locations) {
    state.locationInfluence[location.id] ??= 0;
  }

  state.intelReports ??= [];
  state.npcMemory ??= [];
  state.player.reputation ??= 0;
  state.player.guns ??= {};
  for (const gun of config.guns) {
    state.player.guns[gun.id] ??= { carried: 0 };
  }
}

function ensureDealerState(config: GameConfig, state: GameState): void {
  ensureStreetState(config, state);
}

function dealerRelationship(state: GameState, dealerId: string): number {
  return state.dealerRelationships[dealerId] ?? 0;
}

function adjustDealerRelationship(state: GameState, dealerId: string, delta: number): void {
  state.dealerRelationships[dealerId] = clamp(dealerRelationship(state, dealerId) + delta, -100, 100);
}

function setDealerRelationship(state: GameState, dealerId: string, value: number): void {
  state.dealerRelationships[dealerId] = clamp(value, -100, 100);
}

function adjustReputation(state: GameState, delta: number): void {
  state.player.reputation = clamp((state.player.reputation ?? 0) + delta, -100, 100);
}

function hoboRelationship(state: GameState, hoboId: string): number {
  return state.hoboRelationships[hoboId] ?? 0;
}

function adjustHoboRelationship(state: GameState, hoboId: string, delta: number): void {
  state.hoboRelationships[hoboId] = clamp(hoboRelationship(state, hoboId) + delta, -100, 100);
}

export function locationInfluence(state: GameState, locationId: string): number {
  return state.locationInfluence?.[locationId] ?? 0;
}

function adjustLocationInfluence(state: GameState, locationId: string, delta: number): void {
  state.locationInfluence[locationId] = clamp(locationInfluence(state, locationId) + delta, -100, 100);
}

export function dealerRefusalThreshold(dealer: DealerConfig, state: GameState): number {
  const reputation = state.player.reputation ?? 0;
  const influence = locationInfluence(state, dealer.locationId);
  let threshold = dealer.refuseBelow;

  if (reputation < 0) {
    threshold += Math.floor((Math.abs(reputation) * dealer.paranoia) / 220);
  } else {
    threshold -= Math.floor(reputation / 25);
  }

  if (influence < 0) {
    threshold += Math.floor(Math.abs(influence) / 8);
  } else {
    threshold -= Math.floor(influence / 20);
  }

  if (dealer.traits.includes("unpredictable")) {
    threshold += (state.rngState % 9) - 4;
  }

  return clamp(threshold, -90, 15);
}

export function effectivePolicePresence(config: GameConfig, state: GameState, location: LocationConfig): number {
  const reputation = state.player.reputation ?? 0;
  const influence = locationInfluence(state, location.id);
  let presence = location.policePresence;
  presence += Math.ceil(Math.max(0, -reputation) / 4);
  presence -= Math.floor(Math.max(0, reputation) / 8);
  presence += Math.ceil(Math.max(0, -influence) / 4);
  presence -= Math.floor(Math.max(0, influence) / 4);
  return clamp(presence, 1, 98);
}

function dealerTradeRelationshipGain(dealer: DealerConfig, value: number): number {
  let gain = value >= 10000 ? 3 : value >= 5000 ? 2 : 1;
  if (dealer.loyalty >= 70) {
    gain += 1;
  }
  if (dealer.greed >= 75 && value < 5000) {
    gain -= 1;
  }
  return clamp(gain, 1, 5);
}

function dealerGiftRelationshipGain(dealer: DealerConfig, value: number): number {
  const base = relationshipGainForGift(value);
  const multiplier = 100 + Math.floor(dealer.loyalty / 2) - Math.floor(dealer.greed / 3);
  return clamp(Math.round((base * multiplier) / 100), 1, 30);
}

function hoboGiftRelationshipGain(hobo: HoboConfig, drug: DrugConfig, value: number): number {
  const favoriteBonus = hobo.favoriteDrugIds.includes(drug.id) ? 4 : 0;
  return clamp(relationshipGainForGift(value) + favoriteBonus + Math.floor(hobo.intelQuality / 35), 1, 32);
}

export function hoboIntelPrice(config: GameConfig, state: GameState, hobo: HoboConfig): number {
  const relationship = hoboRelationship(state, hobo.id);
  const reputation = state.player.reputation ?? 0;
  const influence = locationInfluence(state, hobo.locationId);
  if (relationship >= hobo.trustThreshold || reputation >= hobo.trustThreshold + 15) {
    return 0;
  }

  const pressure = clamp(relationship + Math.floor(reputation / 2) + Math.floor(influence / 2), -100, 100);
  const spread = Math.max(0, hobo.priceMax - hobo.priceMin);
  const markup = Math.floor((spread * (100 - pressure)) / 200);
  return clamp(hobo.priceMin + markup, hobo.priceMin, hobo.priceMax);
}

function makeEmptyPriceHistory(config: GameConfig): Record<string, PriceHistoryEntry[]> {
  return Object.fromEntries(config.drugs.map((drug) => [drug.id, []]));
}

function ensurePriceHistory(config: GameConfig, state: GameState): void {
  state.priceHistory ??= makeEmptyPriceHistory(config);
  for (const drug of config.drugs) {
    if (!state.priceHistory[drug.id]) {
      state.priceHistory[drug.id] = [];
    }
  }
}

function appendPriceHistorySample(
  config: GameConfig,
  history: Record<string, PriceHistoryEntry[]>,
  market: MarketQuote[],
  turn: number,
  date: string,
  locationId: string,
): void {
  for (const drug of config.drugs) {
    history[drug.id] ??= [];
    const quote = quoteFromMarket(market, drug.id);

    history[drug.id].push({
      turn,
      date,
      locationId,
      price: quote.price,
      deal: quote.deal,
    });
    history[drug.id] = config.numTurns > 0 ? history[drug.id].slice(-config.numTurns) : [];
  }
}

function recordPriceHistory(config: GameConfig, state: GameState): void {
  ensurePriceHistory(config, state);
  appendPriceHistorySample(config, state.priceHistory, state.market, state.player.turn, state.player.date, state.player.locationId);
}

function deriveHistorySeed(seed: number): number {
  const mixed = Math.imul(normalizeSeed(seed) ^ 0x9e3779b9, 0x85ebca6b) + 0xc2b2ae35;
  return normalizeSeed(mixed || 0x6d2b79f5);
}

function makeHistoricalPriceHistory(
  config: GameConfig,
  seed: number,
  locationId: string,
  sampleCount: number,
  beforeDate: string,
  beforeTurn: number,
): Record<string, PriceHistoryEntry[]> {
  const history = makeEmptyPriceHistory(config);
  let historySeed = deriveHistorySeed(seed);

  for (let index = 0; index < sampleCount; index += 1) {
    const daysBefore = sampleCount - index;
    const result = generateMarket(config, locationId, historySeed);
    historySeed = result.seed;
    appendPriceHistorySample(
      config,
      history,
      result.market,
      beforeTurn - daysBefore,
      addDays(beforeDate, -daysBefore),
      locationId,
    );
  }

  return history;
}

function firstHistoryEntry(config: GameConfig, state: GameState): PriceHistoryEntry | null {
  for (const drug of config.drugs) {
    const entry = state.priceHistory[drug.id]?.[0];
    if (entry) {
      return entry;
    }
  }

  return null;
}

function backfillHistoricalPriceHistory(config: GameConfig, state: GameState, seed: number): void {
  ensurePriceHistory(config, state);

  if (state.market?.length && !config.drugs.some((drug) => state.priceHistory[drug.id]?.length > 0)) {
    recordPriceHistory(config, state);
  }

  const targetSamples = Math.max(0, config.numTurns);
  if (targetSamples === 0) {
    return;
  }

  const longestHistory = Math.max(0, ...config.drugs.map((drug) => state.priceHistory[drug.id]?.length ?? 0));
  const missingSamples = Math.max(0, targetSamples - longestHistory);
  if (missingSamples === 0) {
    return;
  }

  const firstEntry = firstHistoryEntry(config, state);
  const beforeDate = firstEntry?.date ?? state.player.date;
  const beforeTurn = firstEntry?.turn ?? state.player.turn;
  const locationId = firstEntry?.locationId ?? state.player.locationId;
  const historicalHistory = makeHistoricalPriceHistory(config, seed, locationId, missingSamples, beforeDate, beforeTurn);

  for (const drug of config.drugs) {
    state.priceHistory[drug.id] = [...historicalHistory[drug.id], ...(state.priceHistory[drug.id] ?? [])].slice(-targetSamples);
  }
}

export function hydrateGameState(config: GameConfig, state: GameState): GameState {
  const next = cloneState(state);
  normalizeSavedLocationIds(config, next);
  const needsDealerStockRoll = !next.dealerStock;
  const needsMerchantMarketRoll = !next.merchantMarket;
  ensureDealerState(config, next);
  if (needsDealerStockRoll && next.market?.length > 0) {
    rollDealerStock(config, next);
  }
  if (needsMerchantMarketRoll) {
    rollMerchantMarket(config, next);
  }
  backfillHistoricalPriceHistory(config, next, state.rngState);
  return next;
}

function spend(state: GameState, amount: number): boolean {
  if (amount < 0 || state.player.cash < amount) {
    return false;
  }
  state.player.cash -= amount;
  return true;
}

function scaleDrugValue(carried: number, totalValue: number, amountRemoved: number): number {
  if (carried <= 0 || amountRemoved <= 0 || amountRemoved >= carried) {
    return 0;
  }
  return Math.floor((totalValue * (carried - amountRemoved)) / carried);
}

function drugGiftUnitValue(config: GameConfig, state: GameState, drug: DrugConfig): number {
  return marketBidPrice(config, state, drug);
}

function relationshipGainForGift(value: number): number {
  return clamp(Math.floor(Math.sqrt(Math.max(0, value) / 100)), 1, 25);
}

function randomChoice<T>(state: GameState, items: T[]): T {
  let index = 0;
  [state.rngState, index] = randomInt(state.rngState, 0, items.length);
  return items[index];
}

function riskLabel(presence: number): "LOW" | "MED" | "HIGH" {
  if (presence >= 65) {
    return "HIGH";
  }
  if (presence >= 25) {
    return "MED";
  }
  return "LOW";
}

function influenceLabel(value: number): "HOSTILE" | "SHAKY" | "NEUTRAL" | "FRIENDLY" | "OWNED" {
  if (value < -45) {
    return "HOSTILE";
  }
  if (value < -10) {
    return "SHAKY";
  }
  if (value < 25) {
    return "NEUTRAL";
  }
  if (value < 60) {
    return "FRIENDLY";
  }
  return "OWNED";
}

function intelAccuracyChance(state: GameState, hobo: HoboConfig, modifier = 0): number {
  const relationship = hoboRelationship(state, hobo.id);
  const reputation = state.player.reputation ?? 0;
  const influence = locationInfluence(state, hobo.locationId);
  return clamp(hobo.intelQuality + Math.floor(relationship / 2) + Math.floor(reputation / 4) + Math.floor(influence / 5) + modifier, 12, 95);
}

function nextIntelId(state: GameState): number {
  return Math.max(state.logIndex + 1, 1, ...state.intelReports.map((report) => report.id + 1));
}

function pickFlavorLine(state: GameState, key: string, variants: string[]): string {
  return variants[textRoll(state, key, 71) % variants.length];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatIntelSummary(hobo: Pick<HoboConfig, "name">, text: string): string {
  if (text.startsWith("Intel from ")) {
    return text;
  }

  const speaker = escapeRegExp(hobo.name);
  const spokenPrefix = new RegExp(
    `^${speaker}\\s+(?:says|heard|swears|figures|claims|calls|bows(?:\\s+low)?|sings)\\s*:?\\s*`,
    "i",
  );
  const summary = text
    .replace(spokenPrefix, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return `Intel from ${hobo.name}: ${summary || text}`;
}

function hoserMarketIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  drug: DrugConfig,
  quote: MarketQuote,
  accurate: boolean,
): string {
  if (accurate) {
    if (quote.price > 0) {
      return pickFlavorLine(state, `${hobo.id}-${drug.id}-market-hot`, [
        `${hobo.name} says quiet buyers are circling ${drug.name} harder than the board says, bud.`,
        `${hobo.name} heard ${drug.name} is moving through side pockets before it hits the table, eh.`,
        `${hobo.name} says ${drug.name} has buyers waiting after dark, my guy.`,
      ]);
    }

    return pickFlavorLine(state, `${hobo.id}-${drug.id}-market-dry`, [
      `${hobo.name} says ${drug.name} is dry as a winter boot, but buyers are still asking around.`,
      `${hobo.name} heard nobody's showing ${drug.name} openly, but the demand hasn't gone home.`,
      `${hobo.name} says ${drug.name} stock is hiding, not dead.`,
    ]);
  }

  const location = randomChoice(state, config.locations);
  return pickFlavorLine(state, `${hobo.id}-${drug.id}-${location.id}-market-fake`, [
      `${hobo.name} swears ${drug.name} is about to blow up in ${location.name}, but that yarn's wobblier than a dory in chop.`,
      `${hobo.name} heard ${drug.name} is gettin' hot in ${location.name}. Sounds like buddy's been into the sauce, eh.`,
      `${hobo.name} says ${drug.name} is the next big rip in ${location.name}, but I'd check that twice, my guy.`,
  ]);
}

function hoserDealerIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  dealer: DealerConfig,
  threshold: number,
  accurate: boolean,
): string {
  const dealerName = dealerDisplayName(config, dealer);
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${dealer.id}-dealer-true`, [
      `${hobo.name} says ${dealerName} remembers who wastes time and who brings clean gifts, eh.`,
      `${hobo.name} heard ${dealerName} keeps one ear on robbery talk before prices even come up.`,
      `${hobo.name} says ${dealerName} opens up faster when business starts respectful, my guy.`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${dealer.id}-dealer-fake`, [
    `${hobo.name} says ${dealerName} folds easier than a wet dart. That read smells like low tide.`,
    `${hobo.name} figures ${dealerName} is easy to shove around. Feels fishier than the harbour, bud.`,
    `${hobo.name} heard ${dealerName} is soft as a soggy Timbit. I'd not bet the rent on it, my guy.`,
  ]);
}

function hoserPoliceIntelText(
  state: GameState,
  hobo: HoboConfig,
  location: LocationConfig,
  accurate: boolean,
  presence: number,
  fakeRisk?: string,
): string {
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${location.id}-police-true`, [
      `${hobo.name} says plainclothes have been watching handoffs around ${location.name}, sorry and nosy as hell.`,
      `${hobo.name} heard ${location.name} has patrols checking faces after messy deals, eh.`,
      `${hobo.name} says the badges in ${location.name} are listening for loud moves, my guy.`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${location.id}-police-fake`, [
    `${hobo.name} claims ${location.name} is ${fakeRisk}, then changes the story like a Leafs fan in April.`,
    `${hobo.name} says ${location.name} is ${fakeRisk} heat, but the details are slippier than harbour ice.`,
    `${hobo.name} calls ${location.name} ${fakeRisk}, but buddy can't keep the yarn straight, my guy.`,
  ]);
}

function hoserTurfIntelText(
  state: GameState,
  hobo: HoboConfig,
  location: LocationConfig,
  influence: number,
  accurate: boolean,
): string {
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${location.id}-turf-true`, [
      `${hobo.name} says your name is travelling through ${location.name} faster than your feet, bud.`,
      `${hobo.name} heard ${location.name} remembers who pays, who threatens, and who runs, eh.`,
      `${hobo.name} says ${location.name} is keeping score even when nobody says it out loud, my guy.`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${location.id}-turf-fake`, [
    `${hobo.name} says everyone in ${location.name} is on your side. Sure, and the harbour's made of gravy, bud.`,
    `${hobo.name} figures ${location.name} loves ya. That sounds too sweet by half, eh.`,
    `${hobo.name} says ${location.name} is all yours, but the street's hummin' a different tune, my guy.`,
  ]);
}

function hoserOpportunityIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  dealer: DealerConfig,
  accurate: boolean,
): string {
  const dealerName = dealerDisplayName(config, dealer);
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${dealer.id}-opportunity-true`, [
      `${hobo.name} says ${dealerName}'s cash box sounded heavier than usual, but somebody was watching the door, bud.`,
      `${hobo.name} heard ${dealerName} had a rich morning and a nervous lookout, eh.`,
      `${hobo.name} says ${dealerName}'s carrying enough to tempt a fool, but the room isn't empty, my guy.`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${dealer.id}-opportunity-fake`, [
    `${hobo.name} says ${dealerName}'s got fat pockets and nobody ridin' shotgun. Feels fishier than the harbour, bud.`,
    `${hobo.name} heard ${dealerName}'s carryin' enough cash to sink a dory, and he's all by his lonesome. Bit too perfect, eh?`,
    `${hobo.name} says ${dealerName}'s carryin' a fistful o' loonies and no muscle. Sounds too good to be true, eh.`,
    `${hobo.name} swears ${dealerName}'s loaded and flyin' solo. I'd bet my last Tims double-double there's a catch, my guy.`,
  ]);
}

function rhymeMarketIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  drug: DrugConfig,
  quote: MarketQuote,
  accurate: boolean,
): string {
  if (accurate) {
    if (quote.price > 0) {
      return pickFlavorLine(state, `${hobo.id}-${drug.id}-rhyme-market-hot`, [
        `${hobo.name} bows low: "${drug.name} hums behind the street; side-door buyers tap the beat."`,
        `${hobo.name} sings: "${drug.name} moves before the light; step soft in the harbour night."`,
        `${hobo.name} says: "${drug.name} has whispers under town; hear the tune before it drowns."`,
      ]);
    }

    return pickFlavorLine(state, `${hobo.id}-${drug.id}-rhyme-market-dry`, [
      `${hobo.name} sings: "${drug.name} is gone from every stare; buyers still whisper through the air."`,
      `${hobo.name} bows: "${drug.name} went quiet, no stock in sight; hunger still hums through the night."`,
      `${hobo.name} says: "${drug.name} is missing from the lane; demand still knocks against the rain."`,
    ]);
  }

  const location = randomChoice(state, config.locations);
  return pickFlavorLine(state, `${hobo.id}-${drug.id}-${location.id}-rhyme-market-fake`, [
    `${hobo.name} claims: "${drug.name} will blaze in ${location.name} tonight; but that fiddle sounds crooked and light."`,
    `${hobo.name} sings: "${drug.name} is hot in ${location.name}, clear and bright; still, that tune may vanish by night."`,
    `${hobo.name} says: "${drug.name} will rise where ${location.name} lies; but the bow shakes hard and the note tells lies."`,
  ]);
}

function rhymeDealerIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  dealer: DealerConfig,
  threshold: number,
  accurate: boolean,
): string {
  const dealerName = dealerDisplayName(config, dealer);
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${dealer.id}-rhyme-dealer-true`, [
      `${hobo.name} sings: "${dealerName} hears who pays and who lies; clean gifts open cleaner eyes."`,
      `${hobo.name} bows: "${dealerName} weighs respect before reply; ugly talk makes trust run dry."`,
      `${hobo.name} says: "${dealerName}'s door has a careful eye; bring calm business or pass by."`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${dealer.id}-rhyme-dealer-fake`, [
    `${hobo.name} sings: "${dealerName} looks soft, or so the rumours cry; that tune is cracked, and the bow runs dry."`,
    `${hobo.name} says: "${dealerName} seems easy if you try; but sweet songs can hide a lie."`,
    `${hobo.name} bows: "${dealerName} has no bite, the whispers imply; yet the string shakes wrong when I draw it by."`,
  ]);
}

function rhymePoliceIntelText(
  state: GameState,
  hobo: HoboConfig,
  location: LocationConfig,
  accurate: boolean,
  presence: number,
  fakeRisk?: string,
): string {
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${location.id}-rhyme-police-true`, [
      `${hobo.name} sings: "${location.name} has quiet eyes tonight; sorry badges lean outside the light."`,
      `${hobo.name} bows: "${location.name} hears the cruisers steer; keep your fiddle ear clear."`,
      `${hobo.name} says: "${location.name} has badges dressed as air; step too loud and they are there."`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${location.id}-rhyme-police-fake`, [
    `${hobo.name} claims: "${location.name} is ${fakeRisk} tonight; then forgets the tune by morning light."`,
    `${hobo.name} sings: "${location.name} is ${fakeRisk}, I swear it is right; but the last note stumbles out of sight."`,
    `${hobo.name} says: "${location.name} feels ${fakeRisk}, with no cops near; yet the rhyme rings hollow in my ear."`,
  ]);
}

function rhymeTurfIntelText(
  state: GameState,
  hobo: HoboConfig,
  location: LocationConfig,
  influence: number,
  accurate: boolean,
): string {
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${location.id}-rhyme-turf-true`, [
      `${hobo.name} sings: "${location.name} knows the shape of your name; every gift and threat feeds the flame."`,
      `${hobo.name} bows: "${location.name} keeps score where footsteps steer; debts and favors gather near."`,
      `${hobo.name} says: "${location.name} hums when you appear; play soft or the block will hear."`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${location.id}-rhyme-turf-fake`, [
    `${hobo.name} sings: "${location.name} loves you, every alley and pier; but that chorus sounds false in my ear."`,
    `${hobo.name} bows: "${location.name} is yours, no worry or fear; yet the fiddle goes flat when that claim gets near."`,
    `${hobo.name} says: "${location.name} is friendly from gutter to gear; but the street hums doubt for all to hear."`,
  ]);
}

function rhymeOpportunityIntelText(
  config: GameConfig,
  state: GameState,
  hobo: HoboConfig,
  dealer: DealerConfig,
  accurate: boolean,
): string {
  const dealerName = dealerDisplayName(config, dealer);
  if (accurate) {
    return pickFlavorLine(state, `${hobo.id}-${dealer.id}-rhyme-opportunity-true`, [
      `${hobo.name} sings: "${dealerName}'s cash rings heavy and still; but a watcher waits by the sill."`,
      `${hobo.name} bows: "${dealerName} had a rich little run; perfect targets hide more than one."`,
      `${hobo.name} says: "${dealerName} tempts a hungry will; count the shadows before the till."`,
    ]);
  }

  return pickFlavorLine(state, `${hobo.id}-${dealer.id}-rhyme-opportunity-fake`, [
    `${hobo.name} sings: "${dealerName} is loaded and alone by the pier; when it sounds that sweet, keep danger near."`,
    `${hobo.name} bows: "${dealerName} has cash and no crew to appear; but a perfect little tune can hide a spear."`,
    `${hobo.name} says: "${dealerName} carries riches with nobody near; that song rings too clean in my ear."`,
  ]);
}

function createIntelReport(config: GameConfig, state: GameState, hobo: HoboConfig, accuracyModifier = 0): IntelReport {
  let topicIndex = 0;
  [state.rngState, topicIndex] = randomInt(state.rngState, 0, 5);
  const topic = ["market", "dealer", "police", "turf", "opportunity"][topicIndex] as IntelTopic;
  let accuracyRoll = 0;
  [state.rngState, accuracyRoll] = randomInt(state.rngState, 0, 100);
  const accurate = accuracyRoll < intelAccuracyChance(state, hobo, accuracyModifier);
  let text = "";
  let details: string[] = [];

  if (topic === "market") {
    const drug = randomChoice(state, config.drugs);
    const quote = marketQuote(state, drug.id);
    details = [
      `Topic: market movement for ${drug.name}.`,
      quote.price > 0
        ? `${drug.name} has current street stock, but the useful intel is about hidden demand outside the posted table.`
        : `${drug.name} is currently dry here, but the useful intel is that quiet demand still exists.`,
      accurate ? "Reliability: likely accurate." : "Reliability: shaky or possibly wrong.",
    ];
    if (hobo.dialogStyle === "hoser") {
      text = hoserMarketIntelText(config, state, hobo, drug, quote, accurate);
    } else if (hobo.dialogStyle === "rhyme") {
      text = rhymeMarketIntelText(config, state, hobo, drug, quote, accurate);
    } else if (accurate) {
      text = quote.price > 0
        ? `${hobo.name} says ${drug.name} has buyers circling outside the posted trade.`
        : `${hobo.name} says ${drug.name} is dry here, but quiet demand is still alive.`;
    } else {
      const location = randomChoice(state, config.locations);
      text = `${hobo.name} swears ${drug.name} is about to get hot in ${location.name}, but the story sounds shaky.`;
    }
  } else if (topic === "dealer") {
    const localDealers = dealersForLocation(config, state.player.locationId);
    const dealer = randomChoice(state, localDealers.length > 0 ? localDealers : config.dealers);
    const dealerName = dealerDisplayName(config, dealer);
    details = [
      `Topic: behavior around ${dealerName}.`,
      accurate
        ? `${dealerName} reacts strongly to respect, gifts, threats, robbery talk, and wasted time.`
        : `The claim that ${dealerName} is easy to push around is unreliable.`,
      "Do not reveal exact relationship thresholds or UI-visible relationship numbers.",
      accurate ? "Reliability: likely accurate." : "Reliability: shaky or possibly wrong.",
    ];
    if (hobo.dialogStyle === "hoser") {
      text = hoserDealerIntelText(config, state, hobo, dealer, dealerRefusalThreshold(dealer, state), accurate);
    } else if (hobo.dialogStyle === "rhyme") {
      text = rhymeDealerIntelText(config, state, hobo, dealer, dealerRefusalThreshold(dealer, state), accurate);
    } else if (accurate) {
      text = `${hobo.name} says ${dealerName} remembers clean gifts, ugly threats, and who starts trouble.`;
    } else {
      text = `${hobo.name} says ${dealerName} looks easy to push around. That read feels thin.`;
    }
  } else if (topic === "police") {
    const location = randomChoice(state, config.locations);
    const presence = effectivePolicePresence(config, state, location);
    details = [
      `Topic: police behavior in ${location.name}.`,
      accurate
        ? `Plainclothes or patrols have been watching handoffs and loud moves around ${location.name}.`
        : `The claim that police have cleared out of ${location.name} is unreliable.`,
      "Do not reveal exact police percentages or UI-visible risk labels.",
      accurate ? "Reliability: likely accurate." : "Reliability: shaky or possibly wrong.",
    ];
    if (hobo.dialogStyle === "hoser") {
      if (accurate) {
        text = hoserPoliceIntelText(state, hobo, location, accurate, presence);
      } else {
        const fakeRisk = randomChoice(state, ["LOW", "MED", "HIGH"]);
        text = hoserPoliceIntelText(state, hobo, location, accurate, presence, fakeRisk);
      }
    } else if (hobo.dialogStyle === "rhyme") {
      if (accurate) {
        text = rhymePoliceIntelText(state, hobo, location, accurate, presence);
      } else {
        const fakeRisk = randomChoice(state, ["LOW", "MED", "HIGH"]);
        text = rhymePoliceIntelText(state, hobo, location, accurate, presence, fakeRisk);
      }
    } else if (accurate) {
      text = `${hobo.name} says plainclothes have been watching handoffs around ${location.name}.`;
    } else {
      text = `${hobo.name} claims the badges cleared out of ${location.name}, but keeps changing details.`;
    }
  } else if (topic === "turf") {
    const location = getLocation(config, state.player.locationId);
    const influence = locationInfluence(state, location.id);
    details = [
      `Topic: street memory in ${location.name}.`,
      accurate
        ? `${location.name} is keeping track of the player's gifts, threats, robberies, and debts.`
        : `The claim that everyone in ${location.name} is on the player's side is unreliable.`,
      "Do not reveal exact turf scores or UI-visible reputation numbers.",
      accurate ? "Reliability: likely accurate." : "Reliability: shaky or possibly wrong.",
    ];
    if (hobo.dialogStyle === "hoser") {
      text = hoserTurfIntelText(state, hobo, location, influence, accurate);
    } else if (hobo.dialogStyle === "rhyme") {
      text = rhymeTurfIntelText(state, hobo, location, influence, accurate);
    } else if (accurate) {
      text = `${hobo.name} says ${location.name} is keeping score on your gifts, threats, and debts.`;
    } else {
      text = `${hobo.name} says everyone in ${location.name} is on your side. The street does not quite agree.`;
    }
  } else {
    const dealer = randomChoice(state, config.dealers);
    const dealerName = dealerDisplayName(config, dealer);
    details = [
      `Topic: robbery opportunity around ${dealerName}.`,
      accurate
        ? `${dealerName}'s cash box may be heavier than usual, but the room is not empty and somebody may be watching.`
        : `The claim that ${dealerName} has easy money and no backup is unreliable.`,
      "Do not reveal exact greed, toughness, guard, or danger numbers.",
      accurate ? "Reliability: likely accurate." : "Reliability: shaky or possibly wrong.",
    ];
    if (hobo.dialogStyle === "hoser") {
      text = hoserOpportunityIntelText(config, state, hobo, dealer, accurate);
    } else if (hobo.dialogStyle === "rhyme") {
      text = rhymeOpportunityIntelText(config, state, hobo, dealer, accurate);
    } else if (accurate) {
      text = `${hobo.name} says ${dealerName}'s cash box sounded heavy, but the room was not empty.`;
    } else {
      text = `${hobo.name} says ${dealerName} is carrying easy money and no backup. It sounds too clean.`;
    }
  }

  return {
    id: nextIntelId(state),
    turn: state.player.turn,
    date: state.player.date,
    sourceId: hobo.id,
    sourceName: hobo.name,
    locationId: hobo.locationId,
    topic,
    text: `Intel from ${hobo.name}: ${details.join(" ")}`,
    details,
    accurate,
  };
}

function recordIntelReport(config: GameConfig, state: GameState, hobo: HoboConfig, accuracyModifier = 0): void {
  const report = createIntelReport(config, state, hobo, accuracyModifier);
  state.intelReports.unshift(report);
  state.intelReports = state.intelReports.slice(0, 12);
  pushLog(state, report.accurate ? "info" : "warn", report.text);
  rememberNpc(state, hobo.id, "intel", report.text);
}

function makeInitialPlayer(config: GameConfig): PlayerState {
  return {
    name: "Solo Dealer",
    turn: 1,
    date: config.startDate,
    locationId: config.locations[0].id,
    cash: config.startCash,
    debt: config.startDebt,
    bank: config.startBank,
    health: config.startHealth,
    space: config.baseSpace + config.startHelpers * config.helperSpace,
    helpers: config.startHelpers,
    reputation: 0,
    defeatedCopTier: 0,
    drugs: Object.fromEntries(config.drugs.map((drug) => [drug.id, { carried: 0, totalValue: 0 }])),
    guns: Object.fromEntries(config.guns.map((gun) => [gun.id, { carried: 0 }])),
  };
}

interface MarketRoll {
  market: MarketQuote[];
  messages: string[];
  seed: number;
}

function generateMarket(config: GameConfig, locationId: string, rngState: number): MarketRoll {
  const deal = new Map<string, MarketQuote>();
  const messages: string[] = [];
  let seed = rngState;

  for (const drug of config.drugs) {
    let bidPrice = 0;
    [seed, bidPrice] = randomPrice(seed, drug.minPrice, drug.maxPrice);
    deal.set(drug.id, { drugId: drug.id, price: 0, bidPrice, deal: "none" });
  }

  let numEvents = 0;
  let roll = 0;

  [seed, roll] = randomInt(seed, 0, 100);
  if (roll < 70) {
    numEvents = 1;
  }

  [seed, roll] = randomInt(seed, 0, 100);
  if (roll < 40 && numEvents === 1) {
    numEvents = 2;
  }

  [seed, roll] = randomInt(seed, 0, 100);
  if (roll < 5 && numEvents === 2) {
    numEvents = 3;
  }

  let specialCount = 0;
  let guard = 0;

  while (numEvents > 0 && guard < 80) {
    guard += 1;
    let index = 0;
    [seed, index] = randomInt(seed, 0, config.drugs.length);
    const drug = config.drugs[index];
    const current = deal.get(drug.id);
    if (!current || current.deal !== "none") {
      continue;
    }

    let coin = 0;
    [seed, coin] = randomInt(seed, 0, 100);
    if (drug.expensive && (!drug.cheap || coin < 50)) {
      let price = 0;
      [seed, price] = randomPrice(seed, drug.minPrice, drug.maxPrice);
      deal.set(drug.id, {
        drugId: drug.id,
        price: price * config.drugsMeta.expensiveMultiply,
        bidPrice: price * config.drugsMeta.expensiveMultiply,
        deal: "expensive",
      });
      [seed, coin] = randomInt(seed, 0, 100);
      const template = coin < 50 ? config.drugsMeta.expensiveMessageA : config.drugsMeta.expensiveMessageB;
      messages.push(template.replace("%DRUG%", drug.name));
      specialCount += 1;
      numEvents -= 1;
    } else if (drug.cheap) {
      let price = 0;
      [seed, price] = randomPrice(seed, drug.minPrice, drug.maxPrice);
      const eventPrice = Math.max(1, Math.floor(price / config.drugsMeta.cheapDivide));
      deal.set(drug.id, {
        drugId: drug.id,
        price: eventPrice,
        bidPrice: eventPrice,
        deal: "cheap",
      });
      messages.push(drug.cheapMessage);
      specialCount += 1;
      numEvents -= 1;
    }
  }

  const location = getLocation(config, locationId);
  let targetCount = 0;
  [seed, targetCount] = randomInt(seed, location.minDrug, location.maxDrug);
  targetCount = Math.min(targetCount, config.drugs.length);

  let normalCount = Math.max(0, targetCount - specialCount);
  guard = 0;
  while (normalCount > 0 && guard < 160) {
    guard += 1;
    let index = 0;
    [seed, index] = randomInt(seed, 0, config.drugs.length);
    const drug = config.drugs[index];
    const current = deal.get(drug.id);
    if (current?.price === 0) {
      let price = 0;
      [seed, price] = randomPrice(seed, drug.minPrice, drug.maxPrice);
      deal.set(drug.id, { drugId: drug.id, price, bidPrice: price, deal: "normal" });
      normalCount -= 1;
    }
  }

  return {
    seed,
    market: config.drugs.map((drug) => deal.get(drug.id)!),
    messages,
  };
}

function dealerStockChance(dealer: DealerConfig, quote: MarketQuote): number {
  let chance = 72 + Math.floor(dealer.greed / 8) + Math.floor(dealer.connected / 12);
  if (quote.deal === "cheap") {
    chance += 10;
  } else if (quote.deal === "expensive") {
    chance -= 8;
  }
  return clamp(chance, 35, 95);
}

function rollDealerStock(config: GameConfig, state: GameState): void {
  state.dealerStock = makeDealerStock(config);

  for (const dealer of dealersForLocation(config, state.player.locationId)) {
    for (const drugId of dealer.drugIds) {
      const quote = marketQuote(state, drugId);
      if (quote.price <= 0) {
        continue;
      }

      let stockRoll = 0;
      [state.rngState, stockRoll] = randomInt(state.rngState, 0, 100);
      if (stockRoll >= dealerStockChance(dealer, quote)) {
        continue;
      }

      const drug = getDrug(config, drugId);
      const maxAmount = dealerStockMaxAmount(dealer, drug, quote);
      let amount = 0;
      [state.rngState, amount] = randomInt(state.rngState, 1, maxAmount + 1);
      setDealerStockAmount(state, dealer.id, drugId, amount);
    }
  }
}

function rollMerchantMarket(config: GameConfig, state: GameState): void {
  state.merchantMarket = makeMerchantMarket(config);

  for (const merchant of config.merchants) {
    for (const gun of config.guns) {
      const basePrice = Math.max(1, Math.floor((gun.price * merchant.markup) / 100));
      const low = Math.max(1, Math.floor(basePrice * 0.6));
      const high = Math.max(low + 1, Math.ceil(basePrice * 1.65));
      let price = basePrice;
      [state.rngState, price] = randomPrice(state.rngState, low, high);
      const deal: MerchantQuote["deal"] =
        price <= Math.floor(basePrice * 0.78) ? "cheap" :
        price >= Math.ceil(basePrice * 1.32) ? "expensive" :
        "normal";

      state.merchantMarket[merchant.id][gun.id] = {
        gunId: gun.id,
        price,
        bidPrice: Math.max(1, Math.floor((price * merchant.bid) / 100)),
        deal,
      };
    }
  }
}

function rollMarket(config: GameConfig, state: GameState): string[] {
  const result = generateMarket(config, state.player.locationId, state.rngState);
  state.rngState = result.seed;
  state.market = result.market;
  rollDealerStock(config, state);
  rollMerchantMarket(config, state);
  recordPriceHistory(config, state);
  return result.messages;
}

function setHelperPrice(config: GameConfig, state: GameState): void {
  if (state.player.locationId !== config.serviceLocations.roughPub) {
    state.currentHelperPrice = null;
    return;
  }

  const [seed, price] = randomPrice(state.rngState, config.prices.helperMin, config.prices.helperMax);
  state.rngState = seed;
  state.currentHelperPrice = price;
}

function createPrompt(state: GameState, prompt: PendingPrompt): void {
  state.pendingPrompt = prompt;
  pushLog(state, "warn", prompt.text);
}

function maybeDealerApproachOffer(config: GameConfig, state: GameState, dealer: DealerConfig): void {
  const offer = dealer.approachOffer;
  if (!offer || state.pendingPrompt || dealer.locationId !== state.player.locationId) {
    return;
  }

  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  if (roll >= clamp(offer.chance, 0, 100)) {
    return;
  }

  let price = 0;
  [state.rngState, price] = randomPrice(state.rngState, offer.priceMin, offer.priceMax + 1);
  createPrompt(state, {
    type: "dealer-offer",
    offerId: offer.id,
    dealerId: dealer.id,
    price,
    relationshipGain: offer.relationshipGain,
    text: withEh(state, withSwearing(state, renderDealerOfferText(config, state, dealer, offer.prompt, price), 35), 72),
    acceptMessage: offer.acceptMessage,
    declineMessage: offer.declineMessage,
    poorMessage: offer.poorMessage,
  });
  rememberNpc(state, dealer.id, "offer", `${dealer.name} made a side offer: ${renderDealerOfferText(config, state, dealer, offer.prompt, price)}`);
}

function rememberNpc(state: GameState, npcId: string, kind: NpcMemoryKind, text: string): void {
  state.npcMemory ??= [];
  state.logIndex += 1;
  state.npcMemory.push({
    id: state.logIndex,
    turn: state.player.turn,
    date: state.player.date,
    npcId,
    kind,
    text,
  });
}

function gainHelper(config: GameConfig, state: GameState): void {
  state.player.helpers += 1;
  state.player.space += config.helperSpace;
}

function loseHelper(config: GameConfig, state: GameState): void {
  if (state.player.helpers <= 0) {
    return;
  }
  state.player.helpers -= 1;
  state.player.space -= config.helperSpace;

  while (state.player.space < 0) {
    const drug = config.drugs.find((item) => state.player.drugs[item.id].carried > 0);
    if (drug) {
      const inventory = state.player.drugs[drug.id];
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, 1);
      inventory.carried -= 1;
      state.player.space += 1;
      continue;
    }

    const gun = config.guns.find((item) => (state.player.guns[item.id]?.carried ?? 0) > 0);
    if (!gun) {
      state.player.space = Math.max(0, state.player.space);
      break;
    }

    state.player.guns[gun.id].carried -= 1;
    state.player.space += gun.space;
  }
}

function damagePlayer(config: GameConfig, state: GameState, damage: number): void {
  if (state.player.health > damage) {
    state.player.health -= damage;
    pushLog(state, "bad", `You took ${damage} damage.`);
    return;
  }

  if (state.player.helpers > 0) {
    loseHelper(config, state);
    state.player.health = 100;
    pushLog(state, "bad", `One of your ${config.names.helperPlural} was killed.`);
    return;
  }

  state.player.health = 0;
  finishGame(state, "You're dead! Game over.");
}

function maybeDoctor(config: GameConfig, state: GameState): void {
  if (state.gameOver || state.player.health >= 100) {
    return;
  }

  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  const location = getLocation(config, state.player.locationId);
  if (roll > effectivePolicePresence(config, state, location)) {
    let price = 0;
    [state.rngState, price] = randomPrice(state.rngState, config.prices.helperMin, config.prices.helperMax);
    price = Math.max(1, Math.floor((price * state.player.health) / 500));
    createPrompt(state, {
      type: "doctor",
      price,
      text: withEh(state, withSwearing(state, `Do you pay a doctor ${formatMoney(config, price)} to sew you up?`, 25), 45),
    });
  }
}

function createCopsPrompt(config: GameConfig, state: GameState): void {
  const cop = config.cops[Math.min(state.player.defeatedCopTier, config.cops.length - 1)];
  let deputies = 0;
  [state.rngState, deputies] = randomInt(state.rngState, cop.minDeputies, cop.maxDeputies);
  createPrompt(state, {
    type: "cops",
    copId: cop.id,
    deputies,
    text: withViolentSorry(state, `${cop.name} and ${deputies} ${deputies === 1 ? cop.deputyName : cop.deputiesName} are chasing you!`),
  });
}

function offerObject(config: GameConfig, state: GameState, forceHelper = false): boolean {
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);

  if (forceHelper || roll < 50) {
    let price = 0;
    [state.rngState, price] = randomPrice(state.rngState, config.prices.helperMin, config.prices.helperMax);
    price = Math.max(1, Math.floor(price / 10));
    createPrompt(state, {
      type: "bargain-helper",
      price,
      text: withEh(state, withSwearing(state, `Hey dude! I'll help carry your ${config.names.drugPlural} for a mere ${formatMoney(config, price)}. Yes or no?`, 40), 75),
    });
    return true;
  }

  if (config.guns.length > 0 && totalGuns(state.player) < state.player.helpers + 2) {
    let index = 0;
    [state.rngState, index] = randomInt(state.rngState, 0, config.guns.length);
    const gun = config.guns[index];
    const price = Math.max(1, Math.floor(gun.price / 10));
    if (gun.space <= state.player.space) {
      createPrompt(state, {
        type: "bargain-gun",
        gunId: gun.id,
        price,
        text: withEh(state, withSwearing(state, `Would you like to buy a ${gun.name} for ${formatMoney(config, price)}?`, 30), 65),
      });
      return true;
    }
  }

  return false;
}

function randomDrugWithAtLeast(config: GameConfig, state: GameState, amount: number): string | null {
  let seed = state.rngState;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let index = 0;
    [seed, index] = randomInt(seed, 0, config.drugs.length);
    const drug = config.drugs[index];
    if (state.player.drugs[drug.id].carried >= amount) {
      state.rngState = seed;
      return drug.id;
    }
  }
  state.rngState = seed;
  return null;
}

function randomOffer(config: GameConfig, state: GameState): boolean {
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);

  if (roll < 10) {
    let percent = 0;
    [state.rngState, percent] = randomInt(state.rngState, 80, 95);
    state.player.cash = Math.floor((state.player.cash * percent) / 100);
    pushLog(state, "bad", withEh(state, withViolentSorry(state, "Somebody mugs you in the subway!"), 50));
    return false;
  }

  if (roll < 30) {
    let amount = 0;
    [state.rngState, amount] = randomInt(state.rngState, 3, 7);
    const carriedDrugId = randomDrugWithAtLeast(config, state, amount);

    if (!carriedDrugId && amount > state.player.space) {
      return false;
    }

    if (!carriedDrugId) {
      let index = 0;
      [state.rngState, index] = randomInt(state.rngState, 0, config.drugs.length);
      const drug = config.drugs[index];
      state.player.drugs[drug.id].carried += amount;
      state.player.space -= amount;
      pushLog(state, "good", withEh(state, withSwearing(state, `You meet a friend! He gives you ${amount} ${drug.name}.`, 24), 70));
    } else {
      const drug = getDrug(config, carriedDrugId);
      const inventory = state.player.drugs[drug.id];
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      pushLog(state, "warn", withEh(state, withSwearing(state, `You meet a friend! You give him ${amount} ${drug.name}.`, 24), 70));
    }
    return false;
  }

  if (roll < 50) {
    let amount = 0;
    [state.rngState, amount] = randomInt(state.rngState, 3, 7);
    const carriedDrugId = randomDrugWithAtLeast(config, state, amount);

    if (carriedDrugId) {
      const drug = getDrug(config, carriedDrugId);
      const inventory = state.player.drugs[drug.id];
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      pushLog(state, "bad", withViolentSorry(state, `Police dogs chase you for blocks! You dropped some ${config.names.drugPlural}.`));
    } else if (amount <= state.player.space) {
      let index = 0;
      [state.rngState, index] = randomInt(state.rngState, 0, config.drugs.length);
      const drug = config.drugs[index];
      state.player.drugs[drug.id].carried += amount;
      state.player.space -= amount;
      pushLog(state, "good", withEh(state, withSwearing(state, `You find ${amount} ${drug.name} on a dead dude in the subway!`, 30), 55));
    }
    return false;
  }

  if (roll < 60 && state.player.drugs.weed.carried + state.player.drugs.hashish.carried > 0) {
    const drugId = state.player.drugs.weed.carried > state.player.drugs.hashish.carried ? "weed" : "hashish";
    const drug = getDrug(config, drugId);
    const inventory = state.player.drugs[drug.id];
    let amount = 0;
    [state.rngState, amount] = randomInt(state.rngState, 2, 6);
    amount = Math.min(amount, inventory.carried);
    inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
    inventory.carried -= amount;
    state.player.space += amount;
    pushLog(state, "warn", withEh(state, withSwearing(state, `Your mama made brownies with some of your ${drug.name}! They were great!`, 26), 60));
    return false;
  }

  if (roll < 65) {
    createPrompt(state, {
      type: "wild-weed",
      text: withEh(state, withSwearing(state, "There is some weed that smells like paraquat here! It looks good! Will you smoke it?", 28), 60),
    });
    return true;
  }

  if (config.stoppedTo.length > 0) {
    let index = 0;
    let amount = 0;
    [state.rngState, index] = randomInt(state.rngState, 0, config.stoppedTo.length);
    [state.rngState, amount] = randomInt(state.rngState, 1, 10);
    state.player.cash = Math.max(0, state.player.cash - amount);
    pushLog(state, "info", withEh(state, withSwearing(state, `You stopped to ${config.stoppedTo[index]}.`, 22), 45));
  }

  return false;
}

function maybeTravelEncounter(config: GameConfig, state: GameState): void {
  const worth = netWorth(state.player);
  const range = worth > 3_000_000 ? 130 : worth > 1_000_000 ? 115 : 100;
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, range);
  const influence = locationInfluence(state, state.player.locationId);
  const avoidThreshold = clamp(75 + Math.floor((state.player.reputation ?? 0) / 6) + Math.floor(influence / 8), 55, 90);
  if (roll <= avoidThreshold) {
    return;
  }

  const location = getLocation(config, state.player.locationId);
  [state.rngState, roll] = randomInt(state.rngState, 0, 80 + effectivePolicePresence(config, state, location));
  if (roll < 33) {
    offerObject(config, state);
  } else if (roll < 50) {
    randomOffer(config, state);
  } else {
    createCopsPrompt(config, state);
  }
}

function maybeSubwaySaying(config: GameConfig, state: GameState): void {
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  if (roll >= 15 || (config.subwaySayings.length === 0 && config.playing.length === 0)) {
    return;
  }

  let subwayChance = 50;
  if (config.subwaySayings.length === 0) {
    subwayChance = 0;
  } else if (config.playing.length === 0) {
    subwayChance = 100;
  }

  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  if (roll < subwayChance) {
    let index = 0;
    [state.rngState, index] = randomInt(state.rngState, 0, config.subwaySayings.length);
    pushLog(state, "info", withEh(state, withSwearing(state, `The lady next to you on the subway said, "${config.subwaySayings[index]}"`, 26), 68));
  } else {
    let index = 0;
    [state.rngState, index] = randomInt(state.rngState, 0, config.playing.length);
    pushLog(state, "info", withEh(state, withSwearing(state, `You hear someone playing ${config.playing[index]}`, 20), 35));
  }
}

function serviceLog(config: GameConfig, state: GameState): void {
  const locationId = state.player.locationId;
  if (locationId === config.serviceLocations.loanShark && state.player.debt > 0) {
    pushLog(state, "warn", withSwearing(state, `${config.names.loanShark} wants his money.`, 28));
  }
  if (locationId === config.serviceLocations.bank) {
    pushLog(state, "info", `${config.names.bank} is open.`);
  }
  const localMerchants = merchantsForLocation(config, locationId);
  if (localMerchants.length > 0) {
    pushLog(state, "info", `${localMerchants.map((merchant) => merchant.name).join(", ")} ${localMerchants.length === 1 ? "is" : "are"} open for trade.`);
  }
  if (locationId === config.serviceLocations.roughPub) {
    pushLog(state, "info", `You can hire ${config.names.helperPlural} at ${config.names.roughPub}.`);
  }
}

function finishIfOutOfTime(config: GameConfig, state: GameState): boolean {
  if (config.numTurns > 0 && state.player.turn >= config.numTurns) {
    finishGame(state, "Your dealing time is up...");
    return true;
  }

  return false;
}

function advanceDay(config: GameConfig, state: GameState): void {
  state.player.turn += 1;
  state.player.date = addDays(state.player.date, 1);
  state.player.debt = Math.max(0, Math.floor((state.player.debt * (100 + config.debtInterest)) / 100));
  state.player.bank = Math.max(0, Math.floor((state.player.bank * (100 + config.bankInterest)) / 100));
}

function finishGame(state: GameState, message: string): void {
  state.gameOver = true;
  state.pendingPrompt = null;
  state.finalScore = netWorth(state.player);
  pushLog(state, state.player.health <= 0 ? "bad" : "warn", message);
  pushLog(state, state.finalScore >= 0 ? "good" : "bad", `Final score: ${state.finalScore}.`);
}

function runFromCops(config: GameConfig, state: GameState): void {
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  if (roll < 60) {
    state.pendingPrompt = null;
    pushLog(state, "good", withPoliceSorry(state, "You got away!", 55));
    maybeDoctor(config, state);
    return;
  }

  pushLog(state, "bad", withViolentSorry(state, "The cops cut off your escape!"));
  const prompt = state.pendingPrompt;
  if (!prompt || prompt.type !== "cops") {
    state.pendingPrompt = null;
    return;
  }

  const cop = getCop(config, prompt.copId);
  const gun = getGun(config, cop.gunId);
  let damage = 0;
  for (let index = 0; index < prompt.deputies * cop.deputyGun + cop.copGun; index += 1) {
    let hit = 0;
    [state.rngState, hit] = randomInt(state.rngState, 0, gun.damage);
    damage += hit;
  }
  damage = Math.max(1, Math.floor((damage * 100) / config.playerArmor));
  state.pendingPrompt = null;
  damagePlayer(config, state, damage);
  maybeDoctor(config, state);
}

function fightCops(config: GameConfig, state: GameState): void {
  const prompt = state.pendingPrompt;
  if (!prompt || prompt.type !== "cops") {
    return;
  }

  if (totalGuns(state.player) <= 0) {
    pushLog(state, "bad", withViolentSorry(state, `The cops tell you running is your only move because you have no ${config.names.gunPlural}.`));
    runFromCops(config, state);
    return;
  }

  const cop = getCop(config, prompt.copId);
  let attackRating = 80;
  for (const gun of config.guns) {
    attackRating += gun.damage * state.player.guns[gun.id].carried;
  }
  let defendRating = Math.max(10, 100 - prompt.deputies * 5 - cop.defendPenalty);

  let attackRoll = 0;
  let defendRoll = 0;
  [state.rngState, attackRoll] = randomInt(state.rngState, 0, attackRating);
  [state.rngState, defendRoll] = randomInt(state.rngState, 0, defendRating);

  if (attackRoll > defendRoll) {
    let loot = 0;
    [state.rngState, loot] = randomInt(state.rngState, 100, 2000);
    state.player.cash += loot;
    state.player.defeatedCopTier = Math.min(config.cops.length - 1, state.player.defeatedCopTier + 1);
    state.pendingPrompt = null;
    pushLog(state, "good", withViolentSorry(state, `You fought off ${cop.name} and found ${formatMoney(config, loot)}.`, 82));
    maybeDoctor(config, state);
    return;
  }

  const copGun = getGun(config, cop.gunId);
  let damage = 0;
  for (let index = 0; index < prompt.deputies * cop.deputyGun + cop.copGun; index += 1) {
    let hit = 0;
    [state.rngState, hit] = randomInt(state.rngState, 0, copGun.damage);
    damage += hit;
  }

  state.pendingPrompt = null;
  pushLog(state, "bad", withViolentSorry(state, `${cop.name} fights back.`));
  damagePlayer(config, state, Math.max(1, damage));
  maybeDoctor(config, state);
}

function maybeDealerRetaliation(config: GameConfig, state: GameState, dealer: DealerConfig): void {
  if (state.pendingPrompt || state.gameOver) {
    return;
  }

  const influence = locationInfluence(state, dealer.locationId);
  const chance = clamp(Math.floor(dealer.connected / 4) + Math.floor(dealer.paranoia / 5) + Math.floor(Math.max(0, -influence) / 4), 0, 60);
  let roll = 0;
  [state.rngState, roll] = randomInt(state.rngState, 0, 100);
  if (roll < chance) {
    pushLog(state, "bad", withEh(state, withSwearing(state, `${dealer.name}'s people tipped off the cops.`, 45), 55));
    createCopsPrompt(config, state);
  }
}

interface DealerStashItem {
  drug: DrugConfig;
  amount: number;
  unitValue: number;
  value: number;
}

interface DealerStashTransfer {
  taken: DealerStashItem[];
  totalValue: number;
  takenValue: number;
  leftValue: number;
}

function dealerStockMaxAmount(dealer: DealerConfig, drug: DrugConfig, quote: MarketQuote): number {
  const averagePrice = Math.max(1, Math.floor((drug.minPrice + drug.maxPrice) / 2));
  let maxAmount = 1 + Math.floor(dealer.greed / 35) + Math.floor(dealer.connected / 60);

  if (averagePrice < 100) {
    maxAmount += 18;
  } else if (averagePrice < 500) {
    maxAmount += 10;
  } else if (averagePrice < 1500) {
    maxAmount += 6;
  } else if (averagePrice < 5000) {
    maxAmount += 4;
  } else if (averagePrice < 14000) {
    maxAmount += 2;
  } else {
    maxAmount += 1;
  }

  if (quote.deal === "cheap") {
    maxAmount += 5;
  } else if (quote.deal === "expensive") {
    maxAmount = Math.max(1, Math.floor(maxAmount * 0.7));
  }

  if (quote.price <= Math.floor(averagePrice / 2)) {
    maxAmount += 2;
  } else if (quote.price >= averagePrice * 2) {
    maxAmount = Math.max(1, Math.floor(maxAmount / 2));
  }

  return clamp(maxAmount, 1, 24);
}

function dealerStashFromStock(config: GameConfig, state: GameState, dealer: DealerConfig): DealerStashItem[] {
  const stash: DealerStashItem[] = [];

  for (const drugId of dealer.drugIds) {
    const quote = marketQuote(state, drugId);
    const amount = dealerStockAmount(state, dealer.id, drugId);
    if (quote.price <= 0 || amount <= 0) {
      continue;
    }

    const drug = getDrug(config, drugId);
    stash.push({
      drug,
      amount,
      unitValue: quote.price,
      value: quote.price * amount,
    });
  }

  return stash;
}

function rollDealerRobberyCash(state: GameState, dealer: DealerConfig, stashValue: number): number {
  if (stashValue <= 0) {
    return 0;
  }

  const minPercent = clamp(6 + Math.floor(dealer.greed / 20), 6, 18);
  const maxPercent = clamp(24 + Math.floor(dealer.greed / 6) + Math.floor(dealer.connected / 10), minPercent + 1, 55);
  let percent = 0;
  [state.rngState, percent] = randomInt(state.rngState, minPercent, maxPercent + 1);
  return Math.max(1, Math.floor((stashValue * percent) / 100));
}

function transferDealerStashToPlayer(state: GameState, stash: DealerStashItem[]): DealerStashTransfer {
  const transfer: DealerStashTransfer = {
    taken: [],
    totalValue: stash.reduce((sum, item) => sum + item.value, 0),
    takenValue: 0,
    leftValue: 0,
  };

  const prioritized = [...stash].sort((a, b) => b.unitValue - a.unitValue);
  for (const item of prioritized) {
    const amount = Math.min(item.amount, state.player.space);
    if (amount <= 0) {
      transfer.leftValue += item.value;
      continue;
    }

    state.player.drugs[item.drug.id].carried += amount;
    state.player.space -= amount;

    const value = amount * item.unitValue;
    transfer.taken.push({
      ...item,
      amount,
      value,
    });
    transfer.takenValue += value;
    transfer.leftValue += item.value - value;
  }

  return transfer;
}

function clearDealerStashStock(state: GameState, dealerId: string, stash: DealerStashItem[]): void {
  for (const item of stash) {
    setDealerStockAmount(state, dealerId, item.drug.id, 0);
  }
}

function formatDrugLoot(items: DealerStashItem[]): string {
  return items.map((item) => `${item.amount} ${item.drug.name}`).join(", ");
}

function resolveDealerRobbery(config: GameConfig, state: GameState, dealer: DealerConfig): void {
  setDealerRelationship(state, dealer.id, -100);
  adjustReputation(state, -10 - Math.floor(dealer.connected / 25));
  adjustLocationInfluence(state, dealer.locationId, -10 - Math.floor(dealer.violence / 15));
  pushLog(state, "bad", `You tried to rob ${dealer.name}.`);
  rememberNpc(state, dealer.id, "violence", `Player tried to rob ${dealer.name}.`);

  const fearBonus = Math.floor(Math.max(0, -(state.player.reputation ?? 0)) / 2);
  const playerAttack = 55 + config.guns.reduce((sum, gun) => sum + gun.damage * state.player.guns[gun.id].carried * 8, 0) + state.player.helpers * 2 + fearBonus;
  const unpredictableDefense = dealer.traits.includes("unpredictable") ? state.rngState % 24 : 0;
  const dealerDefense = dealer.toughness + dealer.guardCount * 24 + Math.floor(dealer.violence / 2) + Math.floor(dealer.loyalty / 5) + unpredictableDefense;
  let attackRoll = 0;
  let defendRoll = 0;
  [state.rngState, attackRoll] = randomInt(state.rngState, 0, Math.max(1, playerAttack));
  [state.rngState, defendRoll] = randomInt(state.rngState, 0, Math.max(1, dealerDefense));

  if (attackRoll > defendRoll) {
    state.dealerRobberyTurns[dealer.id] = state.player.turn;
    const stash = dealerStashFromStock(config, state, dealer);
    const transfer = transferDealerStashToPlayer(state, stash);
    clearDealerStashStock(state, dealer.id, stash);
    const cashLoot = rollDealerRobberyCash(state, dealer, transfer.totalValue);
    state.player.cash += cashLoot;

    if (transfer.totalValue > 0) {
      pushLog(
        state,
        "good",
        `You stole ${formatMoney(config, cashLoot)} cash from ${dealer.name}. Stash value found: ${formatMoney(config, transfer.totalValue)}.`,
      );
    } else {
      pushLog(state, "warn", `${dealer.name}'s stash and cash box were empty.`);
    }

    if (transfer.taken.length > 0) {
      pushLog(
        state,
        "good",
        `You stole ${formatDrugLoot(transfer.taken)} worth ${formatMoney(config, transfer.takenValue)}.`,
      );
    }

    if (transfer.leftValue > 0) {
      pushLog(
        state,
        "warn",
        `You left ${formatMoney(config, transfer.leftValue)} of ${dealer.name}'s stash behind because you could not carry it.`,
      );
    }
    rememberNpc(
      state,
      dealer.id,
      "violence",
      transfer.totalValue > 0
        ? `Robbery succeeded: player took ${formatMoney(config, cashLoot)} cash and ${formatMoney(config, transfer.takenValue)} of stash from ${dealer.name}.`
        : `Robbery succeeded but ${dealer.name}'s stash and cash box were empty.`,
    );
    maybeDealerRetaliation(config, state, dealer);
    return;
  }

  adjustReputation(state, -5);
  const dealerGun = getGun(config, dealer.weaponGunId);
  let damage = 0;
  for (let index = 0; index < dealer.guardCount + 1; index += 1) {
    let hit = 0;
    [state.rngState, hit] = randomInt(state.rngState, 1, dealerGun.damage + 1);
    damage += hit;
  }
  damage = Math.max(1, Math.floor((damage * 100) / config.playerArmor));
  pushLog(state, "bad", `${dealer.name} fought back with a ${dealerGun.name}.`);
  rememberNpc(state, dealer.id, "violence", `Robbery failed: ${dealer.name} fought back with a ${dealerGun.name} and hurt the player.`);
  damagePlayer(config, state, damage);
  maybeDoctor(config, state);
  maybeDealerRetaliation(config, state, dealer);
}

function resolveHoboThreat(config: GameConfig, state: GameState, hobo: HoboConfig): void {
  const relationship = hoboRelationship(state, hobo.id);
  adjustHoboRelationship(state, hobo.id, -25);
  adjustReputation(state, -4);
  adjustLocationInfluence(state, hobo.locationId, -6);
  pushLog(state, "bad", withEh(state, withViolentSorry(state, `You threaten ${hobo.name}.`), 45));
  rememberNpc(state, hobo.id, "violence", `Player threatened ${hobo.name} for information.`);

  const fear = Math.max(0, -(state.player.reputation ?? 0));
  const fearThresholdBonus = (state.player.reputation ?? 0) <= hobo.fearThreshold ? 12 : 0;
  const playerThreat = 35 + totalGuns(state.player) * 12 + state.player.helpers + Math.floor(fear / 2) + fearThresholdBonus;
  const resistance = hobo.toughness + Math.max(0, relationship) + Math.max(0, locationInfluence(state, hobo.locationId));
  let threatRoll = 0;
  let resistRoll = 0;
  [state.rngState, threatRoll] = randomInt(state.rngState, 0, Math.max(1, playerThreat));
  [state.rngState, resistRoll] = randomInt(state.rngState, 0, Math.max(1, resistance));

  if (threatRoll > resistRoll) {
    pushLog(state, "warn", `${hobo.name} gives intel under pressure.`);
    rememberNpc(state, hobo.id, "violence", `${hobo.name} gave the player intel after being threatened.`);
    recordIntelReport(config, state, hobo, -20);
    return;
  }

  let fightRoll = 0;
  [state.rngState, fightRoll] = randomInt(state.rngState, 0, 100);
  if (fightRoll < 55) {
    const damage = Math.max(1, Math.floor(hobo.toughness / 8));
    pushLog(state, "bad", withEh(state, withViolentSorry(state, `${hobo.name} fights back.`), 65));
    rememberNpc(state, hobo.id, "violence", `${hobo.name} fought back after the player threatened them.`);
    damagePlayer(config, state, damage);
    maybeDoctor(config, state);
    return;
  }

  pushLog(state, "warn", `${hobo.name} gives you a story that does not quite add up.`);
  rememberNpc(state, hobo.id, "violence", `${hobo.name} gave unreliable intel after the player threatened them.`);
  recordIntelReport(config, state, hobo, -55);
}

export function createGame(config: GameConfig, seed = Date.now()): GameState {
  const player = makeInitialPlayer(config);
  const rngState = normalizeSeed(seed);
  const historicalSamples = Math.max(0, config.numTurns - 1);
  const state: GameState = {
    rngState,
    logIndex: 0,
    market: [],
    merchantMarket: makeMerchantMarket(config),
    priceHistory: makeHistoricalPriceHistory(
      config,
      rngState,
      player.locationId,
      historicalSamples,
      player.date,
      player.turn,
    ),
    dealerStock: makeDealerStock(config),
    dealerRobberyTurns: makeDealerRobberyTurns(config),
    dealerRelationships: makeDealerRelationships(config),
    hoboRelationships: makeHoboRelationships(config),
    locationInfluence: makeLocationInfluence(config),
    intelReports: [],
    npcMemory: [],
    player,
    pendingPrompt: null,
    currentHelperPrice: null,
    gameOver: false,
    finalScore: null,
    lastCommand: "NEW",
    eventLog: [],
  };

  rollMarket(config, state).forEach((message) => pushLog(state, "warn", withSwearing(state, message, 30)));
  setHelperPrice(config, state);
  pushLog(state, "good", `You arrive in ${getLocation(config, player.locationId).name}.`);
  pushLog(state, "warn", `${config.names.loanShark} wants ${formatMoney(config, player.debt)}.`);
  return state;
}

export function applyCommand(config: GameConfig, previous: GameState, command: GameCommand): GameState {
  const state = hydrateGameState(config, previous);
  state.lastCommand =
    command.type === "approachDealer" ? "APPROACH" :
    command.type === "giftDrug" ? "GIFT" :
    command.type === "robDealer" ? "ROB" :
    command.type === "buyHoboIntel" ? "INTEL" :
    command.type === "giftHoboDrug" ? "GIFT" :
    command.type === "threatenHobo" ? "THREATEN" :
    command.type === "rememberNpc" ? "CHAT" :
    command.type.toUpperCase();

  if (command.type === "rememberNpc") {
    rememberNpc(state, command.npcId, command.kind, command.text);
    return state;
  }

  if (state.gameOver) {
    return state;
  }

  const amount = "amount" in command ? Math.max(0, Math.floor(command.amount)) : 0;

  switch (command.type) {
    case "approachDealer": {
      if (state.pendingPrompt) {
        return state;
      }
      const dealer = getDealer(config, command.dealerId);
      if (dealer.locationId !== state.player.locationId) {
        return state;
      }
      maybeDealerApproachOffer(config, state, dealer);
      return state;
    }

    case "buyDrug": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const dealer = dealerForTrade(config, state, command.dealerId, command.drugId);
      const quote = marketQuote(state, command.drugId);
      const drug = getDrug(config, command.drugId);
      const cost = quote.price * amount;
      const stock = dealer ? dealerStockAmount(state, dealer.id, drug.id) : 0;
      if (!dealer || !dealerCanTrade(config, state, dealer, drug.id)) {
        pushLog(state, "bad", dealer ? withEh(state, `${dealer.name} refuses to deal.`, 70) : `Nobody here deals ${drug.name}.`);
        return state;
      }
      if (quote.price <= 0 || amount <= 0 || amount > stock || cost > state.player.cash || amount > state.player.space) {
        pushLog(state, "bad", `You can't buy that much ${drug.name}.`);
        return state;
      }
      state.player.cash -= cost;
      state.player.space -= amount;
      state.player.drugs[drug.id].carried += amount;
      state.player.drugs[drug.id].totalValue += cost;
      adjustDealerStockAmount(state, dealer.id, drug.id, -amount);
      adjustDealerRelationship(state, dealer.id, dealerTradeRelationshipGain(dealer, cost));
      adjustLocationInfluence(state, dealer.locationId, cost >= 5000 ? 2 : 1);
      if (cost >= 10000) {
        adjustReputation(state, 1);
      }
      pushLog(state, "good", withEh(state, withSwearing(state, `You bought ${amount} ${drug.name} from ${dealer.name} for ${formatMoney(config, cost)}.`, 24), 62));
      rememberNpc(state, dealer.id, "interaction", `Player bought ${amount} ${drug.name} from ${dealer.name} for ${formatMoney(config, cost)}.`);
      return state;
    }

    case "sellDrug": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const dealer = dealerForTrade(config, state, command.dealerId, command.drugId);
      const drug = getDrug(config, command.drugId);
      const inventory = state.player.drugs[drug.id];
      const bidPrice = marketBidPrice(config, state, drug);
      if (!dealer || !dealerCanTrade(config, state, dealer, drug.id)) {
        pushLog(state, "bad", dealer ? withEh(state, `${dealer.name} refuses to deal.`, 70) : `Nobody here buys ${drug.name}.`);
        return state;
      }
      if (bidPrice <= 0 || amount <= 0 || amount > inventory.carried) {
        pushLog(state, "bad", `You can't sell that much ${drug.name} here.`);
        return state;
      }
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      const revenue = bidPrice * amount;
      state.player.cash += revenue;
      adjustDealerStockAmount(state, dealer.id, drug.id, amount);
      adjustDealerRelationship(state, dealer.id, dealerTradeRelationshipGain(dealer, revenue));
      adjustLocationInfluence(state, dealer.locationId, revenue >= 5000 ? 2 : 1);
      if (revenue >= 10000) {
        adjustReputation(state, 1);
      }
      pushLog(state, "good", withEh(state, withSwearing(state, `You sold ${amount} ${drug.name} to ${dealer.name} for ${formatMoney(config, revenue)}.`, 24), 62));
      rememberNpc(state, dealer.id, "interaction", `Player sold ${amount} ${drug.name} to ${dealer.name} for ${formatMoney(config, revenue)}.`);
      return state;
    }

    case "giftDrug": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const dealer = getDealer(config, command.dealerId);
      const drug = getDrug(config, command.drugId);
      const inventory = state.player.drugs[drug.id];
      if (dealer.locationId !== state.player.locationId) {
        pushLog(state, "bad", withEh(state, `${dealer.name} is not here.`, 45));
        return state;
      }
      if (amount <= 0 || amount > inventory.carried) {
        pushLog(state, "bad", `You don't have that much ${drug.name}.`);
        return state;
      }
      const value = drugGiftUnitValue(config, state, drug) * amount;
      const gain = dealerGiftRelationshipGain(dealer, value);
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      if (dealer.drugIds.includes(drug.id)) {
        adjustDealerStockAmount(state, dealer.id, drug.id, amount);
      }
      adjustDealerRelationship(state, dealer.id, gain);
      adjustLocationInfluence(state, dealer.locationId, Math.max(1, Math.floor(gain / 4)));
      if (value >= 5000) {
        adjustReputation(state, 1);
      }
      pushLog(state, "good", withEh(state, withSwearing(state, `You gifted ${amount} ${drug.name} to ${dealer.name}. Relationship +${gain}.`, 30), 65));
      rememberNpc(state, dealer.id, "interaction", `Player gifted ${amount} ${drug.name} to ${dealer.name}; relationship changed by +${gain}.`);
      return state;
    }

    case "robDealer": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const dealer = getDealer(config, command.dealerId);
      if (dealer.locationId !== state.player.locationId) {
        pushLog(state, "bad", withEh(state, `${dealer.name} is not here.`, 45));
        return state;
      }
      if ((state.dealerRobberyTurns?.[dealer.id] ?? 0) === state.player.turn) {
        pushLog(state, "bad", `You already robbed ${dealer.name} today. Come back after time passes.`);
        return state;
      }
      resolveDealerRobbery(config, state, dealer);
      return state;
    }

    case "buyHoboIntel": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const hobo = getHobo(config, command.hoboId);
      if (hobo.locationId !== state.player.locationId) {
        pushLog(state, "bad", withEh(state, `${hobo.name} is not here.`, 45));
        return state;
      }
      const price = hoboIntelPrice(config, state, hobo);
      if (price > state.player.cash) {
        pushLog(state, "bad", withEh(state, withSwearing(state, `${hobo.name} wants ${formatMoney(config, price)} for a Tims before talking.`, 36), 75));
        return state;
      }
      if (price > 0) {
        state.player.cash -= price;
        adjustHoboRelationship(state, hobo.id, 1);
        adjustLocationInfluence(state, hobo.locationId, 1);
        pushLog(state, "good", withEh(state, withSwearing(state, `You bought ${hobo.name} a Tims for ${formatMoney(config, price)} and got intel.`, 30), 62));
        rememberNpc(state, hobo.id, "interaction", `Player bought ${hobo.name} a Tims for ${formatMoney(config, price)} and asked for local intel.`);
      } else {
        adjustHoboRelationship(state, hobo.id, 1);
        pushLog(state, "good", withEh(state, withSwearing(state, `${hobo.name} gives you intel for free.`, 30), 75));
        rememberNpc(state, hobo.id, "interaction", `${hobo.name} gave the player local intel for free.`);
      }
      recordIntelReport(config, state, hobo, price === 0 ? 12 : 0);
      return state;
    }

    case "giftHoboDrug": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const hobo = getHobo(config, command.hoboId);
      const drug = getDrug(config, command.drugId);
      const inventory = state.player.drugs[drug.id];
      if (hobo.locationId !== state.player.locationId) {
        pushLog(state, "bad", withEh(state, `${hobo.name} is not here.`, 45));
        return state;
      }
      if (amount <= 0 || amount > inventory.carried) {
        pushLog(state, "bad", `You don't have that much ${drug.name}.`);
        return state;
      }
      const value = drugGiftUnitValue(config, state, drug) * amount;
      const gain = hoboGiftRelationshipGain(hobo, drug, value);
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      adjustHoboRelationship(state, hobo.id, gain);
      adjustLocationInfluence(state, hobo.locationId, Math.max(1, Math.floor(gain / 5)));
      if (value >= 1000) {
        adjustReputation(state, 1);
      }
      pushLog(state, "good", withEh(state, withSwearing(state, `You gifted ${amount} ${drug.name} to ${hobo.name}. Relationship +${gain}.`, 30), 65));
      rememberNpc(state, hobo.id, "interaction", `Player gifted ${amount} ${drug.name} to ${hobo.name}; relationship changed by +${gain}.`);
      return state;
    }

    case "threatenHobo": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const hobo = getHobo(config, command.hoboId);
      if (hobo.locationId !== state.player.locationId) {
        pushLog(state, "bad", withEh(state, `${hobo.name} is not here.`, 45));
        return state;
      }
      resolveHoboThreat(config, state, hobo);
      return state;
    }

    case "dropDrug": {
      const drug = getDrug(config, command.drugId);
      const inventory = state.player.drugs[drug.id];
      if (amount <= 0 || amount > inventory.carried) {
        pushLog(state, "bad", `You don't have that much ${drug.name}.`);
        return state;
      }
      inventory.totalValue = scaleDrugValue(inventory.carried, inventory.totalValue, amount);
      inventory.carried -= amount;
      state.player.space += amount;
      pushLog(state, "warn", withSwearing(state, `You dropped ${amount} ${drug.name}.`, 25));
      const location = getLocation(config, state.player.locationId);
      let roll = 0;
      [state.rngState, roll] = randomInt(state.rngState, 0, 100);
      if (!state.pendingPrompt && roll < effectivePolicePresence(config, state, location)) {
        pushLog(state, "bad", withViolentSorry(state, `The cops spot you dropping ${config.names.drugPlural}!`));
        createCopsPrompt(config, state);
      }
      return state;
    }

    case "stay": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      if (finishIfOutOfTime(config, state)) {
        return state;
      }
      const location = getLocation(config, state.player.locationId);
      advanceDay(config, state);
      pushLog(state, "info", `You stay in ${location.name}.`);
      rollMarket(config, state).forEach((message) => pushLog(state, "warn", withSwearing(state, message, 30)));
      setHelperPrice(config, state);
      serviceLog(config, state);
      return state;
    }

    case "travel": {
      if (state.pendingPrompt) {
        pushLog(state, "bad", "Answer the pending question first.");
        return state;
      }
      const location = getLocation(config, command.locationId);
      if (location.id === state.player.locationId) {
        pushLog(state, "bad", "You're already there.");
        return state;
      }
      if (finishIfOutOfTime(config, state)) {
        return state;
      }
      state.player.locationId = location.id;
      advanceDay(config, state);
      pushLog(state, "info", `You jet to ${location.name}.`);
      rollMarket(config, state).forEach((message) => pushLog(state, "warn", withSwearing(state, message, 30)));
      setHelperPrice(config, state);
      maybeTravelEncounter(config, state);
      if (!state.pendingPrompt) {
        maybeSubwaySaying(config, state);
        serviceLog(config, state);
      }
      return state;
    }

    case "deposit": {
      if (state.player.locationId !== config.serviceLocations.bank || amount <= 0 || amount > state.player.cash) {
        pushLog(state, "bad", "Deposit denied.");
        return state;
      }
      state.player.cash -= amount;
      state.player.bank += amount;
      pushLog(state, "good", `Deposited ${formatMoney(config, amount)}.`);
      return state;
    }

    case "withdraw": {
      if (state.player.locationId !== config.serviceLocations.bank || amount <= 0 || amount > state.player.bank) {
        pushLog(state, "bad", "Withdrawal denied.");
        return state;
      }
      state.player.bank -= amount;
      state.player.cash += amount;
      pushLog(state, "good", `Withdrew ${formatMoney(config, amount)}.`);
      return state;
    }

    case "payLoan": {
      if (state.player.locationId !== config.serviceLocations.loanShark || amount <= 0 || amount > state.player.cash || amount > state.player.debt) {
        pushLog(state, "bad", "Loan payment denied.");
        return state;
      }
      state.player.cash -= amount;
      state.player.debt -= amount;
      pushLog(state, "good", `Paid ${formatMoney(config, amount)} to ${config.names.loanShark}.`);
      return state;
    }

    case "buyGun": {
      const merchant = merchantForTrade(config, state, command.merchantId);
      if (!merchant) {
        pushLog(state, "bad", "There is no merchant buying weapons here.");
        return state;
      }
      const gun = getGun(config, command.gunId);
      const quote = merchantQuote(state, merchant.id, gun.id);
      if (!merchant.gunIds.includes(gun.id) || !quote) {
        pushLog(state, "bad", `${merchant.name} is not selling ${gun.name}.`);
        return state;
      }
      const cost = quote.price * amount;
      if (amount <= 0 || cost > state.player.cash || gun.space * amount > state.player.space || totalGuns(state.player) + amount > state.player.helpers + 2) {
        pushLog(state, "bad", `You can't buy that many ${gun.name}.`);
        return state;
      }
      state.player.cash -= cost;
      state.player.space -= gun.space * amount;
      state.player.guns[gun.id].carried += amount;
      pushLog(state, "good", `Bought ${amount} ${gun.name} from ${merchant.name} for ${formatMoney(config, cost)}.`);
      return state;
    }

    case "sellGun": {
      const merchant = merchantForTrade(config, state, command.merchantId);
      if (!merchant) {
        pushLog(state, "bad", "There is no merchant buying weapons here.");
        return state;
      }
      const gun = getGun(config, command.gunId);
      const quote = merchantQuote(state, merchant.id, gun.id);
      if (amount <= 0 || amount > state.player.guns[gun.id].carried) {
        pushLog(state, "bad", `You can't sell that many ${gun.name}.`);
        return state;
      }
      const revenue = (quote?.bidPrice ?? Math.max(1, Math.floor((gun.price * merchant.bid) / 100))) * amount;
      state.player.guns[gun.id].carried -= amount;
      state.player.space += gun.space * amount;
      state.player.cash += revenue;
      pushLog(state, "good", `Sold ${amount} ${gun.name} to ${merchant.name} for ${formatMoney(config, revenue)}.`);
      return state;
    }

    case "hireHelper": {
      if (state.player.locationId !== config.serviceLocations.roughPub || !state.currentHelperPrice || amount <= 0) {
        pushLog(state, "bad", "Hiring denied.");
        return state;
      }
      const cost = state.currentHelperPrice * amount;
      if (!spend(state, cost)) {
        pushLog(state, "bad", "You don't have enough cash.");
        return state;
      }
      for (let index = 0; index < amount; index += 1) {
        gainHelper(config, state);
      }
      pushLog(state, "good", `Hired ${amount} ${config.names.helperPlural} for ${formatMoney(config, cost)}.`);
      setHelperPrice(config, state);
      return state;
    }

    case "answerPrompt": {
      const prompt = state.pendingPrompt;
      if (!prompt) {
        pushLog(state, "bad", "There is no pending question.");
        return state;
      }

      if (prompt.type === "cops") {
        if (command.answer === "fight") {
          fightCops(config, state);
        } else {
          runFromCops(config, state);
        }
        return state;
      }

      if (prompt.type === "wild-weed") {
        state.pendingPrompt = null;
        if (command.answer === "yes") {
          state.player.health = 0;
          finishGame(state, "You hallucinated for three days, then died because your brain disintegrated!");
        } else {
          pushLog(state, "good", "You decide not to smoke it.");
        }
        return state;
      }

      if (prompt.type === "doctor") {
        state.pendingPrompt = null;
        if (command.answer === "yes" && state.player.cash >= prompt.price) {
          state.player.cash -= prompt.price;
          state.player.health = 100;
          pushLog(state, "good", "The doctor sews you up.");
        } else {
          pushLog(state, "warn", "You pass on the doctor.");
        }
        return state;
      }

      if (prompt.type === "dealer-offer") {
        const dealer = getDealer(config, prompt.dealerId);
        state.pendingPrompt = null;
        if (command.answer === "yes") {
          if (state.player.cash < prompt.price) {
          pushLog(
            state,
            "bad",
            withEh(state, renderDealerOfferText(config, state, dealer, prompt.poorMessage, prompt.price, prompt.relationshipGain), 70),
          );
          rememberNpc(state, dealer.id, "offer", `Player accepted ${dealer.name}'s side offer but did not have enough cash.`);
          return state;
          }

          state.player.cash -= prompt.price;
          if (dealer.locationId === state.player.locationId) {
            adjustDealerRelationship(state, dealer.id, prompt.relationshipGain);
            adjustLocationInfluence(state, dealer.locationId, 1);
          }
          pushLog(
            state,
            "good",
            withEh(
              state,
              withSwearing(
                state,
                renderDealerOfferText(config, state, dealer, prompt.acceptMessage, prompt.price, prompt.relationshipGain),
                26,
              ),
              68,
            ),
          );
          rememberNpc(state, dealer.id, "offer", `Player accepted ${dealer.name}'s side offer, paid ${formatMoney(config, prompt.price)}, and gained +${prompt.relationshipGain} relationship.`);
        } else {
          pushLog(
            state,
            "warn",
            withEh(state, withSwearing(state, renderDealerOfferText(config, state, dealer, prompt.declineMessage, prompt.price, prompt.relationshipGain), 26), 68),
          );
          rememberNpc(state, dealer.id, "offer", `Player declined ${dealer.name}'s side offer.`);
        }
        return state;
      }

      if (prompt.type === "bargain-helper") {
        state.pendingPrompt = null;
        if (command.answer === "yes" && state.player.cash >= prompt.price) {
          state.player.cash -= prompt.price;
          gainHelper(config, state);
          pushLog(state, "good", `You hired a ${config.names.helperSingular}.`);
        } else {
          pushLog(state, "warn", "You pass on the offer.");
        }
        return state;
      }

      if (prompt.type === "bargain-gun") {
        const gun = getGun(config, prompt.gunId);
        state.pendingPrompt = null;
        if (
          command.answer === "yes" &&
          state.player.cash >= prompt.price &&
          state.player.space >= gun.space &&
          totalGuns(state.player) < state.player.helpers + 2
        ) {
          state.player.cash -= prompt.price;
          state.player.space -= gun.space;
          state.player.guns[gun.id].carried += 1;
          pushLog(state, "good", `You bought a ${gun.name}.`);
        } else {
          pushLog(state, "warn", "You pass on the offer.");
        }
        return state;
      }

      return state;
    }
  }
}
