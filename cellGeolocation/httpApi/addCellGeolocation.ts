import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { Cell, Location } from '../geolocateCell'
import { toStatusCode, ErrorInfo, ErrorType } from '../ErrorInfo'
import { res } from './res'
import { addDeviceCellGeolocation } from '../addDeviceCellGeolocation'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'
import { sequenceT } from 'fp-ts/lib/Apply'

const dynamodb = new DynamoDBClient({})

const persistDeviceCellGeolocation = addDeviceCellGeolocation({
	dynamodb,
	TableName: process.env.DEVICE_CELL_GEOLOCATION_TABLE || '',
	source: `cli`,
})

const addToCellGeolocation = addCellToCacheIfNotExists({
	dynamodb,
	TableName: process.env.CACHE_TABLE || '',
})

const inputSchema = new Ajv().compile({
	type: 'object',
	properties: {
		cell: {
			type: 'number',
			min: 1,
		},
		area: {
			type: 'number',
			min: 1,
		},
		mccmnc: {
			type: 'number',
			min: 10000,
		},
		lat: {
			type: 'number',
			min: -90,
			max: 90,
		},
		lng: {
			type: 'number',
			min: -180,
			max: 180,
		},
	},
	required: ['cell', 'area', 'mccmnc', 'lat', 'lng'],
	additionalProperties: false
})

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))
	return pipe(
		E.parseJSON<ErrorInfo>(event.body || '', () => ({
			message: `Failed to parse body "${event.body}"!`,
			type: ErrorType.BadRequest
		})),
		E.map(body => {
			const b = body as any
			return validate<Cell & Location>(inputSchema)({
				cell: parseInt(b.cell, 10),
				area: parseInt(b.area, 10),
				mccmnc: parseInt(b.mccmnc, 10),
				lat: parseFloat(b.lat),
				lng: parseFloat(b.lng),
			})()
		}),
		E.flatten,
		TE.fromEither,
		TE.chain(
			cellgeolocation => pipe(
				// Persist cell geo locations
				persistDeviceCellGeolocation({ cellgeolocation, source: `api:${event.requestContext.identity.sourceIp}:${event.requestContext.identity.userAgent}` }),
				TE.map(id => pipe(
					// If this is the first time we see this cell, make it available in the cache
					addToCellGeolocation(cellgeolocation),
					TE.map(() => id)
				))
			)
		),
		TE.fold(
			error =>
				res(toStatusCode[error.type])(error),
			res(202),
		)
	)()
}

// @See https://dev.to/gnomff_65/fp-ts-sequencet-and-sweet-sweet-async-typed-fp-5aop
pipe(
	E.right({ "cell": 75917039, "area": 112, "mccmnc": 11041, "lat": 81.52779077181465, "lng": 152.51040725315684 }),
	TE.fromEither,
	TE.map(
		sequenceT(TE.taskEither)(
			persistDeviceCellGeolocation,
			addToCellGeolocation,
		),
	),
	TE.fold(
		error =>
			res(toStatusCode[error.type])(error),
		res(202),
	)
)().then(v => {
	console.log(v)
})
