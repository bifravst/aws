import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@nrfcloud/package-layered-lambdas'
import { WebAppsStack } from '../stacks/WebApps'
import { BifravstLambdas } from '../prepare-resources'

export class BifravstApp extends App {
	public constructor(args: {
		stackId: string
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
	}) {
		super()
		new BifravstStack(this, args.stackId, args)
		new WebAppsStack(this, `${args.stackId}-webapps`)
	}
}
