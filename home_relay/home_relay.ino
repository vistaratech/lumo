/**
 * ============================================================================
 * Lumo Smart Home Hub — Dual Bluetooth BLE + Wi-Fi/MQTT Relay Controller
 * Hardware: ESP32-C3 Super Mini + 2-Channel Relay Module
 * 
 * Features:
 *   1. Bluetooth Low Energy (BLE) with name "Lumo-ESP32"
 *      - Direct local control from Chrome browser (Web Bluetooth) or Phone App
 *      - In-app Non-Blocking Wi-Fi Provisioning (scans & connects nearby 2.4GHz)
 *      - UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *      - Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26a8
 *      - Negotiated 517-byte MTU for fast, complete network packet transfer
 *   2. Wi-Fi + Cloud MQTT (broker.emqx.io / HiveMQ Cloud)
 *      - Worldwide control from SIM Mobile Data (4G/5G) or any remote Wi-Fi
 *      - Wi-Fi credentials stored permanently in Flash memory (NVS Preferences)
 *      - Non-blocking (Bluetooth works even if Wi-Fi is disconnected)
 *   3. On-board hardware countdown timers that finish on the chip
 *
 * Pinout:
 *   IN1 (Relay 1) -> GPIO 2
 *   IN2 (Relay 2) -> GPIO 3
 *   VCC           -> 5V / 3.3V
 *   GND           -> GND
 *   LED (Optional)-> GPIO 8 (On-board blue LED on ESP32-C3 Super Mini)
 *
 * Arduino IDE Settings:
 *   Board: "ESP32C3 Dev Module" (or "Nologo ESP32C3 Super Mini")
 *   USB CDC On Boot: "Enabled"
 *   Partition Scheme: "Huge APP (3MB No OTA/1MB SPIFFS)"
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Hardware Pins ─────────────────────────────────────────────────────────
const int RELAY_PIN[2] = {2, 3};   // IN1 -> GPIO2, IN2 -> GPIO3
const int LED_PIN      = 8;        // ESP32-C3 Super Mini on-board LED
const bool ACTIVE_LOW  = true;     // Most relay boards: LOW = ON, HIGH = OFF
const bool LED_ACTIVE_LOW = true;  // ESP32-C3 Super Mini LED is active LOW

// ── BLE UUIDs (Must match Mobile / Web App) ───────────────────────────────
#define BLE_DEVICE_NAME     "Lumo-ESP32"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ── Default Cloud MQTT Broker (Free, fast public cluster with WSS support) 
const char* DEFAULT_MQTT_HOST = "broker.emqx.io";
const uint16_t DEFAULT_MQTT_PORT = 1883;

// ── MQTT Topics ───────────────────────────────────────────────────────────
const char* TOPIC_STATUS        = "home/esp32/status";
const char* TOPIC_SET[2]        = {"home/esp32/relay1/set",       "home/esp32/relay2/set"};
const char* TOPIC_STATE[2]      = {"home/esp32/relay1/state",     "home/esp32/relay2/state"};
const char* TOPIC_TIMER_SET[2]  = {"home/esp32/relay1/timer/set", "home/esp32/relay2/timer/set"};
const char* TOPIC_TIMER[2]      = {"home/esp32/relay1/timer",     "home/esp32/relay2/timer"};

// ── Global State ──────────────────────────────────────────────────────────
bool relayOn[2] = {false, false};
bool timerOn[2] = {false, false};
unsigned long offAt[2] = {0, 0};
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
  bool level = ACTIVE_LOW ? !relayOn[i] : relayOn[i];
  digitalWrite(RELAY_PIN[i], level ? HIGH : LOW);
}

// ── Helper: Format Relay Status String for BLE ────────────────────────────
String getStatusString() {
  return "R1:" + String(relayOn[0] ? "1" : "0") + ",R2:" + String(relayOn[1] ? "1" : "0");
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
  // 1. MQTT publish (if connected)
  if (mqtt.connected()) {
    mqtt.publish(TOPIC_STATE[i], relayOn[i] ? "ON" : "OFF", true);
  }

  // 2. BLE notify
  notifyBle(getStatusString());
}

// ── Helper: Publish Timer Countdown ───────────────────────────────────────
void publishTimer(int i) {
  long left = 0;
  if (timerOn[i]) {
    long ms = (long)(offAt[i] - millis());
    left = ms > 0 ? (ms + 999) / 1000 : 0;
  }
  char buf[12];
  snprintf(buf, sizeof(buf), "%ld", left);

  if (mqtt.connected()) {
    mqtt.publish(TOPIC_TIMER[i], buf, true);
  }
}

void cancelTimer(int i) {
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
  // 1. Start scan if requested
  if (scanWifiRequested) {
    scanWifiRequested = false;

    if (isScanningWifi) return; // Already scanning

    // Temporarily disconnect pending Wi-Fi connection attempt so channel scan succeeds
    if (isConnectingWifi) {
      WiFi.disconnect();
      isConnectingWifi = false;
    }

    WiFi.mode(WIFI_STA);
    WiFi.scanDelete(); // Free previous scan buffers

    Serial.println("[WiFi] Starting non-blocking 2.4 GHz scan...");
    int16_t res = WiFi.scanNetworks(true /* async */, false /* don't show hidden */);
    if (res == WIFI_SCAN_RUNNING) {
      isScanningWifi = true;
      scanWifiStart = millis();
    } else {
      Serial.printf("[WiFi] Scan start error: %d\n", res);
      notifyBle("WIFI_SCAN_EMPTY");
    }
  }

  // 2. Poll for async scan results
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

      // If we had a saved Wi-Fi and we are not connected, resume connection
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
      
      // Save permanently in NVS Flash
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

  // ── Relay Control Commands ──
  // Relay 1 Commands
  if (cmd == "R1_ON" || cmd == "1:ON" || cmd == "RELAY1:ON") {
    relayOn[0] = true;
    applyRelay(0);
    cancelTimer(0);
    publishState(0);
  } else if (cmd == "R1_OFF" || cmd == "1:OFF" || cmd == "RELAY1:OFF") {
    relayOn[0] = false;
    applyRelay(0);
    cancelTimer(0);
    publishState(0);
  } else if (cmd == "R1_TOGGLE") {
    relayOn[0] = !relayOn[0];
    applyRelay(0);
    cancelTimer(0);
    publishState(0);
  }
  // Relay 2 Commands
  else if (cmd == "R2_ON" || cmd == "2:ON" || cmd == "RELAY2:ON") {
    relayOn[1] = true;
    applyRelay(1);
    cancelTimer(1);
    publishState(1);
  } else if (cmd == "R2_OFF" || cmd == "2:OFF" || cmd == "RELAY2:OFF") {
    relayOn[1] = false;
    applyRelay(1);
    cancelTimer(1);
    publishState(1);
  } else if (cmd == "R2_TOGGLE") {
    relayOn[1] = !relayOn[1];
    applyRelay(1);
    cancelTimer(1);
    publishState(1);
  }
  // All On / All Off
  else if (cmd == "ALL_ON") {
    for (int i = 0; i < 2; i++) {
      relayOn[i] = true;
      applyRelay(i);
      cancelTimer(i);
      publishState(i);
    }
  } else if (cmd == "ALL_OFF") {
    for (int i = 0; i < 2; i++) {
      relayOn[i] = false;
      applyRelay(i);
      cancelTimer(i);
      publishState(i);
    }
  }
  // Status Query
  else if (cmd == "STATUS" || cmd == "GET") {
    notifyBle(getStatusString());
  }
  // Timers: e.g. "TIMER:1:15" (Relay 1 for 15 mins)
  else if (cmd.startsWith("TIMER:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);
    if (firstColon != -1 && secondColon != -1) {
      int relayIdx = cmd.substring(firstColon + 1, secondColon).toInt() - 1;
      int minutes = cmd.substring(secondColon + 1).toInt();
      if (relayIdx >= 0 && relayIdx < 2) {
        if (minutes > 0) {
          relayOn[relayIdx] = true;
          applyRelay(relayIdx);
          publishState(relayIdx);
          timerOn[relayIdx] = true;
          offAt[relayIdx] = millis() + (unsigned long)minutes * 60000UL;
          publishTimer(relayIdx);
        } else {
          cancelTimer(relayIdx);
        }
      }
    }
  }

  Serial.println("[CMD] " + cmd + " -> R1=" + String(relayOn[0]) + ", R2=" + String(relayOn[1]));
}

