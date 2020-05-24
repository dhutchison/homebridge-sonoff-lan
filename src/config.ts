import { PlatformConfig } from 'homebridge';

import { MDNSService } from 'tinkerhub-mdns';

/**
 * Interface which defines the additional fields that can be expected in our Platform Config. 
 */
export interface SonoffPlatformConfig extends PlatformConfig {
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