/**
 * ============================================================================
 * Lumo Smart Home Hub — Dual Bluetooth BLE + Wi-Fi/MQTT Relay Controller
 * Hardware: ESP32 / ESP32-C3 / ESP32-S3 + Multi-Channel Relay Module (1-16 CH)
 *
 * Supported Models:
 *   LUMO R1 (1 CH), LUMO R2 (2 CH), LUMO R3 (3 CH), LUMO R4 (4 CH),
 *   LUMO R6 (6 CH), LUMO R8 (8 CH), LUMO R12 (12 CH), LUMO R16 (16 CH)
 * 
 * Features:
 *   1. Bluetooth Low Energy (BLE) with name "Lumo-ESP32"
 *      - Direct local control from Chrome browser (Web Bluetooth) or Phone App
 *      - Dynamic Channel Announcement ("CONFIG:CHANNELS:<count>")
 *      - In-app Non-Blocking Wi-Fi Provisioning (scans & connects nearby 2.4GHz)
 *      - UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *      - Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26a8
 *      - Negotiated 517-byte MTU for fast, complete network packet transfer
 *   2. Wi-Fi + Cloud MQTT (broker.emqx.io / HiveMQ Cloud)
 *      - Worldwide control from SIM Mobile Data (4G/5G) or any remote Wi-Fi
 *      - Dynamic MQTT topics: home/esp32/relay1/set ... home/esp32/relay{N}/set
 *      - Wi-Fi credentials stored permanently in Flash memory (NVS Preferences)
 *      - Non-blocking (Bluetooth works even if Wi-Fi is disconnected)
 *   3. On-board hardware countdown timers that finish on the chip
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Hardware Configuration (Change NUM_CHANNELS to match your board!) ──────
// Set to 1, 2, 3, 4, 6, 8, 12, or 16
#define NUM_CHANNELS        2

// Pin definitions for up to 16 relays (customize GPIOs for your specific ESP32 board):
// Default mapping covers ESP32 DevKit and ESP32-C3
const int RELAY_PINS[16] = {2, 3, 4, 5, 12, 13, 14, 15, 18, 19, 21, 22, 23, 25, 26, 27};
const int LED_PIN        = 8;        // ESP32-C3 Super Mini on-board LED (or GPIO 2 on classic ESP32)
const bool ACTIVE_LOW    = true;     // Most relay boards: LOW = ON, HIGH = OFF
const bool LED_ACTIVE_LOW = true;    // ESP32-C3 LED is active LOW

// ── BLE UUIDs (Must match Mobile / Web App) ───────────────────────────────
#define BLE_DEVICE_NAME     "Lumo-ESP32"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ── Default Cloud MQTT Broker ─────────────────────────────────────────────
const char* DEFAULT_MQTT_HOST = "broker.emqx.io";
const uint16_t DEFAULT_MQTT_PORT = 1883;

// ── MQTT Topics ───────────────────────────────────────────────────────────
const char* TOPIC_STATUS = "home/esp32/status";

// ── Global State ──────────────────────────────────────────────────────────
bool relayOn[16] = {false};
bool timerOn[16] = {false};
unsigned long offAt[16] = {0};
unsigned long lastTick = 0;
unsigned long lastWifiCheck = 0;
unsigned long wifiConnectStart = 0;
bool isConnectingWifi = false;
bool wifiWasConnected = false;

// Async Wi-Fi Scanning Flags (Non-blocking so BLE never drops)
bool scanWifiRequested = false;
bool isScanningWifi = false;
unsigned long scanWifiStart = 0;

// NVS Persistent Storage
Preferences prefs;
String savedSsid = "";
String savedPass = "";

// BLE Globals
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool bleClientConnected = false;
bool oldBleClientConnected = false;

// Network Globals
WiFiClient netClient;
PubSubClient mqtt(netClient);

// ── Helper: Apply Relay Physical Output ───────────────────────────────────
void applyRelay(int i) {
  if (i < 0 || i >= NUM_CHANNELS) return;
  bool level = ACTIVE_LOW ? !relayOn[i] : relayOn[i];
  digitalWrite(RELAY_PINS[i], level ? HIGH : LOW);
}

// ── Helper: Format Relay Status String for BLE (e.g. R1:0,R2:1,R3:0...) ───
String getStatusString() {
  String res = "";
  for (int i = 0; i < NUM_CHANNELS; i++) {
    if (i > 0) res += ",";
    res += "R" + String(i + 1) + ":" + String(relayOn[i] ? "1" : "0");
  }
  return res;
}

// ── Helper: Format Wi-Fi Status String for BLE ────────────────────────────
String getWifiStatusString() {
  if (WiFi.status() == WL_CONNECTED) {
    return "WIFI_STATE:CONNECTED:" + WiFi.localIP().toString() + ":" + savedSsid;
  } else if (isConnectingWifi) {
    return "WIFI_STATE:CONNECTING:" + savedSsid;
  } else if (savedSsid.length() > 0) {
    return "WIFI_STATE:DISCONNECTED:" + savedSsid;
  } else {
    return "WIFI_STATE:DISCONNECTED";
  }
}

// ── Helper: Notify BLE Client ─────────────────────────────────────────────
void notifyBle(String msg) {
  if (pCharacteristic && bleClientConnected) {
    pCharacteristic->setValue(msg.c_str());
    pCharacteristic->notify();
    Serial.println("[BLE] Notified: " + msg);
  }
}

// ── Helper: Publish State over BLE and MQTT ───────────────────────────────
void publishState(int i) {
  if (i < 0 || i >= NUM_CHANNELS) return;

  // 1. MQTT publish (if connected)
  if (mqtt.connected()) {
    String stateTopic = "home/esp32/relay" + String(i + 1) + "/state";
    mqtt.publish(stateTopic.c_str(), relayOn[i] ? "ON" : "OFF", true);
  }

  // 2. BLE notify
  notifyBle(getStatusString());
}

// ── Helper: Publish Timer Countdown ───────────────────────────────────────
void publishTimer(int i) {
  if (i < 0 || i >= NUM_CHANNELS) return;
  long left = 0;
  if (timerOn[i]) {
    long ms = (long)(offAt[i] - millis());
    left = ms > 0 ? (ms + 999) / 1000 : 0;
  }
  char buf[12];
  snprintf(buf, sizeof(buf), "%ld", left);

  if (mqtt.connected()) {
    String timerTopic = "home/esp32/relay" + String(i + 1) + "/timer";
    mqtt.publish(timerTopic.c_str(), buf, true);
  }
}

void cancelTimer(int i) {
  if (i < 0 || i >= NUM_CHANNELS) return;
  if (!timerOn[i]) return;
  timerOn[i] = false;
  publishTimer(i);
}

// ── Start Connecting to Wi-Fi ─────────────────────────────────────────────
void startWifiConnection(String ssid, String pass) {
  savedSsid = ssid;
  savedPass = pass;
  isConnectingWifi = true;
  wifiWasConnected = false;
  wifiConnectStart = millis();

  WiFi.disconnect();
  delay(60);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(savedSsid.c_str(), savedPass.c_str());
  Serial.println("[WiFi] Connecting to: " + savedSsid);
  notifyBle("WIFI_STATE:CONNECTING:" + savedSsid);
}

// ── Non-Blocking Wi-Fi Scan Handler (Called in loop()) ────────────────────
void handleWifiScan() {
  if (scanWifiRequested) {
    scanWifiRequested = false;

    if (isScanningWifi) return;

    if (isConnectingWifi) {
      WiFi.disconnect();
      isConnectingWifi = false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.scanDelete();

    Serial.println("[WiFi] Starting non-blocking 2.4 GHz scan...");
    int16_t res = WiFi.scanNetworks(true, false);
    if (res == WIFI_SCAN_RUNNING) {
      isScanningWifi = true;
      scanWifiStart = millis();
    } else {
      Serial.printf("[WiFi] Scan start error: %d\n", res);
      notifyBle("WIFI_SCAN_EMPTY");
    }
  }

  if (isScanningWifi) {
    int16_t n = WiFi.scanComplete();

    if (n >= 0) {
      isScanningWifi = false;
      Serial.printf("[WiFi] Scan complete! Found %d networks\n", n);

      if (n == 0) {
        notifyBle("WIFI_SCAN_EMPTY");
      } else {
        String reported[25];
        int reportedCount = 0;

        for (int i = 0; i < n && reportedCount < 20; i++) {
          String netSsid = WiFi.SSID(i);
          netSsid.trim();
          if (netSsid.length() == 0) continue;

          bool alreadyReported = false;
          for (int j = 0; j < reportedCount; j++) {
            if (reported[j] == netSsid) {
              alreadyReported = true;
              break;
            }
          }
          if (alreadyReported) continue;

          reported[reportedCount++] = netSsid;
          int rssi = WiFi.RSSI(i);
          bool locked = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);

          String netMsg = "WIFI_NET:" + netSsid + ":" + String(rssi) + ":" + (locked ? "1" : "0");
          delay(35);
          notifyBle(netMsg);
        }

        delay(35);
        notifyBle("WIFI_SCAN_END");
      }

      WiFi.scanDelete();

      if (savedSsid.length() > 0 && WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Resuming connection to " + savedSsid);
        WiFi.begin(savedSsid.c_str(), savedPass.c_str());
        isConnectingWifi = true;
        wifiConnectStart = millis();
      }
    } else if (n == WIFI_SCAN_FAILED || (millis() - scanWifiStart > 12000)) {
      isScanningWifi = false;
      Serial.println("[WiFi] Scan failed or timed out");
      notifyBle("WIFI_SCAN_EMPTY");
      WiFi.scanDelete();

      if (savedSsid.length() > 0 && WiFi.status() != WL_CONNECTED) {
        WiFi.begin(savedSsid.c_str(), savedPass.c_str());
        isConnectingWifi = true;
        wifiConnectStart = millis();
      }
    }
  }
}

// ── Central Command Handler (Called by BLE and MQTT) ──────────────────────
void processCommand(String rawCmd) {
  rawCmd.trim();
  String cmd = rawCmd;
  cmd.toUpperCase();

  // ── Wi-Fi Configuration Commands ──
  if (cmd == "SCAN_WIFI") {
    scanWifiRequested = true;
    Serial.println("[WiFi] Scan requested by client");
    return;
  }
  else if (rawCmd.startsWith("SET_WIFI:") || rawCmd.startsWith("set_wifi:")) {
    int firstColon = rawCmd.indexOf(':');
    int secondColon = rawCmd.indexOf(':', firstColon + 1);
    if (firstColon != -1 && secondColon != -1) {
      String newSsid = rawCmd.substring(firstColon + 1, secondColon);
      String newPass = rawCmd.substring(secondColon + 1);
      newSsid.trim();
      newPass.trim();
      
      prefs.putString("ssid", newSsid);
      prefs.putString("pass", newPass);
      Serial.println("[WiFi] Saved new credentials in Flash: " + newSsid);
      
      startWifiConnection(newSsid, newPass);
    }
    return;
  }
  else if (cmd == "GET_WIFI") {
    notifyBle(getWifiStatusString());
    return;
  }
  else if (cmd == "CLEAR_WIFI") {
    prefs.remove("ssid");
    prefs.remove("pass");
    savedSsid = "";
    savedPass = "";
    isConnectingWifi = false;
    wifiWasConnected = false;
    WiFi.disconnect(true);
    Serial.println("[WiFi] Credentials cleared from Flash");
    notifyBle("WIFI_STATE:CLEARED");
    return;
  }

  // ── Generic Multi-Channel Relay Commands (R<id>_ON, R<id>_OFF, R<id>_TOGGLE, R<id>:1, R<id>:0) ──
  if (cmd.startsWith("R")) {
    int underscore = cmd.indexOf('_');
    int colon = cmd.indexOf(':');
    int splitIdx = (underscore != -1) ? underscore : colon;
    if (splitIdx != -1) {
      int ch = cmd.substring(1, splitIdx).toInt();
      if (ch >= 1 && ch <= NUM_CHANNELS) {
        String action = cmd.substring(splitIdx + 1);
        int idx = ch - 1;
        if (action == "ON" || action == "1") {
          relayOn[idx] = true;
        } else if (action == "OFF" || action == "0") {
          relayOn[idx] = false;
        } else if (action == "TOGGLE") {
          relayOn[idx] = !relayOn[idx];
        }
        applyRelay(idx);
        cancelTimer(idx);
        publishState(idx);
        return;
      }
    }
  }

  // Number:State format (e.g. "1:ON", "2:OFF")
  int numColon = cmd.indexOf(':');
  if (numColon != -1) {
    int ch = cmd.substring(0, numColon).toInt();
    if (ch >= 1 && ch <= NUM_CHANNELS) {
      String action = cmd.substring(numColon + 1);
      int idx = ch - 1;
      if (action == "ON" || action == "1") {
        relayOn[idx] = true;
      } else if (action == "OFF" || action == "0") {
        relayOn[idx] = false;
      }
      applyRelay(idx);
      cancelTimer(idx);
      publishState(idx);
      return;
    }
  }

  // All On / All Off
  if (cmd == "ALL_ON") {
    for (int i = 0; i < NUM_CHANNELS; i++) {
      relayOn[i] = true;
      applyRelay(i);
      cancelTimer(i);
    }
    for (int i = 0; i < NUM_CHANNELS; i++) publishState(i);
    return;
  } else if (cmd == "ALL_OFF") {
    for (int i = 0; i < NUM_CHANNELS; i++) {
      relayOn[i] = false;
      applyRelay(i);
      cancelTimer(i);
    }
    for (int i = 0; i < NUM_CHANNELS; i++) publishState(i);
    return;
  }

  // Status & Hardware Identification Query
  if (cmd == "STATUS" || cmd == "GET" || cmd == "IDENTIFY" || cmd == "GET_CONFIG") {
    notifyBle("CONFIG:CHANNELS:" + String(NUM_CHANNELS));
    delay(40);
    notifyBle(getStatusString());
    return;
  }

  // Timer Command: "TIMER:<channel>:<minutes>"
  if (cmd.startsWith("TIMER:")) {
    int c1 = cmd.indexOf(':');
    int c2 = cmd.indexOf(':', c1 + 1);
    if (c1 != -1 && c2 != -1) {
      int ch = cmd.substring(c1 + 1, c2).toInt();
      long mins = cmd.substring(c2 + 1).toInt();
      if (ch >= 1 && ch <= NUM_CHANNELS) {
        int idx = ch - 1;
        if (mins > 0) {
          relayOn[idx] = true;
          applyRelay(idx);
          publishState(idx);
          timerOn[idx] = true;
          offAt[idx] = millis() + (unsigned long)mins * 60000UL;
          publishTimer(idx);
        } else {
          cancelTimer(idx);
        }
      }
    }
    return;
  }

  Serial.println("[CMD] Unrecognized command: " + rawCmd);
}

// ── BLE Server Callbacks ──────────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleClientConnected = true;
    digitalWrite(LED_PIN, LED_ACTIVE_LOW ? LOW : HIGH);
    Serial.println("[BLE] Client connected!");
    
    // Announce dynamic channel count, initial status and Wi-Fi state
    delay(100);
    notifyBle("CONFIG:CHANNELS:" + String(NUM_CHANNELS));
    delay(100);
    notifyBle(getStatusString());
    delay(100);
    notifyBle(getWifiStatusString());
  }

  void onDisconnect(BLEServer* pServer) override {
    bleClientConnected = false;
    digitalWrite(LED_PIN, LED_ACTIVE_LOW ? HIGH : LOW);
    Serial.println("[BLE] Client disconnected!");
  }
};

// ── BLE Characteristic Callbacks ──────────────────────────────────────────
class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String value = pChar->getValue().c_str();
    if (value.length() > 0) {
      processCommand(value);
    }
  }
};

// ── Initialize Bluetooth Low Energy ───────────────────────────────────────
void setupBLE() {
  Serial.println("[BLE] Initializing Bluetooth LE: " BLE_DEVICE_NAME " ...");

  BLEDevice::init(BLE_DEVICE_NAME);
  BLEDevice::setMTU(517);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ     |
    BLECharacteristic::PROPERTY_WRITE    |
    BLECharacteristic::PROPERTY_WRITE_NR |
    BLECharacteristic::PROPERTY_NOTIFY   |
    BLECharacteristic::PROPERTY_INDICATE
  );

  pCharacteristic->addDescriptor(new BLE2902());
  pCharacteristic->setCallbacks(new CharacteristicCallbacks());
  pCharacteristic->setValue(getStatusString().c_str());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x0C);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising ready! Search for: " BLE_DEVICE_NAME);
}

// ── MQTT Message Callback ─────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  String t = topic;
  String body = "";
  for (unsigned int k = 0; k < len; k++) body += (char)payload[k];

  for (int i = 0; i < NUM_CHANNELS; i++) {
    String setTopic = "home/esp32/relay" + String(i + 1) + "/set";
    String timerTopic = "home/esp32/relay" + String(i + 1) + "/timer/set";

    if (t == setTopic) {
      relayOn[i] = (body == "ON");
      applyRelay(i);
      publishState(i);
      if (!relayOn[i]) cancelTimer(i);
    } else if (t == timerTopic) {
      long minutes = body.toInt();
      if (minutes > 0) {
        relayOn[i] = true;
        applyRelay(i);
        publishState(i);
        timerOn[i] = true;
        offAt[i] = millis() + (unsigned long)minutes * 60000UL;
        publishTimer(i);
      } else {
        cancelTimer(i);
      }
    }
  }
}

// ── Non-Blocking Wi-Fi & MQTT Loop ────────────────────────────────────────
void checkWifiAndMqtt() {
  if (isScanningWifi || scanWifiRequested) return;
  if (savedSsid.length() == 0) return;

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      isConnectingWifi = false;
      Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
      notifyBle(getWifiStatusString());
    }
  } else {
    wifiWasConnected = false;
    if (isConnectingWifi && millis() - wifiConnectStart > 18000) {
      isConnectingWifi = false;
      Serial.println("[WiFi] Connection timed out");
      notifyBle("WIFI_STATE:FAILED");
    }

    if (!isConnectingWifi && millis() - lastWifiCheck > 25000) {
      lastWifiCheck = millis();
      Serial.println("[WiFi] Re-attempting Wi-Fi connection to: " + savedSsid);
      isConnectingWifi = true;
      wifiConnectStart = millis();
      WiFi.begin(savedSsid.c_str(), savedPass.c_str());
      notifyBle("WIFI_STATE:CONNECTING:" + savedSsid);
    }
    return;
  }

  if (!mqtt.connected()) {
    static unsigned long lastMqttAttempt = 0;
    if (millis() - lastMqttAttempt > 6000) {
      lastMqttAttempt = millis();
      Serial.println("[MQTT] Connecting to cloud broker: " + String(DEFAULT_MQTT_HOST));
      String id = "lumo-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);

      if (mqtt.connect(id.c_str(), TOPIC_STATUS, 1, true, "offline")) {
        Serial.println("[MQTT] Connected to Cloud Broker successfully!");
        mqtt.publish(TOPIC_STATUS, "online", true);
        for (int i = 0; i < NUM_CHANNELS; i++) {
          String setTopic = "home/esp32/relay" + String(i + 1) + "/set";
          String timerTopic = "home/esp32/relay" + String(i + 1) + "/timer/set";
          mqtt.subscribe(setTopic.c_str(), 1);
          mqtt.subscribe(timerTopic.c_str(), 1);
          publishState(i);
          publishTimer(i);
        }
      } else {
        Serial.println("[MQTT] Connect failed, rc=" + String(mqtt.state()));
      }
    }
  } else {
    mqtt.loop();
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  delay(100);

  Serial.println("\n========================================");
  Serial.println("  LUMO SMART HUB — ESP32 CONTROLLER     ");
  Serial.printf ("  Configured Channels: %d Relays\n", NUM_CHANNELS);
  Serial.println("========================================");

  // Initialize Relay Output Pins
  for (int i = 0; i < NUM_CHANNELS; i++) {
    applyRelay(i);
    pinMode(RELAY_PINS[i], OUTPUT);
    applyRelay(i);
  }

  // Initialize LED Pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_ACTIVE_LOW ? HIGH : LOW);

  // Initialize NVS storage
  prefs.begin("lumo_cfg", false);
  savedSsid = prefs.getString("ssid", "");
  savedPass = prefs.getString("pass", "");

  // Initialize Bluetooth Low Energy
  setupBLE();

  // Setup MQTT Client
  mqtt.setServer(DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  if (savedSsid.length() > 0) {
    Serial.println("[WiFi] Found saved network in Flash: " + savedSsid);
    startWifiConnection(savedSsid, savedPass);
  } else {
    Serial.println("[WiFi] No saved Wi-Fi found. Ready for in-app configuration over BLE.");
  }

  Serial.println("[LUMO] Setup complete! Device is ready.");
}

// ── Main Loop ─────────────────────────────────────────────────────────────
void loop() {
  // 1. BLE Advertising restart on disconnect
  if (!bleClientConnected && oldBleClientConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldBleClientConnected = bleClientConnected;
  }
  if (bleClientConnected && !oldBleClientConnected) {
    oldBleClientConnected = bleClientConnected;
  }

  // 2. Hardware Timer Countdown on chip
  for (int i = 0; i < NUM_CHANNELS; i++) {
    if (timerOn[i] && (long)(millis() - offAt[i]) >= 0) {
      Serial.println("[TIMER] Relay " + String(i + 1) + " finished. Turning OFF.");
      relayOn[i] = false;
      applyRelay(i);
      publishState(i);
      timerOn[i] = false;
      publishTimer(i);
    }
  }

  // 3. Periodic countdown sync every 10 seconds
  if (millis() - lastTick >= 10000) {
    lastTick = millis();
    for (int i = 0; i < NUM_CHANNELS; i++) {
      if (timerOn[i]) publishTimer(i);
    }
  }

  // 4. Non-blocking Wi-Fi scan handler
  handleWifiScan();

  // 5. Non-blocking Wi-Fi & Cloud MQTT handling
  checkWifiAndMqtt();

  delay(1);
}
