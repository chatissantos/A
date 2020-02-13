const bunyan = require('bunyan')
const { settings } = require('./settings')
const logCfg = Object.assign({}, settings.logger)

const logger = bunyan.createLogger(logCfg)

const serializers = {
  req: require('bunyan-express-serializer'),
  res: bunyan.stdSerializers.res,
  err: bunyan.stdSerializers.err
}

logger.addSerializers(serializers)

const requestLogger = (req, res, next) => {
  logger.child({ id: req.id, body: req.body }, true).info({ req })
  next()
}
const responseLogger = (req, res, next) => {
  const afterResponse = () => {
    res.removeListener('finish', afterResponse)
    res.removeListener('close', afterResponse)
    logger.child({ id: req.id }, true).info({ res }, 'response')
  }
  res.on('finish', afterResponse)
  res.on('close', afterResponse)
  next()
}

module.exports = { logger, requestLogger, responseLogger }
