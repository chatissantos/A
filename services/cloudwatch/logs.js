const {
  AWS,
  awsConfig
} = require('../../config/aws')
const cwLogsConfig = Object.assign({}, awsConfig.cloudwatch.logs)

const CloudwatchLogger = () => {
  const cloudwatchLogs = new AWS.CloudWatchLogs({
    endpoint: cwLogsConfig.endpoint
  })
  const logGroupName = cwLogsConfig.log_group
  const logStreamName = cwLogsConfig.log_stream
  let sequenceToken

  const getLogStreams = (options = {}) => {
    const params = {
      logGroupName,
      descending: true,
      orderBy: 'LastEventTime'
    }
    const useParams = Object.assign(params, options)
    return new Promise((resolve, reject) => {
      cloudwatchLogs.describeLogStreams(useParams, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  }

  const setSequenceToken = async () => {
    const logStreamResults = await getLogStreams()
    if (logStreamResults && logStreamResults.logStreams) {
      logStreamResults.logStreams.map(stream => {
        if (stream.logStreamName === logStreamName) {
          sequenceToken = stream.uploadSequenceToken
        }
      })
    }
  }

  const createLogGroup = () => {
    return new Promise((resolve, reject) => {
      cloudwatchLogs.createLogGroup({
        logGroupName
      }, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  }

  const createLogStream = () => {
    return new Promise((resolve, reject) => {
      cloudwatchLogs.createLogStream({
        logGroupName,
        logStreamName
      }, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  }

  const log = async (message) => {
    let messages = message
    if (!Array.isArray(message)) {
      messages = [message]
    }
    const logEvents = messages.map(m => {
      return {
        message: JSON.stringify(m),
        timestamp: Date.now()
      }
    })

    await setSequenceToken()

    const promise = new Promise((resolve, reject) => {
      cloudwatchLogs.putLogEvents({
        logEvents,
        sequenceToken,
        logStreamName,
        logGroupName
      }, (err, data) => {
        if (err) reject(err)
        sequenceToken = (data ? data.nextSequenceToken : null)
        resolve(data)
      })
    })
    const results = await promise
    return results
  }

  return {
    createLogGroup,
    createLogStream,
    getLogStreams,
    log
  }
}

module.exports = {
  CloudwatchLogger
}
