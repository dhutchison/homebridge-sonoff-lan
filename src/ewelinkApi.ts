import axios from 'axios';
import * as crypto from 'crypto';
import { DynamicPlatformPlugin, Logger } from 'homebridge';

import { EweLinkConfig, ValidatedEweLinkConfig } from './config';
import { PlugData, StripData } from './commonApi';

/**
 * Interface defining the fields which are included in every
 * API call to the ewelink API. 
 * 
 * These fields are required, but defined as optional below so we
 * can create extensions of this interface without the fields, then
 * call a method to populate the common values. 
 */
interface BaseApiRequest {
  version?: string;
  ts?: string;
  nonce?: string;
  appid?: string;
  imei?: string;
  os?: string;
  model?: string;
  romVersion?: string;
  appVersion?: string;
}

/**
 * Interface defining the fields which are used in the query string of a GET request for
 * listing the devices attached to a user account. 
 */
interface ListDevicesApiRequest extends BaseApiRequest {
  lang: string;
  /**
   * The API key associated with the user, returned as part of the login response. 
   */
  apiKey: string;
  getTags: string;
}

/**
 * Interface defining the fields contained in the data sent to the API
 * when logging in to eWeLink. 
 */
interface LoginPayload extends BaseApiRequest {
  phoneNumber?: string;
  email?: string;
  password: string;
}

/**
 * Interface defining the fields sent in a request to get the region for a 
 * country code. 
 */
interface RegionRequest extends BaseApiRequest {
  country_code: string;
}

/**
 * Interface defining the fields returned from a request to get the region for
 * a country code. 
 */
interface RegionResponse {
  requestid: string;
  region: string;
  error?: number;
}

/**
 * Details returned for a user as part of logging in. 
 */
interface User {
  _id: string;
  email?: string;
  password: string;
  appId: string;
  apikey: string;
  createdAt: Date;
  __v: 0;
  lang: string;
  online: boolean;
  onlineTime: Date;
  ip: string;
  location: string;
  offlineTime: Date;
}

export interface LoginResponse {
    at?: string;
    rt?: string;
    user?: User;
    error?: number;
    region?: string;
}

interface Settings {
  opsNotify: boolean;
  opsHistory: boolean;
  alarmNotify: boolean;
  wxAlarmNotify: boolean;
  wxOpsNotify: boolean;
  wxDoorbellNotify: boolean;
  appDoorbellNotify: boolean;
}

export interface Device {
  settings: Settings; 
  group: string;
  online: boolean;
  shareUsersInfo: object[];
  groups: object[];
  devGroups: object[];
  _id: string;
  name: string;
  type: string;
  deviceid: string;
  /**
   * The API key used in the request for the device. This will match the user
   * API key from the login response. 
   */
  apikey: string;
  /* Don't think this provides any extra information that we need */
  extra: object;
  createdAt: Date;
  __v: number;
  onlineTime: Date;
  /**
   * Object containing the status parameters for the device. 
   * This will match items like the PlugData and StripData from the LAN control. Other
   * object types will exist for other devices. 
   */
  params: PlugData | StripData | object;
  ip: string;
  location: string;
  offlineTime: Date;
  sharedTo: object[];
  /**
   * The device key. 
   * This is required for performing direct (lan) calls to the device. 
   */
  devicekey: string;
  deviceUrl: string;
  brandName: string;
  showBrand: boolean;
  brandLogoUrl: string;
  productModel: string;
  devConfig: object;
  uiid: number;
}

export interface ListDeviceResponse {
  error?: number;
  devicelist?: Device[];
}

/**
 * Class exposing methods which are available in the eWeLink API.
 */
export class EweLinkApi {


  private readonly config: ValidatedEweLinkConfig;

