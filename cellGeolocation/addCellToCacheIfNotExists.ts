import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'
import { Location, Cell } from './geolocateCell'

export const addCellToCacheIfNotExists = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({ area, mccmnc, cell, lat, lng, }: Cell & Location) =>
		TE.tryCatch<ErrorInfo, void>(
			async () => {
				const query = {
					TableName,
					Item: {
						cellId: {
							S: cellId({ area, mccmnc, cell }),
						},
						lat: {
							N: `${lat}`,
						},
						lng: {
							N: `${lng}`,
						},
					},
					ConditionExpression: 'attribute_not_exists(cellId)',
				}
				const res = await dynamodb.send(
					new PutItemCommand(query),
				)
				console.log(JSON.stringify({ query, res }))
			},
			err => {
				console.error(JSON.stringify({ error: err }))
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		)
