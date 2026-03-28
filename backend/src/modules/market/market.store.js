const BASE_MARKET_DATA = [
  { market: 'Nizamabad Mandi', district: 'Nizamabad', state: 'Telangana', lat: 18.67, lng: 78.1, commodity: 'rice', modalPrice: 2450 },
  { market: 'Karimnagar Yard', district: 'Karimnagar', state: 'Telangana', lat: 18.44, lng: 79.13, commodity: 'rice', modalPrice: 2390 },
  { market: 'Warangal Market', district: 'Warangal', state: 'Telangana', lat: 17.97, lng: 79.6, commodity: 'rice', modalPrice: 2410 },
  { market: 'Adilabad Cotton Market', district: 'Adilabad', state: 'Telangana', lat: 19.67, lng: 78.53, commodity: 'cotton', modalPrice: 6920 },
  { market: 'Guntur Cotton Yard', district: 'Guntur', state: 'Andhra Pradesh', lat: 16.31, lng: 80.44, commodity: 'cotton', modalPrice: 6750 },
  { market: 'Warangal Cotton Centre', district: 'Warangal', state: 'Telangana', lat: 17.98, lng: 79.59, commodity: 'cotton', modalPrice: 7010 },
  { market: 'Khammam Chilli Yard', district: 'Khammam', state: 'Telangana', lat: 17.25, lng: 80.15, commodity: 'chilli', modalPrice: 14150 },
  { market: 'Guntur Chilli Market', district: 'Guntur', state: 'Andhra Pradesh', lat: 16.3, lng: 80.44, commodity: 'chilli', modalPrice: 14920 },
  { market: 'Byadgi Chilli Market', district: 'Haveri', state: 'Karnataka', lat: 14.67, lng: 75.48, commodity: 'chilli', modalPrice: 15200 },
  { market: 'Nanded Soybean Yard', district: 'Nanded', state: 'Maharashtra', lat: 19.15, lng: 77.32, commodity: 'soybean', modalPrice: 4860 },
  { market: 'Latur Soybean Market', district: 'Latur', state: 'Maharashtra', lat: 18.4, lng: 76.58, commodity: 'soybean', modalPrice: 4920 },
  { market: 'Indore Soybean Market', district: 'Indore', state: 'Madhya Pradesh', lat: 22.72, lng: 75.86, commodity: 'soybean', modalPrice: 5010 },
  { market: 'Karimnagar Maize Yard', district: 'Karimnagar', state: 'Telangana', lat: 18.44, lng: 79.13, commodity: 'maize', modalPrice: 2280 },
  { market: 'Nizamabad Maize Yard', district: 'Nizamabad', state: 'Telangana', lat: 18.67, lng: 78.1, commodity: 'maize', modalPrice: 2320 },
  { market: 'Davanagere Maize Market', district: 'Davanagere', state: 'Karnataka', lat: 14.47, lng: 75.92, commodity: 'maize', modalPrice: 2350 },
  { market: 'Nashik Onion Market', district: 'Nashik', state: 'Maharashtra', lat: 19.99, lng: 73.79, commodity: 'onion', modalPrice: 2370 },
  { market: 'Lasalgaon Onion Yard', district: 'Nashik', state: 'Maharashtra', lat: 20.14, lng: 74.23, commodity: 'onion', modalPrice: 2440 },
  { market: 'Kurnool Onion Market', district: 'Kurnool', state: 'Andhra Pradesh', lat: 15.83, lng: 78.03, commodity: 'onion', modalPrice: 2280 },
  { market: 'Nizamabad Turmeric Market', district: 'Nizamabad', state: 'Telangana', lat: 18.67, lng: 78.1, commodity: 'turmeric', modalPrice: 11800 },
  { market: 'Erode Turmeric Market', district: 'Erode', state: 'Tamil Nadu', lat: 11.34, lng: 77.73, commodity: 'turmeric', modalPrice: 12150 },
  { market: 'Sangli Turmeric Market', district: 'Sangli', state: 'Maharashtra', lat: 16.85, lng: 74.58, commodity: 'turmeric', modalPrice: 11620 },
  { market: 'Kurnool Banana Market', district: 'Kurnool', state: 'Andhra Pradesh', lat: 15.83, lng: 78.03, commodity: 'banana', modalPrice: 1890 },
  { market: 'Anantapur Banana Yard', district: 'Anantapur', state: 'Andhra Pradesh', lat: 14.68, lng: 77.6, commodity: 'banana', modalPrice: 1970 },
  { market: 'Jalgaon Banana Market', district: 'Jalgaon', state: 'Maharashtra', lat: 21.01, lng: 75.56, commodity: 'banana', modalPrice: 2050 },
];

const marketQueryStore = [];

export function getBaseMarketData() {
  return BASE_MARKET_DATA;
}

export function saveMarketQuery(entry) {
  marketQueryStore.unshift(entry);
  if (marketQueryStore.length > 400) {
    marketQueryStore.length = 400;
  }
}

export function getMarketQueryHistory(userId) {
  if (!userId) return marketQueryStore.slice(0, 40);
  return marketQueryStore.filter((item) => item.userId === userId).slice(0, 40);
}
