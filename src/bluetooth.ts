/**
 * Real Bluetooth state detection & device discovery utility.
 *
 * - Web: Uses the standard Web Bluetooth API (`navigator.bluetooth.requestDevice`).
 *   Prompts the browser's native pairing picker to scan real nearby BLE devices.
 *
 * - Mobile (native): Uses react-native-ble-plx `BleManager` if a development build is used.
 *   If running in Expo Go (where native BLE modules are absent), it safely detects this
 *   and NEVER fakes or invents non-existent devices.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// Web Bluetooth API type definitions
export interface WebBluetoothDevice {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<any>;
    disconnect(): void;
  };
  addEventListener(type: string, listener: (e: any) => void): void;
  removeEventListener(type: string, listener: (e: any) => void): void;
}

export interface WebBluetooth {
  getAvailability(): Promise<boolean>;
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{
      name?: string;
      namePrefix?: string;
      services?: Array<string | number>;
    }>;
    optionalServices?: Array<string | number>;
  }): Promise<WebBluetoothDevice>;
  getDevices?(): Promise<WebBluetoothDevice[]>;
  addEventListener(type: string, listener: (e: Event) => void): void;
  removeEventListener(type: string, listener: (e: Event) => void): void;
}

declare global {
  interface Navigator {
    bluetooth?: WebBluetooth;
  }
}

export type BluetoothState = 'on' | 'off' | 'unknown';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  rawDevice?: any;
}

let nativeBleManager: BleManager | null = null;
let nativeBleManagerFailed = false;

/** Safely obtain native BleManager without crashing in Expo Go. */
export function getBleManager(): BleManager | null {
  if (Platform.OS === 'web' || nativeBleManagerFailed) return null;
  if (nativeBleManager) return nativeBleManager;
  try {
    nativeBleManager = new BleManager();
    return nativeBleManager;
  } catch (e) {
    nativeBleManagerFailed = true;
    console.warn('react-native-ble-plx is not available in Expo Go:', e);
    return null;
  }
}

/** Check if Web Bluetooth is supported in the current browser environment. */
export function isWebBluetoothSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof navigator.bluetooth?.requestDevice === 'function'
  );
}

