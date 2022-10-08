import { Express } from 'express';
import { useExpressServer } from "routing-controllers";
import EnigineController from "../controllers/EngineController";

function initControllers (app: Express) {
    useExpressServer(app, {
      routePrefix: '/api',
      controllers: [EnigineController],
 //     development: !environment.production,
      development: true,
      classTransformer: true
    })
  }
  
export default initControllers