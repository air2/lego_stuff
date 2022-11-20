import { Body, Get, JsonController, Post, Put } from 'routing-controllers'
import getEngine, { IMotorId, IMotorsId } from '../engine/Engine'
import { logger } from '../logger'

interface IApiResult<T> {
    result: T
}

export interface ICranePosition {
  up: boolean,
  stop?: number
}

export interface ICraneExtension {
  out: boolean
  duration: number
}

export interface IStabilizers extends ICraneExtension {
  down: boolean
}

export const CraneHubName = '3. Kraan'
export const MiddleHubName = '2. Voorkant'
export const LowerHubName = '1. Onderkant'

export const MainPowerMotor: IMotorsId = {
  hub: LowerHubName,
  ports: ['A', 'C']
}

export const PnuematicSwitchMotor: IMotorId = {
  hub: LowerHubName,
  port: 'B'
}

export const MiddleHubSwitchMotor: IMotorId = {
  hub: MiddleHubName,
  port: 'B'
}

export const CraneHubSwitchMotor: IMotorId = {
  hub: CraneHubName,
  port: 'D'
}

export const CraneHubExtensionMotor: IMotorId = {
  hub: CraneHubName,
  port: 'B'
}

export const CraneHubTiltMotor: IMotorId = {
  hub: CraneHubName,
  port: 'C'
}

export const CraneHubRopeMotor: IMotorId = {
  hub: CraneHubName,
  port: 'A'
}

enum CraneFunction {
  drive,
  pump,
  stabilizers,
  parapet
}

@JsonController('/crane')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default class CraneController {
  async chooseFunction (func: CraneFunction) {
    const engine = getEngine()
    await engine.initializeMotorsToZero(MiddleHubSwitchMotor, 20, 3000)
    const lastPos = await engine.getLastPosition(MiddleHubSwitchMotor)
    await engine.runMotorToAngle(MiddleHubSwitchMotor, 50, 0 - lastPos)
    await engine.runMotorToAngle(MiddleHubSwitchMotor, 50, 40)
    await engine.runMotorToAngle(MiddleHubSwitchMotor, 50, 45, 1000)
    await engine.runMotorToAngle(MiddleHubSwitchMotor, 20, -360)
    await engine.rotateMotorByDegrees(MiddleHubSwitchMotor, 20, 365)

    switch (func) {
      case CraneFunction.drive:
        break

      case CraneFunction.pump:
        await engine.rotateMotorByDegrees(MiddleHubSwitchMotor, -20, 151)
        break

      case CraneFunction.stabilizers:
        await engine.rotateMotorByDegrees(MiddleHubSwitchMotor, -20, 262)
        break

      case CraneFunction.parapet:
        await engine.rotateMotorByDegrees(MiddleHubSwitchMotor, -20, 372)
        break
    }
  }

  @Post('/hub/:hub/motor/:port/start/')
  async StartMotor (@Body() _speed: number): Promise<IApiResult<boolean>> {
    // const engine = getEngine()
    return { result: true }
  }

  @Get('/hubs')
  async GetHubs (): Promise<IApiResult<string[]>> {
    return { result: getEngine().hubs }
  }

  @Put('/position/')
  async PutCrane (@Body() position: ICranePosition) {
    const engine = getEngine()
    let almostStop: number | undefined
    const stopTimeCheck = (x: number) => {
      if (!almostStop) { almostStop = Date.now() } else {
        if (Date.now() - almostStop > 2000) {
          logger.info(`stopping, the tilt is ${x} for 2 seconds`)
          return true
        }
      }
      return false
    }

    const tiltCheck = position.up
      ? (x: number): boolean => {
          let end = position.stop ?? 133
          if (end > 178 || end < 133) {
            end = 133
          }
          if (x < end + 1) {
            logger.info(`almost stopping, the tilt is ${x}`)
            if (stopTimeCheck(x)) { return true }
          }
          return x < end
        }
      : (x: number): boolean => {
          let end = position.stop ?? 178
          if (end > 178 || end < 133) {
            end = 178
          }
          if (x > end - 1) {
            logger.info(`almost stopping, the tilt is ${x}`)
            if (stopTimeCheck(x)) { return true }
          }
          return x > end
        }
    await engine.startMotorWhileTilt(CraneHubTiltMotor, position.up ? -100 : 100, tiltCheck)
    if (!position.up) {
      logger.info('Lowering the crane just a little bit.')
      await engine.runMotorFor(CraneHubTiltMotor, 50, 3000)
    }
  }

  @Put('/rope/extend/')
  async ExtendRope (@Body() position: ICraneExtension) {
    logger.info('extending crane')
    const engine = getEngine()
    const duration = position.duration ?? 5000
    await engine.runMotorFor(CraneHubRopeMotor, position.out ? -100 : 100, duration)
  }

  @Put('/extend/')
  async ExtendCrane (@Body() position: ICraneExtension) {
    logger.info('extending crane')
    const engine = getEngine()
    // await engine.setCurrentToZero(CraneHubName, "D")
    // await engine.resetMotorAngleToZero(CraneHubName, "D", 50)
    if (position.out) {
      await engine.runMotorToAngle(CraneHubSwitchMotor, 50,
        360)
      await engine.runMotorToAngle(CraneHubSwitchMotor, 50, 10)
    } else {
      await engine.runMotorToAngle(CraneHubSwitchMotor, 50, 5)
    }

    const duration = position.duration ?? 2000
    // engine.runMotorFor(CraneHubRopeMotor, position.up ? -50 : 50, duration)
    await engine.runMotorFor(CraneHubExtensionMotor, 75, 1000)
    const promise = this.ExtendRope(position)
    await engine.runMotorFor(CraneHubExtensionMotor, 100, duration - 1000)
    await promise
  }

  @Put('/pump')
  async Pump (@Body() position: ICraneExtension) {
    logger.info('run pump')
    await this.chooseFunction(CraneFunction.pump)
    const engine = getEngine()
    await engine.runMotorFor(MainPowerMotor, position.out ? -50 : 50, position.duration)
  }

  @Put('/stabilizers')
  async ExtendStablizers (@Body() position: ICraneExtension) {
    logger.info('extend stablizers')
    await this.chooseFunction(CraneFunction.stabilizers)
    const engine = getEngine()
    await engine.runMotorFor(MainPowerMotor, position.out ? -50 : 50, position.duration)
    // if (position.out) {
    //   this.chooseFunction(Cran)
    // }
  }

  @Put('/stabilizers/test-down')
  async ExtendStablizersTest (@Body() _position: ICraneExtension) {
    logger.info('extend stablizers')
    //    await this.chooseFunction(CraneFunction.pump)
    const engine = getEngine()
    if (_position.out) {
      await engine.runMotorToAngle(PnuematicSwitchMotor, 10, 4, 2000)
    } else {
      await engine.runMotorToAngle(PnuematicSwitchMotor, 10, -57, 3000)
    }
    //    engine.rotateMotorByDegrees(PnuematicSwitchMotor, 10, 1)
    // await engine.runMotorFor(MainPowerMotor, position.out ? -50 : 50, position.duration)
    // if (position.out) {
    //   this.chooseFunction(Cran)
    // }
  }

  @Put('/parapet')
  async TurnParapet (@Body() position: ICraneExtension) {
    logger.info('extend parapet')
    await this.chooseFunction(CraneFunction.parapet)
    const engine = getEngine()
    await engine.runMotorFor(MainPowerMotor, position.out ? -50 : 50, position.duration)
  }
}
