import AsyncStorage from '@react-native-async-storage/async-storage';

// Default Chapa Sandbox Keys (Test Mode)
// The user can override these in the settings/store modal so they don't have to rebuild the app.
const DEFAULT_PUBLIC_KEY = 'CHAPUBK_TEST-c3u0WvP98fB325v5S7N2o1H3J4K5L6M7';
const DEFAULT_SECRET_KEY = 'CHASECK_TEST-1H2J3K4L5M6N7O8P9Q0R1S2T3U4V5W6X';

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
    if (pubKey) {
      await AsyncStorage.setItem('kotariw_chapa_public', pubKey.trim());
    }
    if (secKey) {
      await AsyncStorage.setItem('kotariw_chapa_secret', secKey.trim());
    }
    return true;
  } catch (e) {
    console.error('Failed to save Chapa keys:', e);
    return false;
  }
}

/**
 * Initialize Chapa transaction
 * @param {number} amount - Amount in ETB (Birr)
 * @param {string} txRef - Unique transaction reference
 * @param {string} email - Operator email or fallback
 * @param {string} name - Operator name or fallback
 */
export async function initializeChapaPayment(amount, txRef, email = 'operator@kotariw.com', name = 'Operator') {
  const secretKey = await getChapaSecretKey();
  
  const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
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
      return_url: 'https://chapa.co', // We'll return to the app via web browser onClose
      customization: {
        title: 'Kotariw Game Coins',
        description: `Top up for ${amount} Birr`
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
 * @param {string} txRef - The unique transaction reference to verify
 */
export async function verifyChapaPayment(txRef) {
  const secretKey = await getChapaSecretKey();

  const response = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`
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
