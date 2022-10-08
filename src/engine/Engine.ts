 

import { PoweredUP, TachoMotor, TechnicMediumHub, TechnicMediumHubTiltSensor } from "node-poweredup";
import { NotFoundError } from "routing-controllers";
import { BehaviorSubject } from 'rxjs';
import { EventEmitter } from "stream";
import { logger } from "../logger";


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



export class Engine {
    private _hubs: { 
        [key: string]: TechnicMediumHub
    } = {}
    private poweredUP = new PoweredUP();
    private initialized = new EventEmitter()
    public readonly onTiltX: {
        [key: string]: BehaviorSubject<number>
    } = {}

    constructor() {
        logger.info('Waiting for connections')
        this.poweredUP.on("discover", async (hub: TechnicMediumHub) => { // Wait to discover a Hub
            logger.info(`Discovered ${hub.name} - ${hub.batteryLevel}!`);
            await hub.connect(); // Connect to the Hub
            this._hubs[hub.name] = hub
            this.onTiltX[hub.name] = new BehaviorSubject<number>(0)
            hub.on('tilt', (sensor: TechnicMediumHubTiltSensor) => {
            //    console.log('hub is titlted', sensor.values)
                const sub = this.onTiltX[hub.name];
                const newValue = sensor.values['tilt'].x
                if(sub && sub.value != newValue) {
                    sub.next(newValue)
                }
            })
          
           //  console.log(this._hubs)
            if (Object.keys(this._hubs).length === 3) {
                this.initialized.emit('done', true)
            }
        })
    }

    
    private static instance: Engine
    public static async initialize(): Promise<void> {
        logger.info("start creating")
        const engine = new Engine();
        const result = new Promise<void> ((resolve, _reject)=>{
            engine.initialized.once('done', ()=> { 
                logger.info('done')
                resolve()
            })
        })
        logger.info("start scanning")
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
    getHub(hubName: string): TechnicMediumHub {
        const result = this._hubs[hubName]
        if (!result) {
            throw new NotFoundError(`Cannot find hub ${hubName}`)
        }
        return result
    }
    getTiltX(hubName: string): BehaviorSubject<number> {
        const result = this.onTiltX[hubName]
        if (!result) {
            throw new NotFoundError(`Cannot find tilt sensor for hub ${hubName}`)
        }
        return result
    }

    public async startMotor(hubName: string, port: string, speed: number) {
        const hub = this.getHub(hubName)
        const motor = await hub.waitForDeviceAtPort(port) as TachoMotor
        //console.log(motor)
        motor.setPower(speed)
    }   

    public async startMotorWhileTilt(hubName: string, port: string, speed: number, tiltCheck: (x: number) => boolean) {
        const onTilt = this.getTiltX(hubName)
        return new Promise<void>((resolve, _reject) => {
        const subscription = onTilt.subscribe((x) => {
            logger.info(`tilt ${x}`)
            if (tiltCheck(x)) {
                logger.info('motor is stopped')
                this.stopMotor(hubName, port)
                try 
       {         subscription.unsubscribe()
       }catch(_e) {}
                resolve()
            }
        })

        this.startMotor(hubName, port, speed)
    })
    }

    public async runMotorFor(hubName: string, port: string, speed: number, duration: number){
        this.startMotor(hubName, port, speed)
        await this.getHub(hubName).sleep(duration)
        this.stopMotor(hubName, port)
    }

    public async stopMotor<T extends TachoMotor>(hubName: string, port: string) {
        const hub = this.getHub(hubName)
        const motor = await hub.waitForDeviceAtPort(port) as T;
        // console.log(motor)
        motor.brake()
    }
}

const getEngine = Engine.get
export default getEngine
