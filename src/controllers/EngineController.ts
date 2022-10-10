import { Body, Get, JsonController, Post, Put } from "routing-controllers"
import getEngine, { IMotorId } from "../engine/Engine"
import { logger } from "../logger"

interface IApiResult<T> {
    result: T
}

export interface ICranePosition {
  up: boolean
}

export const CraneHubName = '3. Kraan'

export const CraneHubSwitchMotor: IMotorId = {
  hub: CraneHubName,
  port: "D"
}

export const CraneHubExtensionMotor: IMotorId = {
  hub: CraneHubName,
  port: "B"
}

export const CraneHubTiltMotor: IMotorId = {
  hub: CraneHubName,
  port: "C"
}



@JsonController('/crane')
export default class EnigineController {
  @Post('/hub/:hub/motor/:port/start/')
  async StartMotor (@Body() _speed: number): Promise<IApiResult<boolean>> {
    //const engine = getEngine()
    return { result: true }
  }
  
  @Get('/hubs')
  async GetHubs(): Promise<IApiResult<string[]>> {
    return  {result: getEngine().hubs }
  }

  @Put('/position/') 
  async PutCrane(@Body() position: ICranePosition) {
    const engine = getEngine()
    const tiltCheck = position.up 
      ? (x: number): boolean => {
        if (x < 140)  {
          logger.info(`almost stopping, the tilt is ${x}`)
        }
          return x < 133
      }
      : (x: number): boolean => {
        if (x > 170)  {
          logger.info(`almost stopping, the tilt is ${x}`)
        }
        return x > 178
      }
      await engine.startMotorWhileTilt(CraneHubTiltMotor, position.up  ? -100 : 100, tiltCheck)
      if (!position.up) {
        logger.info("Lowering the crane just a little bit.")
        await engine.runMotorFor(CraneHubTiltMotor, 50, 3000)
      }
  }

  @Put('/extend/')
  async ExtendCrane(@Body() position: ICranePosition) {
    logger.info('extending crane')
    const engine = getEngine()
    //await engine.setCurrentToZero(CraneHubName, "D")
    //await engine.resetMotorAngleToZero(CraneHubName, "D", 50)
    if (!position.up){ 
      await engine.runMotorToAngle(CraneHubSwitchMotor, 50,
      360)
      await engine.runMotorAngle(CraneHubTiltMotor, 50, 20)
    } else {
     await engine.runMotorToAngle(CraneHubSwitchMotor, 50, 5)
    }
    // await engine.runMotorFor(CraneHubName, "B", 100, 2000)
    
  }
}