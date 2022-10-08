import winston, { LeveledLogMethod } from 'winston'

export class logger {
  private static _logger?: winston.Logger

  private static create (): winston.Logger {
    const logger = winston.createLogger({
      transports: [
        new winston.transports.Console({
          level: 'debug',
          debugStdout: true,
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.simple()
          )
        })
      ]
    })

    return logger
  }

  public static get (): winston.Logger {
    if (!logger._logger) {
      logger._logger = logger.create()
    }
    return logger._logger
  }

  public static error: LeveledLogMethod = logger.get().error?.bind(logger.get())
  public static warn: LeveledLogMethod = logger.get().warn?.bind(logger.get())
  public static help: LeveledLogMethod = logger.get().help?.bind(logger.get())
  public static data: LeveledLogMethod = logger.get().data?.bind(logger.get())
  public static info: LeveledLogMethod = logger.get().info?.bind(logger.get())
  public static debug: LeveledLogMethod = logger.get().debug?.bind(logger.get())
  public static prompt: LeveledLogMethod = logger.get().prompt?.bind(logger.get())
  public static http: LeveledLogMethod = logger.get().http?.bind(logger.get())
  public static verbose: LeveledLogMethod = logger.get().verbose?.bind(logger.get())
  public static input: LeveledLogMethod = logger.get().input?.bind(logger.get())
  public static silly: LeveledLogMethod = logger.get().silly?.bind(logger.get())
}
