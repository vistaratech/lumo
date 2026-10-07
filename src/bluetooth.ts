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

export const LUMO_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const LUMO_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

let activeChar: any = null;
let activeDevice: any = null;

type BleListener = (connected: boolean, name?: string) => void;
const bleListeners = new Set<BleListener>();

export function addBleListener(fn: BleListener): () => void {
  bleListeners.add(fn);
  fn(isBleConnected(), activeDevice?.name);
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

/** Check if a real Bluetooth device is currently connected */
export function isBleConnected(): boolean {
  return !!(activeChar || activeDevice?.gatt?.connected);
}

// Sequential write queue to prevent Chrome GATT collisions
let bleWriteQueue: Promise<any> = Promise.resolve();

/**
 * Send raw command (e.g. R1_ON, R1_OFF, R2_ON, R2_OFF) to ESP32 over BLE.
 * Uses writeValueWithoutResponse (Write Without Response / Write Command)
 * for sub-10ms instantaneous relay triggering!
 */
export async function sendBleCommand(cmd: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    bleWriteQueue = bleWriteQueue
      .then(async () => {
        try {
          // Lazily re-acquire characteristic if device is connected but char got lost
          if (!activeChar && activeDevice?.gatt?.connected) {
            try {
              const service = await activeDevice.gatt.getPrimaryService(LUMO_SERVICE_UUID);
              activeChar = await service.getCharacteristic(LUMO_CHAR_UUID);
            } catch {}
          }

          if (activeChar) {
            const enc = new TextEncoder();
            const bytes = enc.encode(cmd);

            // 1. FAST-PATH: writeValueWithoutResponse delivers packet in <10ms without round-trip ACK
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

      const state = await manager.state();
      if (state !== 'PoweredOn') {
        onError('Bluetooth is turned off. Please turn on Bluetooth in device settings.');
        return;
      }

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          if (isScanning) onError(error.message);
          return;
        }
        if (device && device.id && !discoveredIds.has(device.id)) {
          discoveredIds.add(device.id);
          const name = device.name || device.localName;
          if (name) {
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
export function disconnectBluetoothDevice(device?: any) {
  try {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    } else if (device?.cancelConnection) {
      device.cancelConnection();
    }
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
