const ADJECTIVES = [
  "amber",
  "brisk",
  "calm",
  "cedar",
  "cobalt",
  "crimson",
  "dawn",
  "ember",
  "frozen",
  "gentle",
  "golden",
  "granite",
  "harbor",
  "indigo",
  "ivory",
  "jade",
  "lively",
  "lunar",
  "mellow",
  "misty",
  "noble",
  "opal",
  "prairie",
  "rapid",
  "rustic",
  "scarlet",
  "silent",
  "solar",
  "steady",
  "swift",
  "tidal",
  "violet",
  "wild",
  "winter",
];

const NOUNS = [
  "badger",
  "beacon",
  "brook",
  "bison",
  "canopy",
  "cliff",
  "comet",
  "cove",
  "crest",
  "dune",
  "falcon",
  "fjord",
  "forest",
  "fox",
  "glacier",
  "grove",
  "harbor",
  "hawk",
  "meadow",
  "mesa",
  "otter",
  "peak",
  "pine",
  "quartz",
  "ridge",
  "river",
  "sparrow",
  "summit",
  "timber",
  "trail",
  "valley",
  "wave",
  "willow",
  "zephyr",
];

const randomItem = (items: string[]): string =>
  items[Math.floor(Math.random() * items.length)] as string;

export const generateWorkspaceName = (takenNames: Set<string>): string => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${randomItem(ADJECTIVES)}-${randomItem(NOUNS)}`;
    if (!takenNames.has(candidate)) {
      return candidate;
    }
  }

  return `workspace-${Date.now()}`;
};
