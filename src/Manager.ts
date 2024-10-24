import { ButtplugClientDevice } from "buttplug/dist/main/src/client/ButtplugClientDevice";
import { ButtplugClient } from "buttplug/dist/main/src/client/Client";
import { Device } from "./Device";
import { LinearCapability } from "./LinearCapability";
import { RotationalCapability } from "./RotationalCapability";
import { ScalarCapability } from "./ScalarCapability";
import { SensorCapability } from "./SensorCapability";
import { SensorType } from "buttplug/dist/main/src/core/Messages";
import { BrowserWindow, ipcMain } from 'electron';
import { ButtplugNodeWebsocketClientConnector } from "buttplug/dist/main/src/client/ButtplugNodeWebsocketClientConnector";
import { WebSocket } from 'ws';
import path from 'path';
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as https from 'https';

export class Manager {
  private static readonly BATTERY_SENSOR_READ_DELAY: number = 30_000;
  private static readonly TWITCH_PUBSUB_ENDPOINT: string = 'wss://pubsub-edge.twitch.tv';
  private static readonly TWITCH_PING_DELAY: number = 30_000;
  private static readonly TWITCH_PING_MESSAGE: unknown = {
    type: 'PING',
    nonce: 'positiveVibesPing',
  }
  private static mainWindow: BrowserWindow;
  private static twitchChannelID: string;
  private static twitchAuthToken: string;
  private static twitchRegisterListenerMessage: unknown;
  private static twitchWebSocket: WebSocket;
  private static pollingBattery: boolean = false;

  public static buttplugClient: ButtplugClient;
  public static activeDevices: Device[] = [];

  constructor(public mainWindow: BrowserWindow) {
    console.log('[Manager] constructor()');
    Manager.mainWindow = mainWindow;
    if (Manager.buttplugClient === undefined) {
      console.log('[Manager] instantiating ButtplugClient');
      Manager.buttplugClient = new ButtplugClient('Positive Vibes');

      ipcMain.on('authenticate-event', async () => {
        await this.authenticateWithTwitch();
      });

      ipcMain.on('connect-event', async () => {
        await this.connectToButtplugServer();
      });
    }
  }