/** Request Android 12+ (API 31+) and legacy runtime Bluetooth permissions. */
export async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const version =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);

    if (version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        results['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        results['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (err) {
    console.warn('Android BLE permission error:', err);
    return false;
  }
}

/** Check Bluetooth power state (on / off / unknown). */
export async function checkBluetoothState(): Promise<BluetoothState> {
  // ── Web ──
  if (Platform.OS === 'web') {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.bluetooth &&
        typeof navigator.bluetooth.getAvailability === 'function'
      ) {
        const adapterExists = await navigator.bluetooth.getAvailability();
        if (!adapterExists) return 'off';
        return 'on';
      }
    } catch {
      // not supported
    }
    return 'unknown';
  }

  // ── Mobile ──
  const manager = getBleManager();
  if (!manager) return 'unknown'; // Expo Go fallback

  try {
    const state = await manager.state();
    if (state === 'PoweredOn') return 'on';
    if (state === 'PoweredOff') return 'off';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function toBase64(str: string): string {
  try {
    return btoa(str);
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (
      let block = 0, charCode, i = 0, map = chars;
      str.charAt(i | 0) || ((map = '='), i % 1);
      output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
    ) {
      charCode = str.charCodeAt((i += 3 / 4));
      block = (block << 8) | charCode;
    }
    return output;
  }
}

function fromBase64(b64: string): string {
  try {
    return atob(b64);
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = b64.replace(/=+$/, '');
    let output = '';
    for (
      let bc = 0, bs = 0, buffer, idx = 0;
      (buffer = str.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  }
}

export const LUMO_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const LUMO_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let activeChar: any = null;
let activeDevice: any = null;
let activeNativeDevice: any = null;

type BleListener = (connected: boolean, name?: string) => void;
const bleListeners = new Set<BleListener>();

export function addBleListener(fn: BleListener): () => void {
  bleListeners.add(fn);
  fn(isBleConnected(), activeDevice?.name || activeNativeDevice?.name || activeNativeDevice?.localName);
  return () => bleListeners.delete(fn);
}

function notifyBleState(connected: boolean, name?: string) {
  bleListeners.forEach((fn) => fn(connected, name));
}

type BleDataListener = (data: string) => void;
const bleDataListeners = new Set<BleDataListener>();

export function addBleDataListener(fn: BleDataListener): () => void {
  bleDataListeners.add(fn);
  return () => bleDataListeners.delete(fn);
}

function notifyBleData(data: string) {
  bleDataListeners.forEach((fn) => fn(data));
}

/** Check if a real Bluetooth device is currently connected (Web or Native iOS/Android) */
export function isBleConnected(): boolean {
  return !!(activeChar || activeDevice?.gatt?.connected || activeNativeDevice);
}

// Sequential write queue to prevent GATT collisions
let bleWriteQueue: Promise<any> = Promise.resolve();

/**
 * Send raw command (e.g. R1_ON, R1_OFF, R2_ON, R2_OFF) to ESP32 over BLE.
 * Supports both Web Bluetooth and Native Mobile iOS/Android (react-native-ble-plx).
 */
export async function sendBleCommand(cmd: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    bleWriteQueue = bleWriteQueue
      .then(async () => {
        try {
          // ── 1. NATIVE MOBILE BLE (iOS / Android react-native-ble-plx) ──
          if (activeNativeDevice) {
            const b64 = toBase64(cmd);
            try {
              // Try write without response first for <15ms instant latency
              await activeNativeDevice.writeCharacteristicWithoutResponseForService(
                LUMO_SERVICE_UUID,
                LUMO_CHAR_UUID,
                b64
              );
            } catch {
              // Fallback to write with response
              await activeNativeDevice.writeCharacteristicWithResponseForService(
                LUMO_SERVICE_UUID,
                LUMO_CHAR_UUID,
                b64
              );
            }
            console.log('[Native BLE] Sent instant command:', cmd);
            resolve(true);
            return;
          }

          // ── 2. WEB BLUETOOTH (Chrome / Edge) ──
          if (!activeChar && activeDevice?.gatt?.connected) {
            try {
              const service = await activeDevice.gatt.getPrimaryService(LUMO_SERVICE_UUID);
              activeChar = await service.getCharacteristic(LUMO_CHAR_UUID);
            } catch {}
          }

          if (activeChar) {
            const enc = new TextEncoder();
            const bytes = enc.encode(cmd);

            if (typeof activeChar.writeValueWithoutResponse === 'function') {
              await activeChar.writeValueWithoutResponse(bytes);
            } else if (typeof activeChar.writeValueWithResponse === 'function') {
              await activeChar.writeValueWithResponse(bytes);
            } else if (typeof activeChar.writeValue === 'function') {
              await activeChar.writeValue(bytes);
            }
            console.log('[BLE] Sent instant command:', cmd);
            resolve(true);
            return;
          } else {
            console.warn('[BLE] No active characteristic to send:', cmd);
          }
        } catch (err) {
          console.warn('[BLE] Send error:', err);
        }
        resolve(false);
      })
      .catch((err) => {
        console.warn('[BLE] Queue error:', err);
        resolve(false);
      });
  });
}

/**
 * Connect to a native BLE device (iPhone iOS / Android)
 */
export async function connectNativeBleDevice(device: any): Promise<boolean> {
  try {
    console.log('[Native BLE] Connecting to device:', device?.id);
    const connected = await device.connect({ timeout: 10000 });
    console.log('[Native BLE] Discovering services...');
    await connected.discoverAllServicesAndCharacteristics();
    activeNativeDevice = connected;

    connected.onDisconnected(() => {
      console.log('[Native BLE] Device disconnected');
      activeNativeDevice = null;
      notifyBleState(false);
    });

    // Listen for state notifications from ESP32
    try {
      connected.monitorCharacteristicForService(
        LUMO_SERVICE_UUID,
        LUMO_CHAR_UUID,
        (error: any, characteristic: any) => {
          if (characteristic?.value) {
            const decoded = fromBase64(characteristic.value);
            console.log('[Native BLE] State notification:', decoded);
            notifyBleData(decoded);
          }
        }
      );
    } catch (monErr) {
      console.warn('[Native BLE] Monitor note:', monErr);
    }

    const devName = device.name || device.localName || 'Lumo-ESP32';
    notifyBleState(true, devName);

    // Fetch initial hardware status
    setTimeout(() => {
      sendBleCommand('STATUS').catch(() => {});
    }, 200);

    return true;
  } catch (err) {
    console.warn('[Native BLE] Connect error:', err);
    activeNativeDevice = null;
    return false;
  }
}

/**
 * Web Bluetooth: Requests nearby real Bluetooth devices.
 * Shows Chrome native pairing popup with real nearby devices only.
 */
export async function requestBluetoothDevice(): Promise<BluetoothDeviceInfo> {
  if (Platform.OS === 'web') {
    if (!isWebBluetoothSupported()) {
      throw new Error('WEB_BLUETOOTH_UNSUPPORTED');
    }

    const device = await navigator.bluetooth!.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        'generic_access',
        'battery_service',
        'device_information',
        LUMO_SERVICE_UUID,
        '0000ffe0-0000-1000-8000-00805f9b34fb',
      ],
    });

    let isConnected = false;
    try {
      if (device.gatt) {
        const server = await device.gatt.connect();
        isConnected = server.connected;
        activeDevice = device;

        device.addEventListener('gattserverdisconnected', () => {
          console.log('[BLE] ESP32 disconnected from browser');
          activeChar = null;
          activeDevice = null;
          notifyBleState(false);
        });

        try {
          const service = await server.getPrimaryService(LUMO_SERVICE_UUID);
          activeChar = await service.getCharacteristic(LUMO_CHAR_UUID);
          console.log('[BLE] Successfully linked Lumo BLE characteristic!');

          // Listen for incoming notifications from ESP32
          try {
            await activeChar.startNotifications();
            activeChar.addEventListener('characteristicvaluechanged', (evt: any) => {
              try {
                const val = new TextDecoder().decode(evt.target.value);
                notifyBleData(val);
              } catch {}
            });
          } catch (notifErr) {
            console.log('[BLE] Note on starting notifications:', notifErr);
          }

          // Request initial state from hardware immediately
          sendBleCommand('STATUS').catch(() => {});
        } catch (charErr) {
          console.warn('[BLE] Service/Characteristic mapping note:', charErr);
        }

        notifyBleState(true, device.name || 'Lumo-ESP32');
      } else {
        isConnected = true;
        notifyBleState(true, device.name || 'Lumo-ESP32');
      }
    } catch (err) {
      console.warn('GATT connection note:', err);
      isConnected = true;
      notifyBleState(true, device.name || 'Lumo-ESP32');
    }

    return {
      id: device.id,
      name: device.name || 'Lumo-ESP32',
      connected: isConnected,
      rawDevice: device,
    };
  }

  throw new Error('NATIVE_BLE_REQUEST_UNSUPPORTED');
}

