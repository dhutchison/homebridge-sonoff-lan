import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { DeviceConfiguration } from './config';
import { SonoffLanPlatform } from './platform';
import { 
  PlugData, PowerState, 
  extractDataFromDnsService, toggleSwitchStatus } from './sonoffApi';

/**
 * A basic Platform Accessory for a simple Outlet. 
 * 
 * This will expose as a Outlet device type, but will always return that
 * it is in use. From testing, the S26
 * does not contain information to determine if the outlet is in use or not. 
 */
export class OutletPlatformAccessory {
  
  /**
   * The service this accessory uses
   */
  private service: Service;

  /**
   * The device configuration for this accessory
   */
  private deviceConfiguration: DeviceConfiguration;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory.
   * 
   * TODO: This should initially be populated based on the MDNS record.
   */
  private states = {
    on: false,
    inUse: true,
  }

  constructor(
    private readonly platform: SonoffLanPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    /* set accessory information */
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    /* For ease of reference later on, store the device configuration object
     * as a field */
    this.deviceConfiguration = accessory.context.device;

    /* get the Outlet service if it exists, otherwise create a new Outlet service */
    this.service = this.accessory.getService(this.platform.Service.Outlet)
      || this.accessory.addService(this.platform.Service.Outlet);

    /* set the service name, this is what is displayed as the default name on the Home app */
    this.service.setCharacteristic(this.platform.Characteristic.Name, 
      this.deviceConfiguration.name || this.deviceConfiguration.deviceId);

    /* create handlers for required characteristics */
    this.service.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .on('get', this.getOn.bind(this))
      .on('set', this.setOn.bind(this));

    this.service.getCharacteristic(this.platform.api.hap.Characteristic.OutletInUse)
      .on('get', this.getOutletInUse.bind(this));

    /* Get the initial state from the MDNS service */
    const initialState = extractDataFromDnsService(
      this.deviceConfiguration.service, this.deviceConfiguration,
      this.platform.log) as PlugData;

    /* Set the values */
    this.states.on = (initialState.switch === PowerState.On);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    this.states.on = value as boolean;
    toggleSwitchStatus(this.platform.log, this.deviceConfiguration, this.states.on);

    // TODO: Should verify that the switch status was successful

    this.platform.log.debug('Set Characteristic On ->', value);

    // you must call the callback function
    callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.states.on;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  getOutletInUse(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET OutletInUse');
    // set this to a valid value for OutletInUse
    const currentValue = 1;

    callback(null, currentValue);
  }

}
