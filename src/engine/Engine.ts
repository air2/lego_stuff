/* eslint-disable no-dupe-class-members */

import { AbsoluteMotor, PoweredUP, TachoMotor, TechnicMediumHub, TechnicMediumHubTiltSensor } from 'node-poweredup'
import { NotFoundError } from 'routing-controllers'
import { BehaviorSubject, firstValueFrom, ReplaySubject } from 'rxjs'
import { EventEmitter } from 'stream'
import { CraneHubSwitchMotor, MiddleHubSwitchMotor } from '../controllers/EngineController'
import { logger } from '../logger'

// hub.disconnect()
// //const motorA = await hub.waitForDeviceAtPort("A"); // Make sure a motor is plugged into port A
// const motorB: TechnicLargeLinearMotor = await hub.waitForDeviceAtPort("B"); // Make sure a motor is plugged into port B
// console.log("Connected", motorB.type, motorB.typeName);
// // motorB.

// //while (true) { // Repeat indefinitely
//     console.log("Running motor B at speed 50");
//  motorB.setPower(50); // Start a motor attached to port B to run a 3/4 speed (75) indefinitely
//  await hub.sleep(2000)
//  motorB.brake()
//    await motorB.rotateByDegrees(50, 50)
//   await motorB.rotateByDegrees(150, 50)
// motorB.
//     console.log("Running motor A at speed 100 for 2 seconds");
//     motorA.setPower(100); // Run a motor attached to port A for 2 seconds at maximum speed (100) then stop
// await hub.sleep(2000);
// motorB.brake();
//     await hub.sleep(1000); // Do nothing for 1 second
//     console.log("Running motor A at speed -30 for 1 second");
//     motorA.setPower(-30); // Run a motor attached to port A for 2 seconds at 1/2 speed in reverse (-50) then stop
//     await hub.sleep(2000);
//     motorA.brake();
//     await hub.sleep(1000); // Do nothing for 1 second
// }
// });

export interface IMotorsId {
    hub: string,
    ports: string[]
}
export interface IMotorId {
    hub: string,
    port: string
}

export function getMotorIds (value: IMotorsId | IMotorId): IMotorId[] {
  if (!isMotorsId(value)) { return [value] }
  return value.ports.map(port => {
    const result: IMotorId = {
      hub: value.hub,
      port
    }
    return result
  })
}

export function isMotorsId (value: IMotorsId | IMotorId): value is IMotorsId {
  return (value as IMotorsId).ports !== undefined
}

type MotorIdString = string

// function convertToMotorsIdString (value: IMotorsId): MotorIdString {
//   return `${value.hub}#${value.ports.join(',')}`
// }

function convertToMotorIdString (value: IMotorId): MotorIdString {
  return `${value.hub}#${value.port}`
}
export class Engine {
  private _hubs: {
        [key: string]: TechnicMediumHub
    } = {}

  private poweredUP = new PoweredUP()
  private initialized = new EventEmitter()
  public readonly onTiltX: {
        [key: string]: BehaviorSubject<number>
    } = {}

  public readonly motorPosition: {
        [key: MotorIdString]: ReplaySubject<number>
    } = {}

  constructor () {
    logger.info('Waiting for connections')
    this.poweredUP.on('discover', async (hub: TechnicMediumHub) => { // Wait to discover a Hub
      logger.info(`Discovered ${hub.name} - ${hub.batteryLevel}!`)
      await hub.connect() // Connect to the Hub
      this._hubs[hub.name] = hub
      this.onTiltX[hub.name] = new BehaviorSubject<number>(0)
      hub.on('tilt', (sensor: TechnicMediumHubTiltSensor) => {
        //    console.log('hub is titlted', sensor.values)
        const sub = this.onTiltX[hub.name]
        const newValue = sensor.values.tilt.x
        if (sub && sub.value !== newValue) {
          sub.next(newValue)
        }
      })
      if (hub.name === CraneHubSwitchMotor.hub) {
        await this.initializeMotorsToZero(CraneHubSwitchMotor, 20)
        logger.info(`initialized hub ${hub.name}`)
      }
      if (hub.name === MiddleHubSwitchMotor.hub) {
        // await this.runMotorToAngle(MiddleHubSwitchMotor, 20, -360)
        await this.reportPosition(MiddleHubSwitchMotor)
        logger.info(`initialized hub ${hub.name}`)
      }

      //  console.log(this._hubs)
      if (Object.keys(this._hubs).length > 0) {
        this.initialized.emit('done', true)
      }
    })
  }

  // eslint-disable-next-line no-use-before-define
  private static instance: Engine
  public static async initialize (): Promise<void> {
    logger.info('start creating')
    const engine = new Engine()
    const result = new Promise<void>((resolve, _reject) => {
      engine.initialized.once('done', () => {
        logger.info('done')
        resolve()
      })
    })
    logger.info('start scanning')
    Engine.instance = engine
    engine.poweredUP.scan()
    return result
  }

  public static get (): Engine {
    if (!Engine.instance) {
      throw new Error('Engine is not initialized')
    }
    return Engine.instance
  }

  get hubs (): string[] {
    return Object.keys(this._hubs)
  }

  getHub (hubName: string): TechnicMediumHub {
    const result = this._hubs[hubName]
    if (!result) {
      throw new NotFoundError(`Cannot find hub ${hubName}`)
    }
    return result
  }

  getTiltX (hubName: string): BehaviorSubject<number> {
    const result = this.onTiltX[hubName]
    if (!result) {
      throw new NotFoundError(`Cannot find tilt sensor for hub ${hubName}`)
    }
    return result
  }

