import {
  CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback,
  PlatformAccessory, Service,
} from 'homebridge';

import {
  PlugData, PowerState,
  StripData, StripSwitch,
} from './commonApi';
import { DeviceConfiguration } from './config';
import { SonoffLanPlatform } from './platform';
import {
  extractDataFromDnsService, setSwitchesStatus, toggleSwitchStatus,
} from './sonoffLanModeApi';

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
   * Keep track of the states this accessory has
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
    if (initialState) {
      this.states.on = (initialState.switch === PowerState.On);
    } else {
      this.platform.log.warn('Could not determine initial switch state');
    }
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

/**
 * A basic Platform Accessory for devices that identify as a strip. 
 * This will work out from the initial state how many Outlet services to expose. 
 * 
 * The only device I have for testing this, a USB Micro, identifies as a 4 Channel 
 * strip, even though only the first Channel actually has a function. This does not
 * contain information to determine if the outlet is in use or not. 
 */
export class StripPlatformAccessory {

  /**
   * The services this accessory uses
   */
  private services: Service[] = [];

  /**
   * The device configuration for this accessory
   */
  private deviceConfiguration: DeviceConfiguration;

  /**
   * The initial data from the strip
   */
  private initialData: StripData;

  /**
   * Keep track of the states this accessory has
   */
  private states: boolean[] = [];

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

    /* Get the initial state from the MDNS service */
    this.initialData = extractDataFromDnsService(
      this.deviceConfiguration.service, this.deviceConfiguration,
      this.platform.log) as StripData;

    /* Configure the services */
    if (this.initialData) {
      this.initialData.switches.forEach(value => {

        const name =
          (this.deviceConfiguration.name || this.deviceConfiguration.deviceId) +
          ' CH' + value.outlet;

        const service = this.accessory.getService(name)
          || this.accessory.addService(this.platform.Service.Outlet, name, 'CH' + value.outlet);

        /* set the service name, this is what is displayed as the default name on the Home app */
        service.setCharacteristic(this.platform.Characteristic.Name, name);

        /* create handlers for required characteristics */
        service.getCharacteristic(this.platform.api.hap.Characteristic.On)
          .on('get', (callback: CharacteristicGetCallback) => {
            this.getOn(value.outlet, callback);
          })
          .on('set', (charValue: CharacteristicValue, callback: CharacteristicSetCallback) => {
            this.setOn(value.outlet, charValue, callback);
          });

        /* Always returning the same state for this anyway so just bind */
        service.getCharacteristic(this.platform.api.hap.Characteristic.OutletInUse)
          .on('get', (callback: CharacteristicGetCallback) => {
            /* just always return a true status */
            callback(null, 1);
          });

        this.services[value.outlet] = service;

        /* Set the values */
        this.states[value.outlet] = (value.switch === PowerState.On);
      });
    } else {
      this.platform.log.warn('Could not identify switches');
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(outlet: number, value: CharacteristicValue, callback: CharacteristicSetCallback) {

    /* Set the state in this accessory */
    this.states[outlet] = value as boolean;

    /* Build up the object of the state and send to the API */
    const switches: StripSwitch[] = [];
    this.states.forEach((stateValue, index) => {
      switches[index] = {
        switch: (stateValue ? PowerState.On : PowerState.Off),
        outlet: index,
      };
    });

    const updatedData: StripData = {
      switches: switches,
      configure: this.initialData.configure,
      pulses: this.initialData.pulses,
      sledOnline: this.initialData.sledOnline,
      staMac: this.initialData.staMac,
    };

    setSwitchesStatus(this.platform.log, this.deviceConfiguration, updatedData);

    // TODO: Should verify that the switch status was successful

    this.platform.log.debug('Set Characteristic On for outlet %s -> %s', outlet, value);

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
  getOn(outlet: number, callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.states[outlet];

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }
}
