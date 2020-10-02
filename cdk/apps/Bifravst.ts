import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { WebAppsStack } from '../stacks/WebApps'
import { BifravstLambdas } from '../prepare-resources'

export class BifravstApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		cloudFormationLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
		enableUnwiredApi: boolean
	}) {
		super()
		new BifravstStack(this, {
			...args,
			isTest: false,
		})
		new WebAppsStack(this)
	}
}
