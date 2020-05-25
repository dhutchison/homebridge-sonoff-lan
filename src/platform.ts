import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, Service } from 'homebridge';

import { MDNSServiceDiscovery, Protocol, MDNSService } from 'tinkerhub-mdns';

import { DeviceConfiguration, SonoffPlatformConfig } from './config';
import { OutletPlatformAccessory, StripPlatformAccessory } from './platformAccessory';

import { extractDataFromDnsService, info } from './sonoffApi';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';



/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SonoffLanPlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  /* The utility for discovering items via DNS */
  private discovery: MDNSServiceDiscovery;

  constructor(
    public readonly log: Logger,
    public readonly config: SonoffPlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    /* Configure the DNS service discovery utility.
     * Looking for items with the "_ewelink._tcp" service type. 
     */
    
    this.discovery = new MDNSServiceDiscovery({ 
      type: 'ewelink',
      protocol: Protocol.TCP,
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    /* Register the listener for devices being discovered */
    this.discovery.onAvailable(service => {
      this.log.info('Discovered new service %o: ', service);


      const device = this.createDeviceAccessory(service);
      this.configureDeviceAccessory(device);
    });

    this.discovery.onUpdate(service => {
      this.log.info('Service updated: %o', service);
    });

    this.discovery.onUnavailable(service => {
      this.log.info('Service unavailable: %o', service);
    });

    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }

  private configureDeviceAccessory(device: DeviceConfiguration) {

    /* Generate the unique id for the accessory based on the device 
     * identifier */
    const uuid = this.api.hap.uuid.generate(device.deviceId);

    /* see if an accessory with the same uuid has already been registered and restored from
     * the cached devices we stored in the `configureAccessory` method above */
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      /* the accessory already exists */
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
      existingAccessory.context.device = device;
      this.api.updatePlatformAccessories([existingAccessory]);

      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      if (device.type === 'plug') {
        //TODO: More types
        new OutletPlatformAccessory(this, existingAccessory);
      } else if (device.type === 'strip') {
        new StripPlatformAccessory(this, existingAccessory);
      }

    } else {
      /* the accessory does not yet exist, so we need to create it */
      this.log.info('Adding new accessory:', device.deviceId);

      // create a new accessory
      const accessory = new this.api.platformAccessory(device.deviceId, uuid);

      /* store a copy of the device object in the `accessory.context`
         * the `context` property can be used to store any data about the 
         * accessory you may need */
      accessory.context.device = device;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      if (device.type === 'plug') {
        //TODO: More types
        new OutletPlatformAccessory(this, accessory);
      } else if (device.type === 'strip') {
        new StripPlatformAccessory(this, accessory);
      }

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  private createDeviceAccessory(service: MDNSService): DeviceConfiguration {

    const serviceDataMap = service.data;

    const deviceConfiguration: DeviceConfiguration = {
      deviceId: serviceDataMap.get('id') as string,
      encrypted: (serviceDataMap.get('encrypt') || false) as boolean,
      type: serviceDataMap.get('type') as string,
      service: service,
    };

    if (this.config.deviceKeys) {
      /* There are configured device keys, try to find a match to add more detail */
      const deviceKeyConfiguration = this.config.deviceKeys
        .find(value => value.deviceId === deviceConfiguration.deviceId);

      if (deviceKeyConfiguration) {
        /* Found one, add the extra field detail */
        deviceConfiguration.name = deviceKeyConfiguration.name;
        deviceConfiguration.deviceKey = deviceKeyConfiguration.deviceKey;
      }
    }

    /* Log some extra debug information about devices at startup */
    this.extractData(service, deviceConfiguration);


    return deviceConfiguration;

  }
  
  private extractData(service: MDNSService, device: DeviceConfiguration) {


    /* Parse the data out of the service entry, this will add debug information */
    extractDataFromDnsService(service, device, this.log);

    /* Try call the info endpoint.
       This won't be supported by all devices (S26 doesn't) */

    info(this.log, device);
  }  
}
