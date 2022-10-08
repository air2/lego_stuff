export class Settings {
    private constructor () {
    }
  
    // eslint-disable-next-line no-use-before-define
    private static instance: Settings
    public static get (): Settings {
      if (!Settings.instance) {
        Settings.instance = new Settings()
      }
      return Settings.instance
    }
  
    public get port () {
      return +(process.env["PORT"] || 57190)
    }

}

const getSettings = Settings.get
export default getSettings
