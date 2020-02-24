import {
	DynamoDBClient,
} from '@aws-sdk/client-dynamodb-v2-node'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'

export const handler = addCellToCacheIfNotExists({
	TableName: process.env.CACHE_TABLE || '',
	dynamodb: new DynamoDBClient({})
})