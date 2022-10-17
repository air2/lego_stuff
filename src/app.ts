import 'reflect-metadata';


import { json } from 'body-parser';
import express, { Express } from 'express';
import { CraneHubSwitchMotor } from './controllers/EngineController';
import getEngine, { Engine } from './engine/Engine';
import initControllers from './helpers/BootstrapControllers';
import getSettings from './helpers/Settings';
import { logger } from './logger';



export async function initializeApp (): Promise<Express> {
   try {
     const app = express()
     app.use(json())
 
        //  app.use(cors({
        //    methods: ['GET', 'PATCH', 'POST', 'OPTIONS', 'PUT', 'HEAD', 'DELETE'],
        //    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Link'],
        //    origin: (_requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
        //      // this callback will generate a Access-Control-Allow-Origin header with the original DNS in it.
        //      // A simple '*' will not work in combination with the Access-Control-Allow-Credentials: true
        //      callback(null, true)
        //    },
        //    credentials: true
 
        //  }))
       
     
 
     initControllers(app)
     return app
   } catch (error) {
     console.error('While initializing application an error ocurred')
     console.error(error)
     throw error
   }
}

async function run () {
   logger.info('starting')
   await Engine.initialize()
   const app = await initializeApp()
  //  app.get('/', (_req: express.Request, _res: express.Response) => {
  //   // res.sendFile(join(process.cwd(), 'app/index.html'))
  // })
  // app.get('/health', (_req: express.Request, res: express.Response) => {
  //   res.sendStatus(200)
  // })
  // app.use(express.static('app'))
  // app.use(function (_req: express.Request, res: express.Response) {
  //   res.sendFile(join(process.cwd(), 'app/index.html'))
  // })
  const engine = getEngine()
  await engine.initializeMotorToZero(CraneHubSwitchMotor, 20)
  app.listen(getSettings().port)
  logger.info(`done running ${getSettings().port}`)
  

}

run()