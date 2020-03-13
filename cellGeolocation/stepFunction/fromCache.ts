import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { pipe } from 'fp-ts/lib/pipeable'
import { geolocateCellFromCache, Cell } from '../geolocateCell'
import { CellGeoLocation } from './types'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE || '',
})

export const handler = async (cell: Cell): Promise<CellGeoLocation> =>
	pipe(
		locator(cell),
		TE.fold(
			() =>
				T.of({
					...cell,
					located: false,
				}),
			location =>
				T.of({
					...cell,
					located: true,
					...location,
				}),
		),
	)()
