/**
 * Ultimately need to do something to combine the types:
 * - Device from ewelinkApi.ts
 * - DeviceConfiguration from config.ts
 * 
 * 
 * These hold some common, but also different, device information.
 * 
 * 
 * Also, we have a number of data objects which are very similar (at least in the
 * key parts), between the ewelink and lan APIs. 
 */

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

  
  staMac?: string;
  fwVersion?: string;
  version?: number;
  init?: boolean;
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


  version?: number;
  lock?: boolean;
  rssi?: number;
  fwVersion?: string;
  selfApikey?: string;

}