import { TimestreamWrite } from 'aws-sdk'
import { fromEnv } from '../util/fromEnv'
import { batchToTimestreamRecords } from './batchToTimestreamRecords'
import { messageToTimestreamRecords } from './messageToTimestreamRecords'
import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords'

const { tableInfo } = fromEnv({
	tableInfo: 'TABLE_INFO',
})(process.env)

const [dbName, tableName] = tableInfo.split('|')

console.log(
	JSON.stringify({
		tableName,
		dbName,
	}),
)

const storeRecordsInTimeseries = (timeseries: TimestreamWrite) => async (
	Records: TimestreamWrite.Records,
): Promise<void> => {
	if (Records.length === 0) {
		console.log({
			storeRecordsInTimeseries: 'No records to store.',
		})
		return
	}
	const args = {
		DatabaseName: dbName,
		TableName: tableName,
		Records,
	}
	console.log(JSON.stringify(args))
	const request = timeseries.writeRecords(args)
	try {
		await request.promise()
	} catch (err) {
		const RejectedRecords = JSON.parse(
			(request as any).response.httpResponse.body.toString(),
		).RejectedRecords
		if (RejectedRecords !== undefined) {
			console.error({
				RejectedRecords,
			})
		}
		throw new Error(`${err.code}: ${err.message}`)
	}
}

const storeUpdate = storeRecordsInTimeseries(new TimestreamWrite())

/**
 * Processes device messages and updates and stores the in Timestream
 */
export const handler = async (
	event: UpdatedDeviceState | DeviceMessage | BatchMessage,
): Promise<void> => {
	console.log(JSON.stringify(event))

	try {
		if ('reported' in event) {
			await storeUpdate(shadowUpdateToTimestreamRecords(event))
			return
		}
		if ('message' in event) {
			await storeUpdate(messageToTimestreamRecords(event))
			return
		}
		if ('batch' in event) {
			await storeUpdate(batchToTimestreamRecords(event))
			return
		}
		console.error(
			JSON.stringify({
				error: 'Unknown event',
				event,
			}),
		)
	} catch (err) {
		console.error(err)
		console.error(
			JSON.stringify({
				error: err.message,
			}),
		)
		return
	}
}
