const { logger } = require('../../../config')
const { ApiManager } = require('../../apis/tribe/v1/manager')
const apiManager = new ApiManager()
const { createTransactionHistory } = require('../transact')

const getObjectType = (apiObject) => {
  if (apiObject.order) return 'order'
  if (apiObject.customer) return 'customer'
  if (apiObject.status_change) return 'status_change'
  return null
}

const sqsMessageHandler = async (message) => {
  // if this bombs out then we want to throw an error
  let apiObject
  if (message.Body) {
    apiObject = JSON.parse(message.Body)
  } else if (message.MessageBody) {
    apiObject = JSON.parse(message.MessageBody)
  }
  if (!apiObject) { throw new Error(`Unable to determine where message body is for message: ${JSON.stringify(message)}`) }
  const objectType = getObjectType(apiObject)
  let results = { success: false }
  switch (objectType) {
    case 'order':
      results = await apiManager.consumeOrder(apiObject.order)
      break
    case 'customer':
      results = await apiManager.consumeCustomer(apiObject.customer)
      break
    case 'status_change':
      results = await apiManager.consumeStatusChange(apiObject.status_change)
      break
    default:
      throw new Error('Could not determine type of object to parse')
  }
  if (results && (results.status === 'success')) {
    return results
  } else {
    logger.error({ status: 'error', type: 'SQS Processing', message: results })
    // if we failed, log it to CloudWatch
    const eventAction = 'error'
    const eventType = objectType
    const transactionOptions = {
      eventAction,
      eventType,
      apiObject: {
        apiObject,
        results
      },
      timestamp: new Date(),
      source: 'ecom',
      destination: 'prod'
    }
    await createTransactionHistory(transactionOptions)
    return results
  }
}

module.exports = { sqsMessageHandler }
