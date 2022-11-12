import { Express } from 'express';
import { useExpressServer } from "routing-controllers";
import CraneController from "../controllers/EngineController";

function initControllers (app: Express) {
    useExpressServer(app, {
      routePrefix: '/api',
      controllers: [CraneController],
 //     development: !environment.production,
      development: true,
      classTransformer: true
    })
  }
  
export default initControllers