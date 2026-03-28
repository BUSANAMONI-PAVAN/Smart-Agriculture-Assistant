import { createFarmer, findFarmerByPhone } from '../auth/auth.store.js';

export function registerFarmer(payload) {
  return createFarmer(payload);
}

export function loginFarmerByPhone(phone) {
  return findFarmerByPhone(phone);
}
