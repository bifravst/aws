import * as CloudFormation from '@aws-cdk/core'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'

/**
 * Allows to resolve cell geolocations using a GraphQL API
 */
export class CellGeolocation extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cellGeolocationCacheTable,
		}: {
			cellGeolocationCache: DynamoDB.ITable
		},
	) {
		super(parent, id)
	}
}
