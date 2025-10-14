import { Request, Response, NextFunction, Application } from 'express'

export function registerErrorHandler(app: Application) {
  // Express error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Basic logging
    try {
      console.error(err)
    } catch (e) {
      // ignore
    }
    const status = err?.statusCode || err?.status || 500
    res.status(status).json({ error: err?.message || 'Internal Server Error' })
  })
}