  private async getMotors<T extends TachoMotor> (motorId: IMotorId): Promise<T>
  private async getMotors<T extends TachoMotor> (motorId: IMotorsId): Promise<T[]>
  private async getMotors<T extends TachoMotor> (motorId: IMotorsId | IMotorId): Promise<T | T[]> {
    const hub = this.getHub(motorId.hub)
    if (isMotorsId(motorId)) {
      return await Promise.all(motorId.ports.map(port => hub.waitForDeviceAtPort(port) as Promise<T>))
    }
    return hub.waitForDeviceAtPort(motorId.port) as Promise<T>
  }

  async reportPosition (motorId: IMotorId): Promise<void> {
    const motor = await this.getMotors(motorId)
    const id = convertToMotorIdString(motorId)
    let subject = this.motorPosition[id]
    if (!subject) {
      subject = new ReplaySubject<number>(1)
      this.motorPosition[id] = subject

      let lastPosition: number | undefined
      motor.on('absolute', (position: {angle: number}) => {
        if (lastPosition !== position.angle) {
          lastPosition = position.angle
          this.motorPosition[id]?.next(lastPosition)
          console.log('absolute', motorId.hub, lastPosition)
        }
      })
    }
  }

  async initializeMotorsToZero (motorsId: IMotorsId | IMotorId, margin: number) {
    for (const motorId of getMotorIds(motorsId)) {
      logger.info(`going initialze motor ${motorId.port} on ${motorsId.hub} to zero with a margin of ${margin}`)
      await this.reportPosition(motorId)
      let currentPosition = await this.getLastPosition(motorId)
      console.log('POS', currentPosition)
      let attempt = 0
      while (currentPosition < (0 - margin) || currentPosition > margin) {
        console.log(attempt % 2)
        const toZero = currentPosition > 0 ? -20 : 20
        const power = attempt % 4 ? 100 : -100
        await this.runMotorToAngle(motorId, power, toZero)
        await this.resetMotorAngleToZero(motorId, currentPosition > 0 ? 0 - power : power)
        // await this.setCurrentToZero(motorId)
        currentPosition = await this.getLastPosition(motorId)
        console.log('POS', currentPosition)
        attempt++
      }
      // await this.setCurrentToZero(motorId)
    }
  }

  async getLastPosition (motorId: IMotorId): Promise<number> {
    const id = convertToMotorIdString(motorId)
    const subject = this.motorPosition[id]
    if (!subject) {
      throw new Error('Reporting not started')
    }
    return await firstValueFrom(subject.asObservable())
  }

  public async startMotor (motorId: IMotorsId | IMotorId, speed: number): Promise<TachoMotor[]> {
    const motors = isMotorsId(motorId) ? await this.getMotors(motorId) : [await this.getMotors(motorId)]
    for (const motor of motors) {
      motor.setPower(speed)
    }
    return motors
  }

  public async resetMotorAngleToZero (motorId: IMotorId, speed: number) {
    const motor = await this.getMotors<AbsoluteMotor>(motorId)
    await motor.gotoRealZero(speed)
  }

  public async setCurrentToZero (motorId: IMotorId) {
    const hub = this.getHub(motorId.hub)
    const motor = await hub.waitForDeviceAtPort(motorId.port) as AbsoluteMotor
    await motor.resetZero()
  }

  public async rotateMotorByDegrees (motorId: IMotorId, speed: number, orientation: number): Promise<void> {
    logger.info(`going to move motor ${motorId.port} on ${motorId.hub} to ${orientation}`)
    const hub = this.getHub(motorId.hub)
    const motor = await hub.waitForDeviceAtPort(motorId.port) as AbsoluteMotor
    await motor.rotateByDegrees(orientation, speed)
  }

  public async runMotorToAngle (motorId: IMotorId, speed: number, orientation: number, duration?: number): Promise<AbsoluteMotor> {
    logger.info(`going to move motor ${motorId.port} on ${motorId.hub} to ${orientation}`)
    const hub = this.getHub(motorId.hub)
    const motor = await hub.waitForDeviceAtPort(motorId.port) as AbsoluteMotor

    let angle = orientation
    // motor.gotoRealZero(50)
    //  do {
    console.log(motor.values)
    const goingToAngle = motor.gotoAngle(orientation, speed)
    if (duration) {
      const delay = hub.sleep(duration)
      await Promise.race([delay, goingToAngle])
      motor.brake()
    } else {
      await goingToAngle
    }
    angle = await this.getLastPosition(motorId)
    console.log('angle', angle, 'orientation', orientation)
    // eslint-disable-next-line no-unmodified-loop-condition
    //  } while (!duration && angle !== orientation)
    return motor
  }

  public async startMotorWhileTilt (motorId: IMotorId, speed: number, tiltCheck: (x: number) => boolean) {
    const onTilt = this.getTiltX(motorId.hub)
    if (tiltCheck(onTilt.getValue())) {
      return
    }
    return new Promise<void>((resolve, _reject) => {
      const subscription = onTilt.subscribe((x) => {
        logger.info(`tilt ${x}`)
        if (tiltCheck(x)) {
          logger.info('motor is stopped')
          this.stopMotor(motorId)
          subscription.unsubscribe()
          resolve()
        }
      })
      this.startMotor(motorId, speed)
    })
  }

  public async runMotorFor (motorId: IMotorsId | IMotorId, speed: number, duration: number) {
    const motors = await this.startMotor(motorId, speed)
    await this.getHub(motorId.hub).sleep(duration)
    await Promise.all(motors.map(motor => { return motor.brake() }))
  }

  public async stopMotor (motorId: IMotorId) {
    const motor = await this.getMotors(motorId)
    motor.brake()
    // await Promise.all(motors.map(motor => { return motor.brake() }))
  }
}

const getEngine = Engine.get
export default getEngine