  constructor(
    private readonly platform: DynamicPlatformPlugin,
    private readonly log: Logger,
    private readonly initialConfig: EweLinkConfig,
  ) {

    /* Perform additional validation and setting of default values in the config object */
    if (!initialConfig || 
      (!initialConfig.authenticationToken && ((!initialConfig.phoneNumber && !initialConfig.email) || 
      !initialConfig.password || 
      !initialConfig.imei))) {

      this.log.error('Initialization skipped. Missing configuration data.');
      //TODO: Behaviour if a value is missing
      // return;
    }

    this.config = {
      phoneNumber: initialConfig.phoneNumber,
      email: initialConfig.email,
      password: initialConfig.password,
      imei: initialConfig.imei,

      apiHost: (initialConfig.apiHost ? initialConfig.apiHost : 'eu-api.coolkit.cc:8080'),
      webSocketApi: (initialConfig.webSocketApi ? initialConfig.webSocketApi : 'us-pconnect3.coolkit.cc'),

    };

  }

  /**
   * Generate a nonce for sending with API requests. 
   */
  nonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Generate an HMAC signature for the supplied data string. 
   * @param input the input string to get a signature for. 
   */
  getSignature(input: string): string {
    const decryptedAppSecret = '6Nz4n0xA8s8qdxQf2GqurZj2Fs55FUvM';
    return crypto.createHmac('sha256', decryptedAppSecret).update(input).digest('base64');
  }

  /**
   * TODO: add documentation, return promise and handle error cases cleaner
   * 
   * @param callback 
   * 
   */
  login(): Promise<LoginResponse> {

    // TODO: validate this configuration earlier instead of in thie method
    // TODO: or just handle better
    // if (!this.config.phoneNumber && !this.config.email || !this.config.password || !this.config.imei) {
    //   this.log.warn('phoneNumber / email / password / imei not found in config, skipping login');
    //   callback();
    //   return;
    // }

    let data: LoginPayload = {
      phoneNumber: this.config.phoneNumber,
      email: this.config.email,
      password: this.config.password,
    };
    data = this.populateCommonApiRequestFields(data);
    

    const json = JSON.stringify(data);
    this.log.info('Sending login request with user credentials: %s', json);

    const sign = this.getSignature(json);
    this.log.debug('Login signature: %s', sign);

    const uri = 'https://' + this.config.apiHost + '/api/user/login';

    const config = {
      headers: {
        'Authorization': 'Sign ' + sign,
        'Content-Type': 'application/json;charset=UTF-8',
        'Accept': 'application/json',
        'Accept-Language': 'en-gb',
      },
    };
  
    return new Promise<LoginResponse>((resolve, reject) => {
      axios.post<LoginResponse>(uri, data, config)
        .then((response) => {
          this.log.debug('login Response: %o', response.data);

          // If we receive 301 error, switch to new region and try again
          // If we do a region check before logging in, there should be no reason to do this
          // if (response.data.error && response.data.error === 301 && response.data.region) {
          //   const idx = this.config.apiHost.indexOf('-');
          //   if (idx === -1) {
          //     this.log.error('Received new region [%s]. However we cannot construct the new API host url.', response.data.region);
          //     callback();
          //     return;
          //   }

          //   const newApiHost = response.data.region + this.config.apiHost.substring(idx);
          //   if (this.config.apiHost !== newApiHost) {
          //     this.log.debug('Received new region [%s], updating API host to [%s].', response.data.region, newApiHost);
          //     this.config.apiHost = newApiHost;
          //     this.login(callback);
          //     return;
          //   }
          // }

          if (!response.data.at) {
            this.log.warn('Server did not response with an authentication token. Response was [%s]', response);
            reject('Server did not response with an authentication token.');
          }

          this.log.debug('Authentication token received [%s]', response.data.at);
          this.config.authenticationToken = response.data.at;

          resolve(response.data);
        })
        .catch((error) => {
          this.log.error('An error was encountered while logging in. Error was [%s]', error);
          reject('Error logging in.');
        });
    });
    

        
    
    //   this.webClient = request.createClient('https://' + this.config['apiHost']);
    //   this.webClient.headers['Authorization'] = 'Bearer ' + body.at;

    //   this.getWebSocketHost(function () {
    //     callback(body.at);
    //   }.bind(this));
    // }.bind(this));
    //   })
    //   .catch((error) => {
    //     this.log.error('An error was encountered while logging in. Error was [%s]', error);
    //     callback();
    //     return;
    //   });
  }