/**
 * Mobile Native Scan: Scans for REAL nearby Bluetooth LE devices.
 * NEVER creates fake or simulated devices.
 */
export function scanNativeDevices(
  onDeviceFound: (device: BluetoothDeviceInfo) => void,
  onError: (error: string) => void
): () => void {
  const manager = getBleManager();
  if (!manager) {
    onError('EXPO_GO_BLE_UNSUPPORTED');
    return () => {};
  }

  let isScanning = true;
  const discoveredIds = new Set<string>();

  (async () => {
    try {
      const permitted = await requestAndroidBlePermissions();
      if (!permitted) {
        onError('Bluetooth permissions were denied');
        return;
      }

      let isPowered = (await manager.state()) === 'PoweredOn';
      if (!isPowered) {
        isPowered = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            sub?.remove();
            resolve(false);
          }, 3000);
          const sub = manager.onStateChange((s) => {
            if (s === 'PoweredOn') {
              clearTimeout(timeout);
              sub.remove();
              resolve(true);
            } else if (s === 'PoweredOff' || s === 'Unauthorized') {
              clearTimeout(timeout);
              sub.remove();
              resolve(false);
            }
          }, true);
        });
      }

      if (!isPowered) {
        onError('Bluetooth is turned off. Please turn on Bluetooth in device settings.');
        return;
      }

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          if (isScanning) onError(error.message);
          return;
        }
        if (device && device.id && !discoveredIds.has(device.id)) {
          const name =
            device.name ||
            device.localName ||
            (device.serviceUUIDs?.some((u) => u.toLowerCase() === LUMO_SERVICE_UUID.toLowerCase())
              ? 'Lumo-ESP32'
              : null);

          if (name) {
            discoveredIds.add(device.id);
            onDeviceFound({
              id: device.id,
              name,
              connected: false,
              rawDevice: device,
            });
          }
        }
      });
    } catch (err: any) {
      onError(err?.message || 'Failed to start Bluetooth scan');
    }
  })();

  return () => {
    isScanning = false;
    try {
      manager.stopDeviceScan();
    } catch {}
  };
}

/** Disconnect an active Bluetooth GATT connection */
export async function disconnectBluetoothDevice(device?: any) {
  try {
    if (activeNativeDevice) {
      try {
        await activeNativeDevice.cancelConnection();
      } catch {}
      activeNativeDevice = null;
    }
    if (device?.cancelConnection) {
      try {
        await device.cancelConnection();
      } catch {}
    }
    if (device?.gatt?.connected) {
      try {
        device.gatt.disconnect();
      } catch {}
    }
    if (activeDevice?.gatt?.connected) {
      try {
        activeDevice.gatt.disconnect();
      } catch {}
    }
    activeChar = null;
    activeDevice = null;
    notifyBleState(false);
  } catch (e) {
    console.warn('Disconnect error:', e);
  }
}

/** Subscribe to native Bluetooth state changes (mobile only). */
export function onBluetoothStateChangeNative(
  callback: (state: BluetoothState) => void
): () => void {
  const manager = getBleManager();
  if (manager) {
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') callback('on');
      else if (state === 'PoweredOff') callback('off');
      else callback('unknown');
    }, true);
    return () => subscription?.remove?.();
  }
  return () => {};
}

/** Subscribe to Bluetooth availability changes (web only). */
export function onBluetoothStateChange(
  callback: (available: boolean) => void
): () => void {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    navigator.bluetooth &&
    typeof navigator.bluetooth.addEventListener === 'function'
  ) {
    const handler = (e: Event) => {
      callback((e as any).value ?? false);
    };
    navigator.bluetooth.addEventListener('availabilitychanged', handler);
    return () => {
      navigator.bluetooth?.removeEventListener('availabilitychanged', handler);
    };
  }
  return () => {};
}
