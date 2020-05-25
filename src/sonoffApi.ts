import axios from 'axios';
import { Logger } from 'homebridge';
import { MDNSService } from 'tinkerhub-mdns';

import { DeviceConfiguration } from './config';
import { decrypt, encrypt } from './sonoffCrypto';

/**
 * Method to perform a post request to an API endpoint. 
 * @param uri the URI to send the request to
 * @param data the object to use as the POST request payload
 * @param log the logger instance to use for log messages
 */
function doPost(uri: string, data: object, log: Logger) {

  const config = {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json',
      'Accept-Language': 'en-gb',
    },
  };

  axios.post(uri, data, config)
    .then((response) => {
      log.debug('Response: %o', response.data);
    })
    .catch((error) => {
      log.debug(error);
    });

}

/**
 * Method to perform an API call to the device. This handles aspects of wrapping
 * the supplied data object with the result of the payload information. 
 * @param log the logger instance to use for log messages
 * @param uri the URI to send the request to
 * @param deviceId the device identifier
 * @param data the data object containing the state to send to the device. The surrounding 
 *             payload fields are all handled by this method.
 * @param apiKey the device API key. This optional parameter should only be supplied when
 *               performing an operation against a device which is not in DIY mode and so
 *               requires encrypted payloads to be sent. 
 */
function doApiCall(log: Logger, uri: string, deviceId: string, data: object, apiKey?: string) {

  const payload: ApiPayload = {
    sequence: Date.now().toString(),
    selfApikey: '123',
    deviceid: deviceId,
    data: JSON.stringify(data),
    encrypt: false,
  };


  log.debug('Pre-encryption payload: %s', JSON.stringify(payload));

  if (apiKey) {
    /* if we have an API key, need to encrypt the data */
    payload.encrypt = true;

    const encryptionResult = encrypt(payload.data, apiKey);
    payload.data = encryptionResult.data.toString('base64');
    payload.iv = encryptionResult.iv.toString('base64');
  }

  doPost(uri, payload, log);

}

/**
 * Get the base section of the API call URI, containing the protocol, 
 * host, and port, from the supplied device. 
 * @param device the device to get the URI details from. 
 */
function getBaseUri(device: DeviceConfiguration): string {

  return 'http://' + device.service.addresses[0].host + ':' + device.service.addresses[0].port;
}

/**
 * Perform an 'info' API request to a device
 * @param log the logger instance to use for log messages
 * @param device the device to send the API request to
 */
export function info(log: Logger, device: DeviceConfiguration) {


  const data = {};
  const uri = getBaseUri(device) + '/zeroconf/info';

  doApiCall(log, uri, device.deviceId, data, device.deviceKey);
}

/**
 * 
 * @param log the logger instance to use for log messages
 * @param device the device to send the API request to
 * @param on boolean to indicate if the device should be sent an
 *           'on' (true) or 'off' (false) state. 
 */
export function toggleSwitchStatus(
  log: Logger, 
  device: DeviceConfiguration,
  on: boolean) {

  const data = {
    switch: (on ? 'on': 'off'),
  };
  const uri = getBaseUri(device) + '/zeroconf/switch';

  doApiCall(log, uri, device.deviceId, data, device.deviceKey);

}

/**
 * Set the switch status for a strip device. 
 * @param log the logger instance to use for log messages
 * @param device the device to send the API request to
 * @param data the updated Strip data to send to the device
 */
export function setSwitchesStatus(
  log: Logger,
  device: DeviceConfiguration, 
  data: StripData) {

  const uri = getBaseUri(device) + '/zeroconf/switches';

  doApiCall(log, uri, device.deviceId, data, device.deviceKey);
}

/**
 * Extract the state data object from the MDNS service.
 *  
 * @param device the device to extra data from the service entry for
 * @param log the logger instance to use for log messages
 */
export function extractDataFromDnsService(
  service: MDNSService, device: DeviceConfiguration, log: Logger): object {

  /* DNS TXT records has limitation on field lengths, as a result the 
   * data may be split into up to 4 fields. 
   * Need to join these up. */

  let data1 = service.data.get('data1') as string;
  if (service.data.has('data2')) {

    const data2 = service.data.get('data2');
    data1 += data2;

    if (service.data.has('data3')) {
      
      const data3 = service.data.get('data3');
      data1 += data3;

      if (service.data.has('data4')) {
                  
        const data4 = service.data.get('data4');
        data1 += data4;

      }
    }
  }

  /* Convert the string into a usable object. 
   * Depending on the device setup, this may need to be decrypted first */
  let data;
  if (device.encrypted) {
    /* If this is marked as encrypted, we would need an API key to decrypt. 
       We don't have this yet. 
    */
    if (device.deviceKey !== undefined) {
      /* Should be able to decrypt this data.
       * Requires to get the IV from another field */
      const iv = service.data.get('iv') as string;

      data = decrypt(data1, device.deviceKey, iv);
    } else {
      log.error('Missing api_key for encrypted device %s', service.name);
    }
    
  } else {
    data = data1;
  }

  log.debug('Data: %o', data);


  /* Convert to a JSON object */
  return JSON.parse(data);
}  



/**
 * Interface defining the fields for a top level API payload
 */
interface ApiPayload {
  /* Note if the sequence and selfApikey were sent as numbers,
   * the HTTP connection will fail with an ECONNRESET status 
   */
  sequence: string;
  selfApikey: string;
  deviceid: string;
  data: string;
  encrypt?: boolean;
  iv?: string;
}

/**
 * Enum of valid power states. 
 */
export enum PowerState {
  On = 'on',
  Off = 'off'
}

/**
 * Enum of valid startup states
 */
export enum StartupState {
  On = 'on',
  Off = 'off',
  Stay = 'stay'
}

/**
 * Object containing the status data which is retrieved from
 * the MDNS result for a plug. 
 */
export interface PlugData {
  switch: PowerState;
  startup: StartupState;
  pulse: PowerState;
  sledOnline: PowerState;
  pulseWidth: number;
  rssi: number;
}

/**
 * Object containing the status for a single switch in a strip. 
 */
export interface StripSwitch {
  /**
   * The switch state
   */
  switch: PowerState;
  /**
   * The number of the outlet in the strip
   */
  outlet: number;
}

/**
 * Object containing the pulse configuration status for a single switch in a strip. 
 */
export interface StripPulseConfiguration {
  /**
   * The switch pulse state
   */
  pulse: PowerState;
  /**
   * The pulse width
   */
  width: number;
  /**
   * The number of the outlet in the strip
   */
  outlet: number;
}

/**
 * Object containing the configuration for a single switch in a strip.
 */
export interface StripConfiguration {
  /**
   * The startup state when power is resumed to the device
   */
  startup: StartupState;
  /**
   * The number of the outlet in the strip
   */
  outlet: number;
}

/**
 * Object containing the status data which is retrieve from the
 * the MDNS result for a strip. 
 */
export interface StripData {

  switches: StripSwitch[];
  configure: StripConfiguration[];
  pulses: StripPulseConfiguration[];
  sledOnline: PowerState;
  staMac: string;

}