  private async authenticateWithTwitch() {
    console.log('[Manager.ts] authenticate-event');
    const twitchAuthWindow = new BrowserWindow({
      width: 481,
      height: 526,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twitchAuthWindow.webContents.session.setCertificateVerifyProc((_request: any, callback: (arg0: number) => void) => {
      callback(0); // Always callback with 0 to ignore certificate errors
    });
    twitchAuthWindow.loadURL('https://id.twitch.tv/oauth2/authorize?scope=channel%3Aread%3Aredemptions&response_type=code&client_id=4kwy722z0ps9eor6dqqfhibqq3cs56&redirect_uri=https%3A%2F%2F37.205.9.214%3A16969%2Fauthenticate');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twitchAuthWindow.webContents.on('will-redirect', async (_event: any, url: string) => {
      console.log(`[Manager.ts] Twitch Auth redirect URL: ${url}`);
      twitchAuthWindow.loadURL(url);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    twitchAuthWindow.webContents.on('did-navigate', (_event: any, url: string) => {
      console.log(`[Manager.ts] Twitch Auth window loaded: ${url}`);
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = queryString.split('&');
        const params: Record<string, string> = {};
        queryParams.forEach(param => {
          const [key, value] = param.split('=');
          params[key] = decodeURIComponent(value);
        });

        const twitchAuthCode = params['code'];
        console.log(`[Manager.ts] Twitch Auth Code: ${twitchAuthCode}`);
        if (twitchAuthCode) {
          console.log(`[Manager.ts] TODO: Send Twitch Auth Code to backend for token exchange.`);
          const axiosInstance = axios.create({
            httpsAgent: new https.Agent({
              rejectUnauthorized: false,
              requestCert: false,
            }),
          });
          const postData = { code: twitchAuthCode };
          axiosInstance.post(`https://37.205.9.214:16969/authenticate`, postData, { headers: { 'Content-Type': 'application/json' } })
            .then((response: AxiosResponse) => {
              console.log(`[Manager.ts] Received response from backend: status=${response.status}`);
              if (response.data) {
                if (response.data.access_token) {
                  console.log(`[Manager.ts] Twitch Access Token: ${response.data.access_token}`);
                  Manager.twitchAuthToken = response.data.access_token;
                  axios.get('https://api.twitch.tv/helix/users', { headers: { 'Client-ID': '4kwy722z0ps9eor6dqqfhibqq3cs56', 'Authorization': `Bearer ${response.data.access_token}` } })
                    .then((response: AxiosResponse) => {
                      console.log(`[Manager.ts] Twitch User ID: ${response.data.data[0].id}`);
                      Manager.twitchChannelID = response.data.data[0].id;
                      Manager.twitchRegisterListenerMessage = {
                        type: 'LISTEN',
                        nonce: 'randomNonce',
                        data: {
                          topics: [`channel-points-channel-v1.${Manager.twitchChannelID}`],
                          auth_token: Manager.twitchAuthToken,
                        },
                      };
                      Manager.twitchWebSocket = new WebSocket(Manager.TWITCH_PUBSUB_ENDPOINT);
                      Manager.twitchWebSocket.on('open', () => {
                        console.log(`[Manager.ts] Registering Twitch redeem message listener`);
                        Manager.twitchWebSocket.send(JSON.stringify(Manager.twitchRegisterListenerMessage));
                      });

                      Manager.twitchWebSocket.on('close', () => {
                        console.log(`[Manager.ts] Twitch PubSub connection closed.`);
                      });

                      Manager.twitchWebSocket.on('error', (err) => {
                        console.log(`[Manager.ts] Twitch PubSub websocket connection threw an error:${err}`);
                      })

                      Manager.twitchWebSocket.on('message', async (data) => {
                        const message = JSON.parse(data.toString());
                        console.log(`[Manager.ts] Received message from Twtich PubSub:${message.type}`);
                        switch (message.type) {
                          case 'RESPONSE':
                            console.log(`[PubSub RESPONSE] ${message.error} ${message.nonce}`);
                            this.pollTwitchWebsocket();
                            break;
                        }
                        if (message.type === 'MESSAGE' && message.data) {
                          const redemptionMessage = JSON.parse(message.data.message);
                          if (redemptionMessage.type === 'reward-redeemed') {
                            const redemption = redemptionMessage.data.redemption;
                            console.log(`[Manager.ts] User ${redemption.user.display_name} redeemed ${redemption.reward.title} for ${redemption.reward.cost}`);
                            if (redemption.reward.title === 'Catch A Wolfamon') {
                              await Manager.activeDevices.forEach(async (device) => {
                                await device.pingRotationals();
                                await device.pingScalars();
                              });
                            }
                            if (redemption.reward.title === 'Pet the Wolf' || redemption.reward.title === 'Shake That Butt (VR Only)') {
                              await Manager.activeDevices.forEach(async (device) => {
                                await device.rotateFor(0.2, true, 10000);
                                await device.vibrateFor(0.2, 10000);
                              });
                            }
                            if (redemption.reward.title === 'Give Me Your Milk!') {
                              await Manager.activeDevices.forEach(async (device) => {
                                await device.rotateFor(0.35, true, 15000);
                                await device.vibrateFor(0.35, 15000);
                              });
                            }
                            if (redemption.reward.title === 'Nut Button') {
                              await Manager.activeDevices.forEach(async (device) => {
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                              });
                            }
                            if (redemption.reward.title === 'Waste of Points') {
                              await Manager.activeDevices.forEach(async (device) => {
                                await device.rotateFor(0.2, true, 2000);
                                await device.vibrateFor(0.2, 2000);
                                await device.rotateFor(0.35, true, 1000);
                                await device.vibrateFor(0.35, 1000);
                                await device.rotateFor(0.5, true, 500);
                                await device.vibrateFor(0.5, 500);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.8, true, 500);
                                await device.vibrateFor(0.8, 500);
                                await device.rotateFor(0.5, true, 5000);
                                await device.vibrateFor(0.5, 5000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(1, true, 500);
                                await device.vibrateFor(1, 500);
                                await device.rotateFor(0.8, true, 500);
                                await device.vibrateFor(0.8, 500);
                                await device.rotateFor(0.5, true, 3000);
                                await device.vibrateFor(0.5, 3000);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.2, true, 2000);
                                await device.vibrateFor(0.2, 2000);
                                await device.rotateFor(0.35, true, 1000);
                                await device.vibrateFor(0.35, 1000);
                                await device.rotateFor(0.5, true, 500);
                                await device.vibrateFor(0.5, 500);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.8, true, 500);
                                await device.vibrateFor(0.8, 500);
                                await device.rotateFor(0.5, true, 5000);
                                await device.vibrateFor(0.5, 5000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(1, true, 500);
                                await device.vibrateFor(1, 500);
                                await device.rotateFor(0.8, true, 500);
                                await device.vibrateFor(0.8, 500);
                                await device.rotateFor(0.5, true, 3000);
                                await device.vibrateFor(0.5, 3000);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(0.7, true, 2000);
                                await device.vibrateFor(0.7, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(1, true, 3000);
                                await device.vibrateFor(1, 3000);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(0.7, true, 2000);
                                await device.vibrateFor(0.7, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(1, true, 3000);
                                await device.vibrateFor(1, 3000);
                                await device.rotateFor(1, true, 2000);
                                await device.vibrateFor(1, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                                await device.rotateFor(0.7, true, 2000);
                                await device.vibrateFor(0.7, 2000);
                                await device.rotateFor(0.8, true, 2000);
                                await device.vibrateFor(0.8, 2000);
                              });
                            }
                          }
                        }
                      });
                      Manager.mainWindow.webContents.send('twitch-authenticated');
                    })
                    .catch((error: AxiosError) => {
                      console.error(`[Manager.ts] Error fetching Twitch User ID: ${error}`);
                    });
                }
                if (response.data.expires_in) {
                  console.log(`[Manager.ts] Twitch Auth Token Expiration: ${response.data.expires_in}`);
                }
                if (response.data.refresh_token) {
                  console.log(`[Manager.ts] Twitch Refresh Token: ${response.data.refresh_token}`);
                }
                if (response.data.scope) {
                  console.log(`[Manager.ts] Twitch Auth Token Scope: ${this.stringifyResponse(response.data.scope)}`);
                }
                if (response.data.token_type) {
                  console.log(`[Manager.ts] Twitch Auth Token Type: ${response.data.token_type}`);
                }
              }
              twitchAuthWindow.close();
            })
            .catch((error: AxiosError) => {
              console.error(`[Manager.ts] Error exchanging Twitch Auth Code for Token: ${error}`);
              twitchAuthWindow.close();
            });
        }
      }
    });
  }

  public async connectToButtplugServer(): Promise<void> {
    // Initialize connector, set up event listeners
    const connector = new ButtplugNodeWebsocketClientConnector('ws://127.0.0.1:6969');
    console.log('[Manager] buttplugClient.addListener.deviceadded');
    connector.addListener("deviceadded", async (d: ButtplugClientDevice) => {
      console.log(`Device Connected: ${d.name}`);
      console.log(`Device object dump:\n${JSON.stringify(d)}`);
      console.log(`Device Info:`);
      console.log(`${d.name} - ${d.displayName} - ${d.index}`);
      console.log(`Device Messages:`);
      console.log(`- commands:`);
      const scalarCapabilities: ScalarCapability[] = [];
      const linearCapabilities: LinearCapability[] = [];
      const rotationalCapabilities: RotationalCapability[] = [];
      const sensorCapabilities: SensorCapability[] = [];
      if (d.messageAttributes.LinearCmd !== undefined) {
        console.log(`  - Linear Commands:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.messageAttributes.LinearCmd.forEach((msg: any) => {
          console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
          linearCapabilities.push(new LinearCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
        });
      }
      if (d.messageAttributes.RotateCmd !== undefined) {
        console.log(`  - Rotate Commands:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.messageAttributes.RotateCmd.forEach((msg: any) => {
          console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
          rotationalCapabilities.push(new RotationalCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
        });
      }
      if (d.messageAttributes.ScalarCmd !== undefined) {
        console.log(`  - Scalar Commands:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.messageAttributes.ScalarCmd.forEach((msg: any) => {
          console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.ActuatorType} | ${msg.StepCount}`);
          scalarCapabilities.push(new ScalarCapability(d, msg.Index, msg.FeatureDescriptor, msg.ActuatorType, msg.StepCount));
        });
      }
      if (d.messageAttributes.SensorReadCmd !== undefined) {
        console.log(`  - Sensor Read Commands:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.messageAttributes.SensorReadCmd.forEach((msg: any) => {
          console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`);
          sensorCapabilities.push(new SensorCapability(d, msg.Index, msg.SensorType, msg.FeatureDescriptor, msg.StepRange));
        });
      }
      if (d.messageAttributes.SensorSubscribeCmd !== undefined) {
        console.log(`  - Sensor Subscribe Commands:`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d.messageAttributes.SensorSubscribeCmd.forEach((msg: any) => console.log(`    - ${msg.Index} | ${msg.FeatureDescriptor} | ${msg.SensorType} | ${msg.StepRange}`));
      }
      console.log(`  - Stop Device Command: ${JSON.stringify(d.messageAttributes.StopDeviceCmd)}`);

      const device: Device = new Device(d, scalarCapabilities, linearCapabilities, rotationalCapabilities, sensorCapabilities);
      Manager.activeDevices.push(device);

      console.log(`Sending test commands to ${d.name}`);
      await device.poolSensors();
      await device.pingLinears();
      await device.pingRotationals();
      await device.pingScalars();

      console.log('Client currently knows about these devices:');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Manager.buttplugClient.devices.forEach((device: any) => console.log(`- ${device.name}`));
    });
    console.log('[Manager] buttplugClient.addListener.deviceremoved');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connector.addListener('deviceremoved', (device: any) => {
      console.log(`Device Removed: ${device.name}`)
      // remove device from active devices list when disconnected
      Manager.activeDevices.splice(Manager.activeDevices.indexOf(Manager.activeDevices.filter((d) => d.device === device)[0]), 1);
    });
    console.log('[Manager] buttplugClient.addListener.log');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connector.addListener('log', (logMessage: any) => console.log(`Log: ${logMessage.message}`));
    console.log('[Manager] buttplugClient.addListener.disconnect');
    connector.addListener('disconnect', () => {
      console.log('Buttplug server disconnected!');
      Manager.mainWindow.webContents.send('buttplug-server-disconnected');
    });
    // Connect to the server
    await Manager.buttplugClient.connect(connector).then(() => {
      console.log('Connecting to Buttplug server');
      Manager.mainWindow.webContents.send('buttplug-server-connected');
    });
    // Start scanning for devices
    await Manager.buttplugClient.startScanning().then(async () => {
      console.log('Scanning started!');
      Manager.pollingBattery = true;
      await this.poolActiveDevicesSensors(SensorType.Battery);
    });
  }

  public async poolActiveDevicesSensors(sensorType: SensorType): Promise<void> {
    if (Manager.pollingBattery && sensorType === SensorType.Battery) {
      Manager.pollingBattery = true;
      setTimeout(async () => {
        await this.poolActiveDevicesSensors(sensorType);
      }, Manager.BATTERY_SENSOR_READ_DELAY);
    }
    Manager.activeDevices.forEach(async (device) => {
      await this.getSensorData(device, sensorType);
    });
  }

  private pollTwitchWebsocket(): void {
    console.log(`[Manager.ts] Pinging Twitch PubSub to keep websocket open`);
    Manager.twitchWebSocket.send(JSON.stringify(Manager.TWITCH_PING_MESSAGE));
    setTimeout(() => {
      this.pollTwitchWebsocket();
    }, Manager.TWITCH_PING_DELAY);
  }

  private async getSensorData(device: Device, sensorType: SensorType): Promise<void> {
    await device.getSensorData(sensorType).then((sensorReadings) => sensorReadings.forEach((sensorReading) => console.log(`${device.getDeviceName()} ${sensorReading.sensorType.toString()}: ${sensorReading.sensorReadings}`)));
  }

  private stringifyResponse(res: AxiosResponse): string {
    const circularReferences = new Set();
    const replacer = (key: string, value: unknown) => {
      // Check for circular references to avoid infinite recursion
      if (typeof value === 'object' && value !== null) {
        if (circularReferences.has(value)) {
          return '[Circular]';
        }
        circularReferences.add(value);
      }

      // Filter our properties
      if (key === 'config') return '[REDACTED]';
      if (key === '_sessionCache') return '[REDACTED]';

      return value;
    };

    return JSON.stringify(res, replacer, 2);
  }
}