  /**
   * Helper method to set the common values all implementations or BaseApiRequest are
   * expected to include before being sent with API requests. 
   * @param obj the object to populate the fields in
   * @returns the updated object. 
   */
  private populateCommonApiRequestFields<T extends BaseApiRequest>(obj: T): T {

    obj.version = '6';
    obj.ts = '' + Math.floor(new Date().getTime() / 1000);
    obj.nonce = this.nonce();
    obj.appid = 'oeVkj2lYFGnJu5XUtWisfW4utiN4u9Mq';
    obj.imei = this.config.imei;
    obj.os = 'iOS';
    obj.model = 'iPhone10,6';
    obj.romVersion = '11.1.2';
    obj.appVersion = '3.5.3';

    return obj;
  }

  /**
   * Get a list of devices from the API
   */
  listDevices(apiKey: string): Promise<Device[]> {

    const url = 'https://' + this.config.apiHost + '/api/user/device';

    this.log.debug('Requesting a list of devices from eWeLink HTTPS API at [%s]', url);

    let requestParams: ListDevicesApiRequest = {
      lang: 'en',
      apiKey: apiKey,
      getTags: '1',
    };
    requestParams = this.populateCommonApiRequestFields(requestParams);


    return new Promise<Device[]>((resolve, reject) => {
      axios.request<ListDeviceResponse>(
        {
          url: url,
          method: 'get',
          params: requestParams,
          headers: {
            'Authorization': 'Bearer ' + this.config.authenticationToken,
            'Accept': 'application/json',
            'Accept-Language': 'en-gb',
          },
        })
        .then((response) => {
          this.log.debug('listDevices Response: %o', response.data);

          if (response.data.error && response.data.error !== 0) {
        
            this.log.error('An error was encountered while requesting a list of devices. Response was [%s]', response);
            if (response.data.error === 401) {
              this.log.warn(
                'Verify that you have the correct authenticationToken specified in your configuration. ' + 
                'The currently-configured token is [%s]', this.config.authenticationToken);
            }
            reject('Error code returned from API: ' + response.data.error);
          }

          resolve(response.data.devicelist);
        })
        .catch(error => {
          this.log.error('An error was encountered while requesting a list of devices. Error was [%s]', error);
          reject(error);
        });
    });
  }

  getRegion(countryCode: string): Promise<string> {

    /* Create the request object */
    let requestParams: RegionRequest = {
      // eslint-disable-next-line @typescript-eslint/camelcase
      country_code: countryCode,
    };
    requestParams = this.populateCommonApiRequestFields(requestParams);
      
    /* Create a signature for the request */
    const dataToSign = Object.keys(requestParams)
      .sort((a, b) => b.localeCompare(a))
      .map(key => key + '=' + requestParams[key])
      .join('&');
  
    const signature = this.getSignature(dataToSign);
    this.log.debug('getRegion signature: %s', signature);
      
    /* The URL for the API request */
    const url = 'https://api.coolkit.cc:8080/api/user/region';

    /* Return a promise for the request */
    return new Promise<string>((resolve, reject) => {
      axios.request<RegionResponse>(
        {
          url: url,
          method: 'get',
          params: requestParams,
          headers: {
            'Authorization': 'Sign ' + signature,
            'Content-Type': 'application/json;charset=UTF-8',
          },
        })
        .then((response) => {
          this.log.debug('getRegion Response: %o', response.data);
  
          if (response.data.error && response.data.error !== 0) {
            this.log.error('An error was encountered while requesting a region. Response was [%s]', response);
            reject('Error code returned from API: ' + response.data.error);
          }
  
          resolve(response.data.region);
        })
        .catch(error => {
          this.log.error('An error was encountered while requesting a region. Error was [%s]', error);
          reject(error);
        });
    });
  }

}