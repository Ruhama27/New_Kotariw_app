import AsyncStorage from '@react-native-async-storage/async-storage';

// Default Chapa Sandbox Keys (Test Mode)
const DEFAULT_PUBLIC_KEY = 'CHAPUBK_TEST-c3u0WvP98fB325v5S7N2o1H3J4K5L6M7';
const DEFAULT_SECRET_KEY = 'CHASECK_TEST-1H2J3K4L5M6N7O8P9Q0R1S2T3U4V5W6X';

// Verified Telebirr & Banking Config for Kotariw Pool Venue
export const DEFAULT_TELEBIRR_MERCHANT = '0968554778';
export const DEFAULT_TELEBIRR_PHONE = '0968554778';
export const DEFAULT_TELEBIRR_NAME = 'Kotariw Game';
export const DEFAULT_CBE_ACCOUNT = '1000123456789';

/**
 * Get Chapa Public Key from storage or return default
 */
export async function getChapaPublicKey() {
  try {
    const key = await AsyncStorage.getItem('kotariw_chapa_public');
    return key || DEFAULT_PUBLIC_KEY;
  } catch (e) {
    return DEFAULT_PUBLIC_KEY;
  }
}

/**
 * Get Chapa Secret Key from storage or return default
 */
export async function getChapaSecretKey() {
  try {
    const key = await AsyncStorage.getItem('kotariw_chapa_secret');
    return key || DEFAULT_SECRET_KEY;
  } catch (e) {
    return DEFAULT_SECRET_KEY;
  }
}

/**
 * Save Chapa keys to storage
 */
export async function saveChapaKeys(pubKey, secKey) {
  try {
    if (pubKey !== undefined) {
      await AsyncStorage.setItem('kotariw_chapa_public', pubKey.trim());
    }
    if (secKey !== undefined) {
      await AsyncStorage.setItem('kotariw_chapa_secret', secKey.trim());
    }
    return true;
  } catch (e) {
    console.error('Failed to save Chapa keys:', e);
    return false;
  }
}

/**
 * Get Telebirr and CBE details from storage or default
 */
export async function getTelebirrConfig() {
  try {
    const merchant = await AsyncStorage.getItem('kotariw_telebirr_merchant');
    const phone = await AsyncStorage.getItem('kotariw_telebirr_phone');
    const name = await AsyncStorage.getItem('kotariw_telebirr_name');
    const cbe = await AsyncStorage.getItem('kotariw_cbe_account');
    return {
      merchant: merchant || DEFAULT_TELEBIRR_MERCHANT,
      phone: phone || DEFAULT_TELEBIRR_PHONE,
      name: name || DEFAULT_TELEBIRR_NAME,
      cbe: cbe || DEFAULT_CBE_ACCOUNT,
    };
  } catch (e) {
    return {
      merchant: DEFAULT_TELEBIRR_MERCHANT,
      phone: DEFAULT_TELEBIRR_PHONE,
      name: DEFAULT_TELEBIRR_NAME,
      cbe: DEFAULT_CBE_ACCOUNT,
    };
  }
}

/**
 * Save Telebirr & CBE details
 */
export async function saveTelebirrConfig({ merchant, phone, name, cbe }) {
  try {
    if (merchant !== undefined) await AsyncStorage.setItem('kotariw_telebirr_merchant', merchant.trim());
    if (phone !== undefined) await AsyncStorage.setItem('kotariw_telebirr_phone', phone.trim());
    if (name !== undefined) await AsyncStorage.setItem('kotariw_telebirr_name', name.trim());
    if (cbe !== undefined) await AsyncStorage.setItem('kotariw_cbe_account', cbe.trim());
    return true;
  } catch (e) {
    console.error('Failed to save Telebirr config:', e);
    return false;
  }
}

/**
 * Generate a scannable Telebirr QR code URL
 * @param {number} amount - Amount in ETB
 * @param {string} receiverCode - Merchant code or Phone number
 * @param {string} receiverName - Business name
 */
export function getTelebirrQRUrl(amount, receiverCode = DEFAULT_TELEBIRR_PHONE, receiverName = DEFAULT_TELEBIRR_NAME) {
  const safeReceiver = encodeURIComponent(receiverCode || DEFAULT_TELEBIRR_PHONE);
  const safeName = encodeURIComponent(receiverName || DEFAULT_TELEBIRR_NAME);
  const safeAmount = encodeURIComponent(amount || 0);
  const payload = 'telebirr://pay?receiver=' + safeReceiver + '&amount=' + safeAmount + '&name=' + safeName + '&currency=ETB&app=Kotariw';
  return 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' + encodeURIComponent(payload) + '&bgcolor=ffffff&color=0072bc&margin=3';
}

/**
 * Record a purchase to local history
 */
export async function recordPurchase(purchase) {
  try {
    const existing = await AsyncStorage.getItem('kotariw_purchases');
    const list = existing ? JSON.parse(existing) : [];
    const item = {
      id: purchase.id || 'tx-' + Date.now(),
      date: new Date().toISOString(),
      status: purchase.status || 'PENDING', // PENDING, APPROVED, REJECTED
      ...purchase,
    };
    list.unshift(item);
    const trimmed = list.slice(0, 50);
    await AsyncStorage.setItem('kotariw_purchases', JSON.stringify(trimmed));
    return item;
  } catch (e) {
    console.error('Failed to record purchase:', e);
    return false;
  }
}

/**
 * Get all recorded purchases
 */
export async function getPurchases() {
  try {
    const existing = await AsyncStorage.getItem('kotariw_purchases');
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Update a purchase status (e.g., APPROVED or REJECTED)
 */
export async function updatePurchaseStatus(txId, newStatus) {
  try {
    const existing = await AsyncStorage.getItem('kotariw_purchases');
    if (!existing) return false;
    const list = JSON.parse(existing);
    const item = list.find(p => p.id === txId);
    if (item) {
      item.status = newStatus;
      item.updatedAt = new Date().toISOString();
      await AsyncStorage.setItem('kotariw_purchases', JSON.stringify(list));
      return item;
    }
    return false;
  } catch (e) {
    console.error('Failed to update purchase status:', e);
    return false;
  }
}

/**
 * Initialize Chapa transaction
 */
export async function initializeChapaPayment(amount, txRef, email = 'operator@kotariw.com', name = 'Operator') {
  const secretKey = await getChapaSecretKey();
  
  const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + secretKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: amount.toString(),
      currency: 'ETB',
      email: email,
      first_name: name,
      last_name: 'Kotariw',
      tx_ref: txRef,
      callback_url: 'https://webhook.site/kotariw-fallback',
      return_url: 'https://chapa.co',
      customization: {
        title: 'Kotariw Game Coins',
        description: 'Top up for ' + amount + ' Birr'
      }
    })
  });

  const resJson = await response.json();
  if (response.ok && resJson.status === 'success') {
    return {
      success: true,
      checkoutUrl: resJson.data.checkout_url
    };
  } else {
    throw new Error(resJson.message || 'Failed to initialize payment with Chapa.');
  }
}

/**
 * Verify transaction status with Chapa
 */
export async function verifyChapaPayment(txRef) {
  const secretKey = await getChapaSecretKey();

  const response = await fetch('https://api.chapa.co/v1/transaction/verify/' + txRef, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + secretKey
    }
  });

  const resJson = await response.json();
  if (response.ok && resJson.status === 'success') {
    return {
      success: true,
      data: resJson.data
    };
  } else {
    throw new Error(resJson.message || 'Transaction verification failed.');
  }
}
