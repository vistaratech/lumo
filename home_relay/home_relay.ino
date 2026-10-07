/**
 * ============================================================================
 * Lumo Smart Home Hub — Dual Bluetooth BLE + WiFi/MQTT Relay Controller
 * Hardware: ESP32-C3 Super Mini + 2-Channel Relay Module
 * 
 * Features:
 *   1. Bluetooth Low Energy (BLE) with name "Lumo-ESP32"
 *      - Direct local control from Chrome browser (Web Bluetooth) or Phone App
 *      - UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *      - Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26a8
 *   2. WiFi + MQTT (HiveMQ Cloud) for worldwide cloud access
 *      - Non-blocking (Bluetooth works even if WiFi is not connected)
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
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ── Wi-Fi & MQTT Credentials (Optional for Cloud) ─────────────────────────
// Leave as empty strings ("") if you only want to use Bluetooth!
const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST = "YOUR-CLUSTER.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT = 8883;
const char* MQTT_USER = "YOUR_USER";
const char* MQTT_PASS = "YOUR_PASS";

// ── Hardware Pins ─────────────────────────────────────────────────────────
const int RELAY_PIN[2] = {2, 3};   // IN1 -> GPIO2, IN2 -> GPIO3
const int LED_PIN      = 8;        // ESP32-C3 Super Mini on-board LED
const bool ACTIVE_LOW  = true;     // Most relay boards: LOW = ON, HIGH = OFF
const bool LED_ACTIVE_LOW = true;  // ESP32-C3 Super Mini LED is active LOW

// ── BLE UUIDs (Must match the Web / Mobile App) ───────────────────────────
#define BLE_DEVICE_NAME     "Lumo-ESP32"
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

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

// BLE globals
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool bleClientConnected = false;
bool oldBleClientConnected = false;

// Network globals
WiFiClientSecure net;
PubSubClient mqtt(net);

// ── Helper: Apply Relay Physical Output ───────────────────────────────────
void applyRelay(int i) {
  bool level = ACTIVE_LOW ? !relayOn[i] : relayOn[i];
  digitalWrite(RELAY_PIN[i], level ? HIGH : LOW);
}

// ── Helper: Format Status String for BLE ──────────────────────────────────
String getStatusString() {
  return "R1:" + String(relayOn[0] ? "1" : "0") + ",R2:" + String(relayOn[1] ? "1" : "0");
}

// ── Helper: Publish State over BLE and MQTT ───────────────────────────────
void publishState(int i) {
  // 1. MQTT publish (if connected)
  if (mqtt.connected()) {
    mqtt.publish(TOPIC_STATE[i], relayOn[i] ? "ON" : "OFF", true);
  }

  // 2. BLE notify
  if (pCharacteristic && bleClientConnected) {
    String status = getStatusString();
    pCharacteristic->setValue(status.c_str());
    pCharacteristic->notify();
    Serial.println("[BLE] Notified state: " + status);
  }
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

// ── Central Command Handler (Called by BLE and MQTT) ──────────────────────
void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  // Fast Hardware Execution: applyRelay is executed immediately
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
    if (pCharacteristic && bleClientConnected) {
      String status = getStatusString();
      pCharacteristic->setValue(status.c_str());
      pCharacteristic->notify();
    }
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
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  // Added PROPERTY_WRITE_NR for instantaneous write-without-response from Web Bluetooth
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

  // Set initial value
  pCharacteristic->setValue(getStatusString().c_str());

  pService->start();

  // Start advertising with fast connection interval preference
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

// ── Non-Blocking Wi-Fi & MQTT Helpers ─────────────────────────────────────
void checkWifiAndMqtt() {
  // If Wi-Fi credentials are not set, skip network entirely
  if (String(WIFI_SSID) == "YOUR_WIFI" || String(WIFI_SSID).length() == 0) {
    return;
  }

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiCheck > 15000) {
      lastWifiCheck = millis();
      Serial.println("[WiFi] Connecting to: " + String(WIFI_SSID));
      WiFi.mode(WIFI_STA);
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      WiFi.setTxPower(WIFI_POWER_8_5dBm);
    }
    return;
  }

  // Check MQTT
  if (String(MQTT_HOST) == "YOUR-CLUSTER.s1.eu.hivemq.cloud" || String(MQTT_HOST).length() == 0) {
    return;
  }

  if (!mqtt.connected()) {
    static unsigned long lastMqttAttempt = 0;
    if (millis() - lastMqttAttempt > 6000) {
      lastMqttAttempt = millis();
      Serial.println("[MQTT] Connecting to broker...");
      String id = "esp32-lumo-" + String((uint32_t)ESP.getEfuseMac(), HEX);
      if (mqtt.connect(id.c_str(), MQTT_USER, MQTT_PASS, TOPIC_STATUS, 1, true, "offline")) {
        Serial.println("[MQTT] Connected to HiveMQ Cloud!");
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
  Serial.setTxTimeoutMs(0); // Eliminates any serial blocking when terminal is closed
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

  // Initialize Bluetooth Low Energy immediately
  setupBLE();

  // Setup Network client (Insecure for TLS testing)
  net.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);

  Serial.println("[LUMO] Setup complete! Device is ready.");
}

// ── Loop ──────────────────────────────────────────────────────────────────
void loop() {
  // 1. BLE Advertising restart on disconnect
  if (!bleClientConnected && oldBleClientConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
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

  // 4. Non-blocking Wi-Fi & MQTT handling
  checkWifiAndMqtt();

  delay(1);
}
