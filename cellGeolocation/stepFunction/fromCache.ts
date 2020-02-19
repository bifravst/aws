import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { pipe } from 'fp-ts/lib/pipeable'
import { geolocateCellFromCache } from '../geolocateCell'
import { CellGeoInput, CellGeoResponse } from './types'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE || '',
})

export const handler = async (args: CellGeoInput): Promise<CellGeoResponse> =>
	pipe(
		TE.right(args.roaming),
		TE.map(locator),
		TE.fold(
			() =>
				T.of({
					located: false,
					...args.roaming,
				}),
			location =>
				T.of({
					located: true,
					...args.roaming,
					...location,
				}),
		),
	)()
