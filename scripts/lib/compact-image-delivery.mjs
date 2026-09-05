/** Lossless structural compaction; the complete editorial URL map remains available for audits. */
export function compactImageDeliveryManifest(manifest) {
  const commonPrefix = values => {
    let prefix = values[0] || "";
    for (const value of values) {
      let index = 0;
      while (index < prefix.length && prefix[index] === value[index]) index += 1;
      prefix = prefix.slice(0, index);
    }
    return prefix;
  };
  const sources = Object.entries(manifest);
  const sourceGroups = new Map();
  const groupKey = source => source.match(/^https?:\/\/[^/]+\//u)?.[0] || "";
  for (const [source] of sources) {
    const key = groupKey(source);
    const group = sourceGroups.get(key) || [];
    group.push(source);
    sourceGroups.set(key, group);
  }
  const sourcePrefixes = [...sourceGroups.values()].map(commonPrefix);
  const sourceGroupIndexes = new Map([...sourceGroups.keys()].map((key, index) => [key, index]));
  const renditionPrefix = commonPrefix(sources.flatMap(([, entry]) => [entry.src, ...entry.variants.map(value => value.src)]));
  const images = [];
  const imageIndexes = new Map();
  const packedSources = sources.map(([source, entry]) => {
    const key = JSON.stringify(entry);
    let image = imageIndexes.get(key);
    if (image === undefined) {
      image = images.length;
      imageIndexes.set(key, image);
      const prefix = commonPrefix([entry.src, ...entry.variants.map(value => value.src)]).slice(renditionPrefix.length);
      const variant = value => [value.src.slice(renditionPrefix.length + prefix.length), value.width, value.height];
      const largest = entry.variants.findIndex(value => value.src === entry.src && value.width === entry.width && value.height === entry.height);
      images.push([prefix, entry.variants.map(variant), largest < 0 ? variant(entry) : largest]);
    }
    const group = sourceGroupIndexes.get(groupKey(source));
    return [group, source.slice(sourcePrefixes[group].length), image];
  });
  return { version: 1, sourcePrefixes, sources: packedSources, renditionPrefix, images };
}