// ── BLE Server Callbacks ──────────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    bleClientConnected = true;
    digitalWrite(LED_PIN, LED_ACTIVE_LOW ? LOW : HIGH); // Turn LED ON
    Serial.println("[BLE] Client connected!");
    
    // Send initial status and Wi-Fi state immediately upon connect
    delay(100);
    notifyBle(getStatusString());
    delay(100);
    notifyBle(getWifiStatusString());
  }

  void onDisconnect(BLEServer* pServer) override {
    bleClientConnected = false;
    digitalWrite(LED_PIN, LED_ACTIVE_LOW ? HIGH : LOW); // Turn LED OFF
    Serial.println("[BLE] Client disconnected!");
  }
};

// ── BLE Characteristic Callbacks (Writes from Browser / App) ─────────────
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
  BLEDevice::setMTU(517); // Allow up to 512-byte ATT MTU for full Wi-Fi network & state packets

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

  // Fast advertising profile
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // 7.5ms min interval
  pAdvertising->setMaxPreferred(0x0C); // 15ms max interval
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising ready! Search for: " BLE_DEVICE_NAME);
}

// ── MQTT Message Callback ─────────────────────────────────────────────────
void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  String t = topic;
  String body = "";
  for (unsigned int k = 0; k < len; k++) body += (char)payload[k];

  for (int i = 0; i < 2; i++) {
    if (t == TOPIC_SET[i]) {
      relayOn[i] = (body == "ON");
      applyRelay(i);
      publishState(i);
      if (!relayOn[i]) cancelTimer(i);
    } else if (t == TOPIC_TIMER_SET[i]) {
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
  // If scan is currently running, don't interrupt RF channel scan
  if (isScanningWifi || scanWifiRequested) return;

  // If no saved Wi-Fi, do nothing
  if (savedSsid.length() == 0) return;

  // 1. Wi-Fi Status Check
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      isConnectingWifi = false;
      String ip = WiFi.localIP().toString();
      Serial.println("[WiFi] Connected! IP: " + ip);
      notifyBle("WIFI_STATE:CONNECTED:" + ip + ":" + savedSsid);
    }
  } else {
    if (wifiWasConnected) {
      wifiWasConnected = false;
      Serial.println("[WiFi] Lost connection to: " + savedSsid);
      notifyBle("WIFI_STATE:DISCONNECTED:" + savedSsid);
    }

    // If we were connecting and timed out after 20 seconds
    if (isConnectingWifi && millis() - wifiConnectStart > 20000) {
      isConnectingWifi = false;
      Serial.println("[WiFi] Connection failed / timed out for: " + savedSsid);
      notifyBle("WIFI_STATE:FAILED");
    }

    // Periodic Wi-Fi reconnect attempt every 25 seconds
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

  // 2. Cloud MQTT Client Connection (Worldwide remote control)
  if (!mqtt.connected()) {
    static unsigned long lastMqttAttempt = 0;
    if (millis() - lastMqttAttempt > 6000) {
      lastMqttAttempt = millis();
      Serial.println("[MQTT] Connecting to cloud broker: " + String(DEFAULT_MQTT_HOST));
      String id = "lumo-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);

      if (mqtt.connect(id.c_str(), TOPIC_STATUS, 1, true, "offline")) {
        Serial.println("[MQTT] Connected to Cloud Broker successfully!");
        mqtt.publish(TOPIC_STATUS, "online", true);
        for (int i = 0; i < 2; i++) {
          mqtt.subscribe(TOPIC_SET[i], 1);
          mqtt.subscribe(TOPIC_TIMER_SET[i], 1);
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
  Serial.setTxTimeoutMs(0); // Eliminates serial blocking when terminal is closed
  delay(100);

  Serial.println("\n========================================");
  Serial.println("  LUMO SMART HUB — ESP32-C3 SUPER MINI  ");
  Serial.println("========================================");

  // Initialize Relay Output Pins to OFF immediately (avoids startup clicks)
  for (int i = 0; i < 2; i++) {
    applyRelay(i);
    pinMode(RELAY_PIN[i], OUTPUT);
    applyRelay(i);
  }

  // Initialize LED Pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_ACTIVE_LOW ? HIGH : LOW); // LED OFF initially

  // Initialize Flash Preferences (NVS storage for Wi-Fi)
  prefs.begin("lumo_cfg", false);
  savedSsid = prefs.getString("ssid", "");
  savedPass = prefs.getString("pass", "");

  // Initialize Bluetooth Low Energy immediately
  setupBLE();

  // Setup MQTT Client
  mqtt.setServer(DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  // Start Wi-Fi if saved credentials exist
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
  for (int i = 0; i < 2; i++) {
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
    for (int i = 0; i < 2; i++) {
      if (timerOn[i]) publishTimer(i);
    }
  }

  // 4. Non-blocking Wi-Fi scan handler (so Bluetooth never disconnects during scan)
  handleWifiScan();

  // 5. Non-blocking Wi-Fi & Cloud MQTT handling
  checkWifiAndMqtt();

  delay(1);
}
