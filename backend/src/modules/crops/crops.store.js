export const cropQueryStore = [];

export function saveCropQuery(entry) {
  cropQueryStore.unshift(entry);
  if (cropQueryStore.length > 300) {
    cropQueryStore.length = 300;
  }
}

export function getCropQueryHistory(userId) {
  if (!userId) return cropQueryStore.slice(0, 20);
  return cropQueryStore.filter((item) => item.userId === userId).slice(0, 20);
}
