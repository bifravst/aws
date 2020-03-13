import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import { CellGeoLocation } from './types'

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async (cell: CellGeoLocation): Promise<boolean> => {
	console.log(
		JSON.stringify({
			cell,
		}),
	)
	const { lat, lng, accuracy } = cell
	await dynamodb.send(
		new PutItemCommand({
			TableName,
			Item: {
				cellId: {
					S: cellId(cell),
				},
				lat: {
					N: `${lat}`,
				},
				lng: {
					N: `${lng}`,
				},
				accuracy: {
					N: `${accuracy}`,
				},
				ttl: {
					N: `${Math.round(Date.now() / 1000) + 24 * 60 * 60}`,
				},
			},
		}),
	)
	return true
}
