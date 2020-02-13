const { AWS, awsConfig } = require('../../config/aws')
const { logger } = require('../../config')

const SNSPublisher = () => {
  const sns = new AWS.SNS({ endpoint: awsConfig.sns.endpoint })
  const TOPIC_ARN = awsConfig.sns.topic_arn

  const parseMeta = (meta) => {
    const results = {}
    for (let key in meta) {
      if (meta[key]) {
        results[key] = {
          DataType: 'String',
          StringValue: meta[key].toString()
        }
      }
    }
    return results
  }

  const publish = (messageObject, meta = {}) => {
    const messageAttributes = Object.assign({
      source: {
        DataType: 'String',
        StringValue: 'woo-api'
      }
    }, parseMeta(meta))
    const params = {
      TopicArn: TOPIC_ARN,
      Subject: 'fulfillment-action',
      Message: JSON.stringify(messageObject),
      // MessageStructure: 'json',
      MessageAttributes: messageAttributes
    }
    return new Promise((resolve, reject) => {
      sns.publish(params, (err, data) => {
        if (err) {
          logger.error({ status: 'error', type: 'SNS Publish Error', message: err.message })
          reject(err)
        }
        resolve(data)
      })
    })
  }
  return {
    publish
  }
}

module.exports = { SNSPublisher }
