import { PlatformConfig } from 'homebridge';

import { MDNSService } from 'tinkerhub-mdns';

/**
 * Interface defining fields which are required to be able to call the eWeLink API. 
 */
export interface EweLinkConfig {
    phoneNumber?: string;
    email?: string;
    countryCode?: string;
    password: string;
    imei: string;
    region?: string;

    apiHost?: string;
    webSocketApi?: string;

    /**
     * Once a successful login has been performed this will be set with the token
     * to use in future requests. 
     */
    authenticationToken?: string;
}

/**
 * Extension of EweLinkConfig for setting fields that will exist after default values
 * have been set. 
 */
export interface ValidatedEweLinkConfig extends EweLinkConfig {
    apiHost: string;
    webSocketApi: string;
}

/**
 * Interface which defines the additional fields that can be expected in our Platform Config. 
 */
export interface SonoffPlatformConfig extends PlatformConfig {
    /**
     * If this plugin is to communicate with the eWeLink API to get
     * device keys, this must be configured. 
     * 
     * This is only required if you require to control devices which are not
     * available in DIY mode. 
     */
    eweLinkConfig?: EweLinkConfig;
    /**
     * Instead of calling the eWeLink API, device keys can be manually set if
     * they are known. 
     * 
     * This is only required if you require to control devices which are not
     * available in DIY mode. 
     */
    deviceKeys?: DeviceKeyConfiguration[];
}

/**
 * Object holding a device id and api key pair.
 */
export interface DeviceKeyConfiguration {
    name?: string;
    deviceId: string;
    deviceKey: string;
}


/**
 * Interface defining the details of a registered device. 
 */
export interface DeviceConfiguration {

    /**
     * The display name for the device
     */
    name?: string;
    /**
     * The unique id
     */
    deviceId: string;
    /**
     * The device encryption key. This is only required if the 
     * device is not in DIY mode and is normally controlled
     * by the cloud service. 
     */
    deviceKey?: string;

    /**
     * Boolean indicating if this device uses encrypted data or not. 
     * If this is true then a deviceKey must be set. 
     */
    encrypted: boolean;

    /**
     * The type of this device. This will be used to interpret the correct device
     * characteristics
     */
    type: string;

    /**
     * The MDNS service this device was created from. 
     */
    service: MDNSService;
}